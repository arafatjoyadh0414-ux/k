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

from core import api_router, db, logger, EMERGENT_LLM_KEY, get_current_user, tier_price
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


async def _decode_full(vin: str) -> dict:
    """Multi-source decode chain. Always returns a dict — never raises
    on partial data. The dict is suitable to be cached + returned."""
    nhtsa = await _decode_via_nhtsa(vin)
    wmi = lookup_wmi(vin)
    year_from_code = decode_year(vin)

    # Build base from NHTSA + WMI fallback
    decoded = {
        "vin": vin,
        "make": nhtsa["make"] or wmi.get("make", "").split(" / ")[0].title(),
        "model": nhtsa["model"],
        "year": int(nhtsa["year_str"]) if nhtsa["year_str"].isdigit() else year_from_code,
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
        "error_code": nhtsa["error_code"],
        "error_text": nhtsa["error_text"],
        "decoded_at": datetime.now(timezone.utc).isoformat(),
        "sources": ["nhtsa" if (nhtsa["make"] or nhtsa["model"]) else None,
                    "wmi" if wmi else None,
                    "year_code" if year_from_code else None],
    }
    decoded["sources"] = [s for s in decoded["sources"] if s]

    # AI augmentation: only when we have make+year but missing model/engine/body
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

    # Soften the error message when WMI gave us useful fallback data
    if decoded["error_code"] and decoded["make"]:
        decoded["error_text"] = f"NHTSA partial decode (used WMI fallback): {decoded['error_text']}"

    return decoded


@api_router.get("/vin/decode")
async def vin_decode(vin: str):
    vin = _normalize_vin(vin)
    if not _vin_valid(vin):
        raise HTTPException(400, "Invalid VIN. Must be 17 chars, A-Z (no I/O/Q) and digits.")

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
