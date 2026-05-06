"""Visual Parts Search — upload broken/damaged part photo, identify it via
Claude Sonnet 4.5 vision, then match against the JOY catalog.

POST /api/visual-search    multipart-form { image: file, hint?: text }
"""

import base64
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request, UploadFile, File, Form

from core import api_router, db, logger, require_user, tier_price
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


VISUAL_PROMPT = """You are JOY Vision — an expert automotive parts identifier for a Bangladesh B2B parts platform.

The user has uploaded a photo of an automotive part (often broken, dirty, or worn). Your job:

1. Identify what the part is — be specific (e.g. "Front brake disc rotor", not just "rotor").
2. Identify likely category from this set: Brake, Suspension, Engine, Electrical, Lighting, Body, Filter, Cooling, Transmission, Exhaust, Tyres, Audio, Tools, Other.
3. Extract any visible identifiers — OEM numbers, part numbers, brand, manufacturer code.
4. Suggest 2-4 likely brands/manufacturers (Toyota OEM, Brembo, Bosch, NGK, Denso, etc.).
5. Provide a confidence score 0.0–1.0.
6. Provide search keywords (3-6 lowercase keywords) the platform should use to find a replacement in catalog.
7. Generate 3-6 short Bengali/English search keywords mixing English part terms with Bangladeshi workshop slang where applicable.

Return STRICT JSON only — no prose around it. Schema:
{
  "part_name": "string",
  "category": "string",
  "confidence": 0.0,
  "visible_identifiers": ["string"],
  "likely_brands": ["string"],
  "search_keywords": ["string"],
  "condition_assessment": "string (1-2 sentences on damage/wear visible)",
  "replacement_advice": "string (1-2 sentences — replace pair? whole assembly?)"
}
"""


@api_router.post("/visual-search")
async def visual_search(
    request: Request,
    image: UploadFile = File(...),
    hint: Optional[str] = Form(None),
):
    user = await require_user(request)
    if user.get("role") == "admin":
        # Admins can also use it for catalogue research
        pass

    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Vision service not configured")

    # Validate upload
    if image.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported image type: {image.content_type}")
    body = await image.read()
    if len(body) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 6 MB)")
    if len(body) < 1024:
        raise HTTPException(400, "Image too small")

    img_b64 = base64.b64encode(body).decode("ascii")

    session_id = f"vis_{uuid.uuid4().hex[:10]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=VISUAL_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_text = "Identify this part."
    if hint and hint.strip():
        user_text += f" User hint: {hint.strip()[:200]}"

    msg = UserMessage(
        text=user_text,
        file_contents=[ImageContent(image_base64=img_b64)],
    )

    try:
        raw = await chat.send_message(msg)
    except Exception as e:
        logger.error(f"visual-search LLM call failed: {e}")
        raise HTTPException(502, f"Vision service error: {e}")

    # Parse JSON (strip code fences if present)
    cleaned = (raw or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE)
    m = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    parsed: dict = {}
    if m:
        try:
            parsed = json.loads(m.group(0))
        except Exception as e:  # noqa
            logger.warning(f"visual-search JSON parse failed: {e}; raw={raw[:200]}")

    if not parsed.get("part_name"):
        # Fallback: still return raw text so the frontend can render something
        parsed = {
            "part_name": "Unidentified part",
            "category": "Other",
            "confidence": 0.0,
            "visible_identifiers": [],
            "likely_brands": [],
            "search_keywords": [],
            "condition_assessment": (raw or "")[:300],
            "replacement_advice": "",
        }

    # Catalog match — keyword OR + tier pricing
    keywords = [k for k in (parsed.get("search_keywords") or []) if k] or [parsed["part_name"]]
    workshop = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0, "pricing_tier": 1})
    if not workshop:
        workshop = await db.workshops.find_one(
            {"member_user_ids": user["user_id"]}, {"_id": 0, "pricing_tier": 1}
        )
    tier = (workshop or {}).get("pricing_tier", "retail")

    matches: list = []
    seen_skus: set = set()
    # Try category-first then keyword search
    cat = parsed.get("category")
    if cat and cat != "Other":
        async for p in db.products.find(
            {"category": {"$regex": f"^{re.escape(cat)}$", "$options": "i"}},
            {"_id": 0, "product_id": 1, "sku": 1, "name": 1, "category": 1, "brand": 1,
             "image_url": 1, "price_bdt": 1, "moq": 1, "stock": 1, "description": 1},
        ).limit(8):
            if p["sku"] in seen_skus:
                continue
            seen_skus.add(p["sku"])
            matches.append(p)
    # Now keyword scan
    for kw in keywords[:6]:
        if not kw or len(kw) < 2:
            continue
        kw_re = {"$regex": re.escape(kw), "$options": "i"}
        async for p in db.products.find(
            {"$or": [{"name": kw_re}, {"description": kw_re}, {"brand": kw_re}, {"sku": kw_re}]},
            {"_id": 0, "product_id": 1, "sku": 1, "name": 1, "category": 1, "brand": 1,
             "image_url": 1, "price_bdt": 1, "moq": 1, "stock": 1, "description": 1},
        ).limit(6):
            if p["sku"] in seen_skus:
                continue
            seen_skus.add(p["sku"])
            matches.append(p)
            if len(matches) >= 12:
                break
        if len(matches) >= 12:
            break

    # Apply tier pricing on each match
    for m_ in matches:
        retail = float(m_.get("price_bdt", 0))
        m_["retail_price_bdt"] = retail
        m_["your_price_bdt"] = tier_price(retail, tier)
        m_["your_tier"] = tier
        m_.pop("description", None)  # keep payload light

    # Persist for analytics
    try:
        await db.visual_searches.insert_one({
            "search_id": session_id,
            "user_id": user["user_id"],
            "image_size_bytes": len(body),
            "hint": hint or None,
            "result": parsed,
            "match_count": len(matches),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:  # noqa
        logger.info(f"visual-search log skipped: {e}")

    return {
        "search_id": session_id,
        "identification": parsed,
        "matches": matches[:12],
        "tier": tier,
    }
