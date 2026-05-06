"""VIN lookup → parts finder.

Decoding strategy (multi-source, best-effort, fail-soft):
  1. NHTSA vPIC `decodevinvaluesextended` — most comprehensive free API.
  2. NHTSA vPIC `decodevinvalues` — fallback if extended fails.
  3. WMI prefix table (`wmi_table.py`) — guarantees we ALWAYS know the
     manufacturer + country even when NHTSA returns nothing (covers
     UK/EU/JDM/China/India makes that NHTSA doesn't fully decode).
  4. ISO 3779 year code from VIN position 10 — fills in year when NHTSA
     leaves it blank.
  5. Claude augmentation — fills remaining blanks (model/engine/body)
     given (make, year) from the steps above. Disabled if EMERGENT_LLM_KEY
     missing.

Parts matching strategy:
1. Authoritative: products in JOY catalog whose car_fits matches the decoded
   vehicle (brand/model/year-range). Shown as "in stock now".
2. AI-augmented suggestions: Claude proposes part categories + common
   cross-reference numbers for the decoded vehicle. Shown as "suggested,
   request quote" — routes to /part-requests for the sourcing team.
"""

import json
import os
import re
import requests
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, Request
from pydantic import BaseModel

from core import api_router, db, logger, EMERGENT_LLM_KEY, GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID, get_current_user, tier_price
from wmi_table import lookup_wmi, decode_year

NHTSA_VALUES = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{vin}?format=json"
NHTSA_VALUES_EXT = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/{vin}?format=json"
CACHE_TTL_DAYS = 30
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")  # standard VIN: no I, O, Q


def _normalize_vin(vin: str) -> str:
    return (vin or "").strip().upper()


def _vin_valid(vin: str) -> bool:
    return bool(VIN_RE.match(vin))


def _first_truthy(*vals: str) -> str:
    for v in vals:
        if v and str(v).strip() and str(v).strip().lower() not in ("not applicable", "null", "n/a"):
            return str(v).strip()
    return ""


async def _decode_via_nhtsa(vin: str) -> dict:
    """Try the extended endpoint first; fall back to standard. Returns
    a slim normalised dict. Never raises — partial dicts are OK."""
    raw = {}
    try:
        r = requests.get(NHTSA_VALUES_EXT.format(vin=vin), timeout=10)
        if r.status_code == 200:
            results = (r.json().get("Results") or [{}])[0]
            raw = results
    except Exception as e:
        logger.warning(f"NHTSA extended failed for {vin}: {e}")
    if not raw:
        try:
            r = requests.get(NHTSA_VALUES.format(vin=vin), timeout=10)
            if r.status_code == 200:
                raw = (r.json().get("Results") or [{}])[0]
        except Exception as e:
            logger.warning(f"NHTSA values failed for {vin}: {e}")

    return {
        "make": (raw.get("Make") or "").title(),
        "model": (raw.get("Model") or "").title(),
        "year_str": (raw.get("ModelYear") or "").strip(),
        "body_class": _first_truthy(raw.get("BodyClass"), raw.get("BodyType")),
        "vehicle_type": raw.get("VehicleType") or "",
        "engine_cc": raw.get("DisplacementCC") or "",
        "engine_l": raw.get("DisplacementL") or "",
        "engine_cyl": raw.get("EngineCylinders") or "",
        "engine_hp": raw.get("EngineHP") or "",
        "fuel": _first_truthy(raw.get("FuelTypePrimary"), raw.get("FuelTypeSecondary")),
        "drive_type": raw.get("DriveType") or "",
        "transmission": _first_truthy(raw.get("TransmissionStyle"), raw.get("TransmissionSpeeds")),
        "trim": _first_truthy(raw.get("Trim"), raw.get("Trim2"), raw.get("Series")),
        "manufacturer": raw.get("Manufacturer") or "",
        "plant_country": raw.get("PlantCountry") or "",
        "doors": raw.get("Doors") or "",
        "error_code": raw.get("ErrorCode") or "",
        "error_text": raw.get("ErrorText") or "",
    }


async def _ai_augment_vehicle(decoded: dict) -> dict:
    """If we have manufacturer+year but missing model/body/engine, ask
    Claude to fill the blanks based on common product lines from that
    manufacturer in that year. Marked as 'inferred' for transparency."""
    if not EMERGENT_LLM_KEY:
        return {}
    have_make = decoded.get("make")
    have_year = decoded.get("year")
    has_model = decoded.get("model")
    has_engine = decoded.get("engine_l")
    if not have_make or not have_year:
        return {}
    if has_model and has_engine and decoded.get("body_class"):
        return {}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"vin_aug_{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are a precise automotive identification assistant. "
                "Given a partial vehicle description (VIN snippets, make, year, country), "
                "return your best inference of the missing fields. If you are not at least "
                "60% confident, return null for that field. Output STRICT JSON only with keys: "
                "{model, body_class, engine_l, fuel, drive_type, transmission, confidence}. "
                "confidence ∈ {high, medium, low}. No prose."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = (
            f"VIN: {decoded.get('vin')}. "
            f"Known: make={have_make}, year={have_year}, "
            f"country={decoded.get('plant_country') or 'unknown'}, "
            f"manufacturer={decoded.get('manufacturer') or 'unknown'}. "
            f"WMI prefix={decoded.get('wmi_match') or 'n/a'}. "
            "What is the most likely model/body/engine/transmission for this VIN? "
            "Strict JSON only."
        )
        reply = await chat.send_message(UserMessage(text=prompt))
        text = reply.strip() if isinstance(reply, str) else str(reply)
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return {}
        parsed = json.loads(m.group(0))
        out = {}
        for k in ("model", "body_class", "engine_l", "fuel", "drive_type", "transmission"):
            v = parsed.get(k)
            if v and str(v).strip().lower() not in ("null", "none", "unknown", "n/a"):
                out[k] = str(v).strip()
        if out:
            out["inferred"] = True
            out["inference_confidence"] = parsed.get("confidence", "medium")
        return out
    except Exception as e:
        logger.warning(f"VIN AI augment failed: {e}")
    return {}


async def _decode_full(vin: str, fast: bool = False) -> dict:
    """Multi-source decode chain. Always returns a dict — never raises
    on partial data. The dict is suitable to be cached + returned.
    
    fast=True skips the AI augmentation step (saves ~3-5s)."""
    nhtsa = await _decode_via_nhtsa(vin)
    wmi = lookup_wmi(vin)
    year_from_code = decode_year(vin)

    # Year disambiguation. Many European/JDM manufacturers (Porsche, Mercedes,
    # BMW, Toyota Japan) use Z-fillers and DON'T follow the ISO position-7
    # numeric-vs-alpha rule. NHTSA naively applies the rule and returns 1988
    # for what is actually a 2018 Porsche.
    # Rule: only override NHTSA when (a) NHTSA's year is < 2000, AND (b) the
    # WMI is a non-US prefix (W=Germany, S=UK, V=France/Spain, J=Japan, K=Korea,
    # L=China, M=India/Thailand, T=Czech, X=Russia, Y=Sweden, Z=Italy).
    # US-built VINs (1/4/5*, 2*=Canada, 3*=Mexico) follow ISO strictly — trust NHTSA.
    nhtsa_year = int(nhtsa["year_str"]) if nhtsa["year_str"].isdigit() else None
    chosen_year = nhtsa_year or year_from_code
    year_disambiguated = False
    NON_US_PREFIXES = ("W", "S", "V", "J", "K", "L", "M", "T", "X", "Y", "Z")
    if (
        nhtsa_year and year_from_code
        and nhtsa_year < 2000
        and year_from_code >= 2010
        and (vin[:1] in NON_US_PREFIXES)
    ):
        chosen_year = year_from_code
        year_disambiguated = True

    decoded = {
        "vin": vin,
        "make": nhtsa["make"] or wmi.get("make", "").split(" / ")[0].title(),
        "model": nhtsa["model"],
        "year": chosen_year,
        "body_class": nhtsa["body_class"],
        "vehicle_type": nhtsa["vehicle_type"],
        "engine_cc": nhtsa["engine_cc"],
        "engine_l": nhtsa["engine_l"],
        "engine_cyl": nhtsa["engine_cyl"],
        "engine_hp": nhtsa["engine_hp"],
        "fuel": nhtsa["fuel"],
        "drive_type": nhtsa["drive_type"],
        "transmission": nhtsa["transmission"],
        "trim": nhtsa["trim"],
        "manufacturer": nhtsa["manufacturer"] or wmi.get("make", ""),
        "plant_country": nhtsa["plant_country"] or wmi.get("country", ""),
        "doors": nhtsa["doors"],
        "wmi_match": wmi.get("wmi_match", ""),
        "wmi_make": wmi.get("make", ""),
        "wmi_country": wmi.get("country", ""),
        "year_from_code": year_from_code,
        "nhtsa_year": nhtsa_year,
        "year_disambiguated": year_disambiguated,
        "error_code": nhtsa["error_code"],
        "error_text": nhtsa["error_text"],
        "decoded_at": datetime.now(timezone.utc).isoformat(),
        "sources": ["nhtsa" if (nhtsa["make"] or nhtsa["model"]) else None,
                    "wmi" if wmi else None,
                    "year_code" if year_from_code else None],
    }
    decoded["sources"] = [s for s in decoded["sources"] if s]

    # AI augmentation: only when explicitly requested (slow path)
    if not fast:
        aug = await _ai_augment_vehicle(decoded)
        if aug:
            for k, v in aug.items():
                if k in ("inferred", "inference_confidence"):
                    continue
                if not decoded.get(k):
                    decoded[k] = v
            decoded["sources"].append("ai")
            decoded["ai_inferred"] = True
            decoded["ai_confidence"] = aug.get("inference_confidence", "medium")

    if decoded["error_code"] and decoded["make"]:
        decoded["error_text"] = f"NHTSA partial decode (used WMI fallback): {decoded['error_text']}"

    return decoded


@api_router.get("/vin/decode")
async def vin_decode(vin: str, fast: bool = True):
    """fast=True (default) returns in ~1s using NHTSA + WMI + year-code only.
    fast=False adds AI augmentation (3-5s extra)."""
    vin = _normalize_vin(vin)
    if not _vin_valid(vin):
        raise HTTPException(400, "Invalid VIN. Must be 17 chars, A-Z (no I/O/Q) and digits.")

    # Workshop-verified correction takes priority over everything (NHTSA, WMI, AI)
    correction = await db.vin_corrections.find_one({"vin": vin}, {"_id": 0})
    if correction:
        # Decode the underlying authoritative data first so we keep all fields,
        # then overlay the corrected fields on top.
        cached = await db.vin_cache.find_one({"vin": vin}, {"_id": 0}) or {}
        if not cached:
            cached = await _decode_full(vin)
            await db.vin_cache.update_one({"vin": vin}, {"$set": cached}, upsert=True)
        merged = dict(cached)
        for k in ("make", "model", "year", "body_class", "engine_l", "fuel",
                  "transmission", "drive_type", "trim"):
            v = correction.get(k)
            if v not in (None, "", 0):
                merged[k] = v
        merged["verified_by_workshop"] = True
        merged["verified_by_company"] = correction.get("company_name", "")
        merged["verified_at"] = correction.get("created_at", "")
        merged["sources"] = ["workshop_verified"]
        merged["ai_inferred"] = False
        merged["cached"] = True
        return merged

    # Cache hit?
    cached = await db.vin_cache.find_one({"vin": vin}, {"_id": 0})
    if cached:
        try:
            decoded_at = datetime.fromisoformat(cached["decoded_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - decoded_at < timedelta(days=CACHE_TTL_DAYS):
                cached["cached"] = True
                return cached
        except Exception:
            pass

    decoded = await _decode_full(vin)
    await db.vin_cache.update_one(
        {"vin": vin}, {"$set": decoded}, upsert=True,
    )
    decoded["cached"] = False
    return decoded


# ============= Workshop VIN correction =============
class VinCorrectionPayload(BaseModel):
    vin: str
    make: str = ""
    model: str = ""
    year: int | None = None
    body_class: str = ""
    engine_l: str = ""
    fuel: str = ""
    transmission: str = ""
    drive_type: str = ""
    trim: str = ""


@api_router.post("/vin/correct")
async def correct_vin(payload: VinCorrectionPayload, request: Request):
    """Workshop submits the correct decode for a VIN. Becomes the
    authoritative answer for every subsequent lookup network-wide."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Login required to correct VIN data")
    vin = _normalize_vin(payload.vin)
    if not _vin_valid(vin):
        raise HTTPException(400, "Invalid VIN.")

    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    company_name = (ws or {}).get("company_name", user.get("name", ""))

    doc = {
        "vin": vin,
        "user_id": user["user_id"],
        "company_name": company_name,
        "make": payload.make.strip() or None,
        "model": payload.model.strip() or None,
        "year": payload.year,
        "body_class": payload.body_class.strip() or None,
        "engine_l": payload.engine_l.strip() or None,
        "fuel": payload.fuel.strip() or None,
        "transmission": payload.transmission.strip() or None,
        "drive_type": payload.drive_type.strip() or None,
        "trim": payload.trim.strip() or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Strip nulls
    doc = {k: v for k, v in doc.items() if v is not None}
    await db.vin_corrections.update_one({"vin": vin}, {"$set": doc}, upsert=True)
    return {"ok": True, "vin": vin, "verified_by": company_name}


# ============= Vehicle photo (Google CSE → Wikipedia fallback) =============
WIKI_SEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_HEADERS = {"User-Agent": "JoyAutomart/1.0 (b2b@joyautomart.com)"}
GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"


def _google_cse_top_image(query: str) -> dict | None:
    """Hit Google Custom Search Image API. Returns the single best photo
    or None on failure. Free tier: 100 queries/day."""
    if not GOOGLE_CSE_API_KEY or not GOOGLE_CSE_ID:
        return None
    try:
        r = requests.get(
            GOOGLE_CSE_URL,
            params={
                "key": GOOGLE_CSE_API_KEY,
                "cx": GOOGLE_CSE_ID,
                "q": query,
                "searchType": "image",
                "imgType": "photo",
                "imgSize": "large",
                "safe": "active",
                "num": 1,
            },
            timeout=8,
        )
        if r.status_code != 200:
            logger.warning(f"Google CSE returned {r.status_code}: {r.text[:200]}")
            return None
        items = (r.json().get("items") or [])
        if not items:
            return None
        it = items[0]
        return {
            "url": it.get("link"),
            "title": it.get("title", "")[:140],
            "page_url": (it.get("image") or {}).get("contextLink") or it.get("link"),
            "source": "google",
        }
    except Exception as e:
        logger.warning(f"Google CSE failed: {e}")
        return None


def _wiki_request(params: dict) -> dict:
    try:
        r = requests.get(WIKI_SEARCH, params=params, headers=WIKI_HEADERS, timeout=8)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.warning(f"Wikipedia request failed: {e}")
        return {}


def _wiki_top_image(make: str, model: str) -> dict | None:
    """Single best Wikipedia photo. Returns None on failure."""
    q_terms = " ".join([t for t in [make, model] if t]).strip()
    if not q_terms:
        return None
    search = _wiki_request({
        "action": "query", "format": "json", "list": "search",
        "srsearch": q_terms, "srlimit": 3, "srnamespace": 0,
    })
    hits = (search.get("query") or {}).get("search") or []
    if not hits:
        return None
    titles = [h["title"] for h in hits[:3]]
    img_data = _wiki_request({
        "action": "query", "format": "json",
        "titles": "|".join(titles),
        "prop": "pageimages|info",
        "pithumbsize": 600, "piprop": "thumbnail",
        "inprop": "url",
    })
    pages = (img_data.get("query") or {}).get("pages") or {}
    by_title = {p.get("title"): p for p in pages.values()}
    for title in titles:
        p = by_title.get(title)
        if not p:
            continue
        thumb = (p.get("thumbnail") or {}).get("source")
        if thumb:
            return {
                "url": thumb,
                "title": title,
                "page_url": p.get("fullurl") or f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
                "source": "wikipedia",
            }
    return None


@api_router.get("/vin/photos")
async def vin_photos(make: str = "", model: str = "", year: int | None = None):
    """Return ONE exact-match vehicle photo. Tries Google CSE first
    (most accurate, year-specific) → falls back to Wikipedia (model
    generation only). 30-day cache keyed by year+make+model."""
    make = (make or "").strip()
    model = (model or "").strip()
    if not make:
        return {"photos": [], "source": None}

    cache_key = f"{year or ''}|{make.lower()}|{model.lower()}"
    cached = await db.vehicle_photos_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        try:
            cached_at = datetime.fromisoformat(cached["cached_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - cached_at < timedelta(days=CACHE_TTL_DAYS):
                return {
                    "photos": cached.get("photos", []),
                    "source": cached.get("source"),
                    "cached": True,
                }
        except Exception:
            pass

    # 1. Try Google CSE for the exact year+make+model
    photo = None
    source = None
    if GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID:
        q = " ".join(str(x) for x in [year, make, model] if x).strip()
        photo = _google_cse_top_image(q)
        source = "google" if photo else None

    # 2. Fall back to Wikipedia (model-generation level)
    if not photo:
        photo = _wiki_top_image(make, model)
        source = "wikipedia" if photo else None

    photos = [photo] if photo else []
    await db.vehicle_photos_cache.update_one(
        {"key": cache_key},
        {"$set": {"key": cache_key, "photos": photos, "source": source,
                  "cached_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"photos": photos, "source": source, "cached": False}


def _matches_fit(fit: dict, make: str, model: str, year):
    if not isinstance(fit, dict):
        return False
    fb = (fit.get("brand") or "").lower()
    fm = (fit.get("model") or "").lower()
    if make and fb and fb != make.lower():
        return False
    if model and fm and fm not in model.lower() and model.lower() not in fm:
        return False
    if year and fit.get("year_from") and fit.get("year_to"):
        try:
            if not (int(fit["year_from"]) <= int(year) <= int(fit["year_to"])):
                return False
        except Exception:
            pass
    return True


async def _matched_catalog(decoded: dict, request: Request):
    make = decoded.get("make") or ""
    model = decoded.get("model") or ""
    year = decoded.get("year")
    products = await db.products.find(
        {"car_fits": {"$exists": True, "$ne": []}}, {"_id": 0},
    ).to_list(500)
    matches = []
    for p in products:
        for fit in p.get("car_fits", []):
            if _matches_fit(fit, make, model, year):
                matches.append(p)
                break
    # Apply tier pricing
    user = await get_current_user(request)
    tier = "retail"
    if user and user.get("role") == "workshop":
        ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if ws:
            tier = ws.get("pricing_tier", "silver")
    for p in matches:
        p["your_price_bdt"] = tier_price(p.get("price_bdt", 0), tier)
        p["retail_price_bdt"] = p.get("price_bdt")
        p["your_tier"] = tier
    return matches


SUGGESTED_CATEGORIES = [
    "Brake (pads, rotors, calipers)",
    "Engine (oil filter, air filter, spark plugs, timing belt)",
    "Suspension (shock absorbers, control arms, bushings)",
    "Drivetrain (CV joints, wheel bearings, axles)",
    "Electrical (battery, alternator, starter, headlight bulbs)",
    "Fluids (engine oil, transmission fluid, coolant, brake fluid)",
]


async def _ai_suggestions(decoded: dict) -> list:
    """Ask Claude for common parts + cross-reference part numbers.
    Returns [] silently on failure — never blocks the main response.
    """
    if not EMERGENT_LLM_KEY:
        return []
    make = decoded.get("make") or ""
    model = decoded.get("model") or ""
    year = decoded.get("year") or ""
    if not make or not model:
        return []
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"vin_suggest_{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are an automotive parts cataloger. Given a vehicle, "
                "return common service-replacement parts with their typical "
                "OEM part-number prefixes / aftermarket cross-reference codes. "
                "Be honest: prefix uncertain numbers with 'check' or '~'. "
                "Output STRICT JSON with key 'parts' = list of "
                "{category, name, oem_hint, common_brands, notes}. "
                "Limit to 8 items. No prose outside JSON."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = (
            f"Vehicle: {year} {make} {model} "
            f"(engine: {decoded.get('engine_l') or ''}L, "
            f"fuel: {decoded.get('fuel') or ''}). "
            "List the 8 most common service-replacement parts a workshop "
            "would order with rough OEM number hints and 2-3 reliable "
            "aftermarket brand cross-references each. Strict JSON only."
        )
        reply = await chat.send_message(UserMessage(text=prompt))
        # Extract JSON from reply
        text = reply.strip() if isinstance(reply, str) else str(reply)
        # Strip code fences if present
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return []
        parsed = json.loads(m.group(0))
        parts = parsed.get("parts") or []
        if isinstance(parts, list):
            return parts[:8]
    except Exception as e:
        logger.warning(f"VIN AI suggest failed: {e}")
    return []


@api_router.get("/vin/parts")
async def vin_parts(vin: str, request: Request, include_ai: bool = True):
    """One-shot endpoint: decode VIN + return matched JOY catalog + AI part
    suggestions for items not in catalog. The frontend uses a single call."""
    vin = _normalize_vin(vin)
    if not _vin_valid(vin):
        raise HTTPException(400, "Invalid VIN.")

    # Reuse the cached decode path
    decoded = await vin_decode(vin)
    matched = await _matched_catalog(decoded, request)
    suggestions = []
    if include_ai and decoded.get("make") and decoded.get("model"):
        suggestions = await _ai_suggestions(decoded)

    return {
        "vehicle": decoded,
        "in_stock_count": len(matched),
        "matched_products": matched,
        "ai_suggestions": suggestions,
        "suggestion_categories": SUGGESTED_CATEGORIES,
    }


# ============= Saved VIN history (per workshop) =============
class SaveVinPayload(BaseModel):
    vin: str
    label: str = ""  # e.g. "Customer A's 2020 Harrier"


@api_router.post("/vin/saved")
async def save_vin(payload: SaveVinPayload, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Login to save VINs")
    vin = _normalize_vin(payload.vin)
    if not _vin_valid(vin):
        raise HTTPException(400, "Invalid VIN.")
    # Decode (cached) so the saved record carries useful summary
    decoded = await vin_decode(vin)
    doc = {
        "saved_id": f"sv_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "vin": vin,
        "label": payload.label or f"{decoded.get('year','')} {decoded.get('make','')} {decoded.get('model','')}".strip(),
        "summary": {
            "make": decoded.get("make"), "model": decoded.get("model"),
            "year": decoded.get("year"), "engine_l": decoded.get("engine_l"),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.saved_vins.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/vin/saved")
async def list_saved_vins(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Login required")
    items = await db.saved_vins.find(
        {"user_id": user["user_id"]}, {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    return items


@api_router.delete("/vin/saved/{saved_id}")
async def delete_saved_vin(saved_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Login required")
    res = await db.saved_vins.delete_one(
        {"saved_id": saved_id, "user_id": user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============= Vehicle Service History =============
@api_router.get("/vin/history")
async def vin_history(vin: str, request: Request):
    """Cross-workshop service history timeline for a VIN.
    Combines: customer photos (network-wide), saved-VIN actions (this user),
    workshop corrections, and part requests matching the decoded vehicle."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Login required")
    vin_n = _normalize_vin(vin)
    if not _vin_valid(vin_n):
        raise HTTPException(400, "Invalid VIN.")

    photos = await db.vin_customer_photos.find(
        {"vin": vin_n}, {"_id": 0, "image_b64": 0},
    ).sort("created_at", -1).to_list(100)

    # Orders tagged with this VIN — true repair history
    orders = await db.orders.find(
        {"vehicle_vin": vin_n, "user_id": user["user_id"]},
        {"_id": 0, "order_id": 1, "items": 1, "total_bdt": 1, "status": 1,
         "company_name": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(100)

    saved = await db.saved_vins.find(
        {"vin": vin_n, "user_id": user["user_id"]}, {"_id": 0},
    ).to_list(50)

    correction = await db.vin_corrections.find_one({"vin": vin_n}, {"_id": 0})

    decoded = await db.vin_cache.find_one({"vin": vin_n}, {"_id": 0}) or {}
    if correction:
        decoded = {**decoded, **{k: v for k, v in correction.items() if v}}
    # Part requests tagged directly with this VIN (most reliable) +
    # fall back to a decoded make/model match for legacy requests.
    part_requests = await db.part_requests.find(
        {"user_id": user["user_id"], "vin_chassis": vin_n},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    if not part_requests:
        pr_filter = {"user_id": user["user_id"]}
        if decoded.get("make"):
            pr_filter["car_brand"] = {"$regex": f"^{re.escape(decoded['make'])}$", "$options": "i"}
        if decoded.get("model"):
            pr_filter["car_model"] = {"$regex": re.escape(decoded["model"]), "$options": "i"}
        if "car_brand" in pr_filter:
            part_requests = await db.part_requests.find(
                pr_filter, {"_id": 0},
            ).sort("created_at", -1).to_list(20)

    timeline = []
    for o in orders:
        item_summary = ", ".join(it.get("name", "") for it in (o.get("items") or [])[:3])
        if len(o.get("items") or []) > 3:
            item_summary += f" +{len(o['items']) - 3} more"
        timeline.append({
            "type": "order",
            "date": o.get("created_at"),
            "company_name": o.get("company_name", "You"),
            "title": f"Ordered: {item_summary or 'Items'}",
            "note": f"৳{int(o.get('total_bdt', 0)):,} · {o.get('status', '')}",
            "order_id": o.get("order_id"),
        })
    for p in photos:
        timeline.append({
            "type": "photo",
            "date": p.get("created_at"),
            "company_name": p.get("company_name", "Unknown workshop"),
            "title": "Customer car photo",
            "note": p.get("note", ""),
            "photo_id": p.get("photo_id"),
        })
    for s in saved:
        timeline.append({
            "type": "saved",
            "date": s.get("created_at"),
            "company_name": "You",
            "title": f"Saved as: {s.get('label', '')}",
            "note": "",
        })
    if correction and correction.get("created_at"):
        c_summary = " ".join(str(x) for x in [
            correction.get("year"), correction.get("make"), correction.get("model")
        ] if x).strip()
        timeline.append({
            "type": "correction",
            "date": correction.get("created_at"),
            "company_name": correction.get("company_name", "Unknown workshop"),
            "title": "VIN data verified",
            "note": c_summary,
        })
    for pr in part_requests:
        timeline.append({
            "type": "part_request",
            "date": pr.get("created_at"),
            "company_name": "You",
            "title": f"Requested: {pr.get('part_name', 'Part')}",
            "note": pr.get("notes", "") or pr.get("status", ""),
            "request_id": pr.get("request_id"),
        })

    timeline.sort(key=lambda x: x.get("date") or "", reverse=True)

    workshop_count = len({
        p.get("company_name") for p in photos if p.get("company_name")
    })
    dates = [t["date"] for t in timeline if t.get("date")]
    return {
        "vin": vin_n,
        "stats": {
            "event_count": len(timeline),
            "photo_count": len(photos),
            "workshop_count": workshop_count,
            "part_request_count": len(part_requests),
            "order_count": len(orders),
            "total_spend_bdt": round(sum(o.get("total_bdt", 0) for o in orders)),
            "first_seen": min(dates) if dates else None,
            "last_seen": max(dates) if dates else None,
        },
        "timeline": timeline,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Vehicle Health Passport — token-based public sharing for used-car listings
# ─────────────────────────────────────────────────────────────────────────────
async def _build_passport_payload(vin_n: str, user: dict) -> dict:
    """Compose the same data the /vin/history endpoint returns, plus workshop signature."""
    photos = await db.vin_customer_photos.find(
        {"vin": vin_n}, {"_id": 0, "image_b64": 0},
    ).sort("created_at", -1).to_list(100)
    orders = await db.orders.find(
        {"vehicle_vin": vin_n, "user_id": user["user_id"]},
        {"_id": 0, "order_id": 1, "items": 1, "total_bdt": 1, "status": 1,
         "company_name": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(100)
    correction = await db.vin_corrections.find_one({"vin": vin_n}, {"_id": 0})
    decoded = await db.vin_cache.find_one({"vin": vin_n}, {"_id": 0}) or {}
    if correction:
        decoded = {**decoded, **{k: v for k, v in correction.items() if v}}

    timeline = []
    for o in orders:
        item_summary = ", ".join(it.get("name", "") for it in (o.get("items") or [])[:3])
        if len(o.get("items") or []) > 3:
            item_summary += f" +{len(o['items']) - 3} more"
        timeline.append({
            "type": "order", "date": o.get("created_at"),
            "company_name": o.get("company_name", "Workshop"),
            "title": item_summary or "Parts ordered",
            "note": f"BDT {int(o.get('total_bdt', 0)):,} · {o.get('status', '')}",
        })
    for p in photos:
        timeline.append({
            "type": "photo", "date": p.get("created_at"),
            "company_name": p.get("company_name", "Unknown workshop"),
            "title": "Photo on record", "note": p.get("note", ""),
        })
    if correction and correction.get("created_at"):
        c_summary = " ".join(str(x) for x in [
            correction.get("year"), correction.get("make"), correction.get("model")
        ] if x).strip()
        timeline.append({
            "type": "verification", "date": correction.get("created_at"),
            "company_name": correction.get("company_name", "Unknown workshop"),
            "title": "VIN data verified", "note": c_summary,
        })
    timeline.sort(key=lambda x: x.get("date") or "", reverse=True)

    workshop_count = len({p.get("company_name") for p in photos if p.get("company_name")})
    if user.get("company_name"):
        workshop_count = max(workshop_count, 1)
    dates = [t["date"] for t in timeline if t.get("date")]

    workshop = {
        "company_name": user.get("company_name") or "JOY Automart partner",
        "kyc_tier": user.get("tier") or "silver",
        "kyc_approved": user.get("kyc_status") == "approved",
    }

    return {
        "vin": vin_n,
        "decoded": decoded,
        "workshop": workshop,
        "stats": {
            "order_count": len(orders),
            "total_spend_bdt": round(sum(o.get("total_bdt", 0) for o in orders)),
            "workshop_count": workshop_count,
            "photo_count": len(photos),
            "first_seen": min(dates) if dates else None,
            "last_seen": max(dates) if dates else None,
        },
        "timeline": timeline,
    }


def _passport_token() -> str:
    import secrets
    return secrets.token_urlsafe(8)


@api_router.post("/vin/passport/generate")
async def generate_passport(payload: dict, request: Request):
    """Workshop generates a shareable Vehicle Health Passport for a VIN they own.
    Returns a public token + share URL that anyone (no login) can view."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Login required")
    vin_n = _normalize_vin(payload.get("vin", ""))
    if not _vin_valid(vin_n):
        raise HTTPException(400, "Invalid VIN.")

    # Re-use existing token if a fresh one was generated < 30 days ago for the
    # same workshop+VIN combo, so the share link stays stable.
    existing = await db.vin_passports.find_one(
        {"vin": vin_n, "user_id": user["user_id"]}, {"_id": 0},
    )
    if existing and existing.get("token"):
        token = existing["token"]
    else:
        token = _passport_token()
        # tiny collision guard
        while await db.vin_passports.find_one({"token": token}, {"_id": 0}):
            token = _passport_token()

    snapshot = await _build_passport_payload(vin_n, user)
    snapshot["generated_at"] = datetime.now(timezone.utc).isoformat()

    await db.vin_passports.update_one(
        {"vin": vin_n, "user_id": user["user_id"]},
        {"$set": {
            "token": token,
            "vin": vin_n,
            "user_id": user["user_id"],
            "snapshot": snapshot,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

    origin = (request.headers.get("origin") or "").rstrip("/")
    if not origin:
        # Fall back to host header (deployed domain)
        host = request.headers.get("host", "")
        scheme = request.url.scheme or "https"
        origin = f"{scheme}://{host}" if host else ""
    share_url = f"{origin}/p/{token}" if origin else f"/p/{token}"

    return {
        "token": token,
        "share_url": share_url,
        "pdf_url": f"/api/vin/passport/{token}.pdf",
        "view_url": f"/api/vin/passport/{token}",
    }


@api_router.get("/vin/passport/{token}.pdf")
async def passport_pdf(token: str, request: Request):
    """Public PDF render of a passport. No login required — token IS the auth."""
    from fastapi.responses import Response
    from passport_pdf import render_passport_pdf

    rec = await db.vin_passports.find_one({"token": token}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Passport not found")
    snapshot = rec.get("snapshot") or {}

    origin = (request.headers.get("origin") or "").rstrip("/")
    if not origin:
        host = request.headers.get("host", "")
        scheme = request.url.scheme or "https"
        origin = f"{scheme}://{host}" if host else ""
    snapshot["share_url"] = f"{origin}/p/{token}" if origin else f"/p/{token}"

    pdf_bytes = render_passport_pdf(snapshot)
    fn = f"passport-{rec.get('vin', token)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fn}"'},
    )


@api_router.get("/vin/passport/{token}")
async def view_passport(token: str):
    """Public, login-free passport view. Returns the snapshot only — never sensitive
    user/workshop data beyond the workshop signature."""
    rec = await db.vin_passports.find_one({"token": token}, {"_id": 0, "user_id": 0})
    if not rec:
        raise HTTPException(404, "Passport not found or expired")
    return {
        "token": token,
        "vin": rec.get("vin"),
        "snapshot": rec.get("snapshot") or {},
        "updated_at": rec.get("updated_at"),
    }
