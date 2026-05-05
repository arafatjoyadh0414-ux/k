"""VIN lookup → parts finder.

Decoding: NHTSA vPIC API (free, global, covers all vehicles 1981+ from any
manufacturer worldwide). https://vpic.nhtsa.dot.gov/api/

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

NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{vin}?format=json"
CACHE_TTL_DAYS = 30
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")  # standard VIN: no I, O, Q


def _normalize_vin(vin: str) -> str:
    return (vin or "").strip().upper()


def _vin_valid(vin: str) -> bool:
    return bool(VIN_RE.match(vin))


async def _decode_via_nhtsa(vin: str) -> dict:
    """Call NHTSA vPIC. Returns a slim dict suitable for storage + UI."""
    try:
        r = requests.get(NHTSA_URL.format(vin=vin), timeout=10)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.warning(f"NHTSA decode failed for {vin}: {e}")
        raise HTTPException(502, "VIN decoder upstream error. Try again.")
    results = (data.get("Results") or [{}])[0]
    if results.get("ErrorCode") and results["ErrorCode"] not in ("0", "0,0", ""):
        # NHTSA returns partial info even on errors; we still expose what we have.
        pass
    return {
        "vin": vin,
        "make": (results.get("Make") or "").title(),
        "model": (results.get("Model") or "").title(),
        "year": int(results["ModelYear"]) if (results.get("ModelYear") or "").isdigit() else None,
        "body_class": results.get("BodyClass") or "",
        "vehicle_type": results.get("VehicleType") or "",
        "engine_cc": results.get("DisplacementCC") or "",
        "engine_l": results.get("DisplacementL") or "",
        "fuel": results.get("FuelTypePrimary") or "",
        "drive_type": results.get("DriveType") or "",
        "transmission": results.get("TransmissionStyle") or "",
        "trim": results.get("Trim") or "",
        "manufacturer": results.get("Manufacturer") or "",
        "plant_country": results.get("PlantCountry") or "",
        "doors": results.get("Doors") or "",
        "error_code": results.get("ErrorCode") or "",
        "error_text": results.get("ErrorText") or "",
        "decoded_at": datetime.now(timezone.utc).isoformat(),
    }


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

    decoded = await _decode_via_nhtsa(vin)
    # Upsert cache
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
