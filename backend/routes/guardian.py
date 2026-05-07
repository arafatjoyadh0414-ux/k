"""Public AI Genius Assistant — answers anything car-related for any
visitor, AND becomes context-aware when the user is authenticated
(injects workshop tier, recent orders and a slim catalogue snapshot
into the system prompt so it can answer "where's my last order?",
"show me brake pads", etc.).

The same Claude Sonnet 4.5 model serves the public Genius and the
authenticated portal Genius — one bot, one brain, scaled by context.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel

from core import api_router, db, get_current_user, tier_price
from emergentintegrations.llm.chat import LlmChat, UserMessage

import os

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"

_RATE: dict[str, list[float]] = {}
_RATE_WINDOW_S = 60
_RATE_MAX = 12  # max 12 messages per minute per session


def _allow(session_id: str) -> bool:
    now = time.time()
    bucket = _RATE.setdefault(session_id, [])
    while bucket and now - bucket[0] > _RATE_WINDOW_S:
        bucket.pop(0)
    if len(bucket) >= _RATE_MAX:
        return False
    bucket.append(now)
    return True


PUBLIC_PROMPT = """You are JOY Genius — JOY Automart's flagship AI automotive
assistant. You answer ANY car-related question for visitors with calm
authority, technical accuracy and warmth.

Your scope (be confident, lead with the answer):
- Symptom→cause diagnostics for any common issue (AC warm, vibration,
  drained battery, knocking, rough idle, EPS lights, etc.)
- Maintenance schedules, fluid intervals, brake-pad life, timing belt vs
  chain, tyre wear patterns
- Parts compatibility — engine codes, chassis, year-specific advice
- Battery sizing (CCA, group), tyre sizing/load index/speed rating
- Engine-oil grade selection (viscosity, API/ACEA spec) for BD climate
- Common issues by model (Toyota Allion, Premio, Axio, Probox, Noah, Voxy,
  Harrier, Vitz, Aqua, Fielder; Honda Vezel, Grace, Civic, Fit; Nissan
  X-Trail, Sunny, Bluebird, March; Mitsubishi Outlander, Pajero; BYD
  Sealion 6, Atto 3; Suzuki Swift, Alto; Hyundai Creta, Tucson; Kia
  Sportage; Mazda Demio, Axela; Land Rover Range Rover Sport; Tesla,
  Mercedes, BMW, Audi where relevant)
- BD market context: LRP fuel quality, monsoon prep, BRTA fitness,
  customs/import for recon vehicles, AC overhaul cost benchmarks in Dhaka
- World market context: EV transition trends, hybrid maintenance, OEM vs
  aftermarket strategies, latest tyre/oil tech worldwide
- Quote sanity-checks for BD workshops

HAND-OFFS (helpful, never pushy):
- For specific parts: "JOY Automart stocks 1000+ verified SKUs — search
  the catalogue or submit a part request."
- For body kits: route to JOY BEAST atelier (Cyber Beast, Shadow GT,
  Beast Wide Body, Custom Atelier).
- For complex jobs: recommend a JOY-verified workshop.

RULES:
- Never invent part numbers or specific BDT prices. If asked, say "verify
  on the catalogue".
- If the user writes Bengali (Bangla script), reply in Bengali.
- Keep replies under 200 words unless the user asks for detail.
- Use bullet points for lists, plain prose for diagnostics.
- No markdown headers. Maximum one subtle emoji per reply.
- If a question is genuinely unrelated to cars/automotive/mobility,
  politely redirect: "I'm focused on cars and the automotive trade —
  happy to help with anything in that space."

You speak with the confidence of a senior technician who genuinely wants
to help. You are JOY Genius."""


def _build_authenticated_prompt(workshop: dict, tier: str, orders: list[dict], products: list[dict]) -> str:
    """Augment the public prompt with the signed-in user's portal context
    so JOY Genius can answer 'where is my last order?', 'show brake pads',
    'what's my available credit?', etc."""
    ws_name = (workshop or {}).get("name") or "your workshop"
    credit_limit = (workshop or {}).get("credit_limit_bdt", 0)
    credit_used = (workshop or {}).get("credit_used_bdt", 0)
    available = max(0, credit_limit - credit_used)

    order_lines = []
    for o in orders[:6]:
        order_lines.append(
            f"  - {o.get('order_number') or o.get('order_id', '')[:8]} · status={o.get('status', '')} · "
            f"total=BDT {o.get('total_bdt', 0):,.0f} · {o.get('created_at', '')[:10]}"
        )
    orders_block = "\n".join(order_lines) if order_lines else "  (no orders yet)"

    catalogue_lines = []
    for p in products[:60]:
        nm = p.get("name", "")[:60]
        catalogue_lines.append(
            f"  - SKU {p.get('sku', '')} · {nm} · {p.get('category', '')} · "
            f"your-price BDT {p.get('your_price_bdt', 0):,.0f} · stock={p.get('stock', 0)}"
        )
    catalogue_block = "\n".join(catalogue_lines) if catalogue_lines else "  (catalogue empty)"

    return PUBLIC_PROMPT + f"""

— PORTAL CONTEXT (this user is signed in) —
Workshop: {ws_name}
Pricing tier: {tier}
Credit: BDT {available:,.0f} available of BDT {credit_limit:,.0f} limit (BDT {credit_used:,.0f} used)

Recent orders:
{orders_block}

Catalogue snapshot (top {min(60, len(products))} products with this user's tier price):
{catalogue_block}

When the user asks about THEIR orders, credit, or specific catalogue
items, USE the data above. Reference order numbers, SKUs and tier prices
verbatim. For credit queries, give the exact available figure. Never
hallucinate prices or stock counts that aren't in the snapshot — say
"check the catalogue page for the latest" if asked about something
outside the snapshot."""


class GeniusRequest(BaseModel):
    session_id: Optional[str] = ""
    message: str


@api_router.post("/guardian/message")
async def guardian_message(payload: GeniusRequest, request: Request):
    if not payload.message or not payload.message.strip():
        raise HTTPException(400, "Message required")
    if len(payload.message) > 1500:
        raise HTTPException(400, "Message too long — please keep it under 1500 characters.")

    session_id = (payload.session_id or "").strip() or f"grd_{uuid.uuid4().hex[:12]}"
    if not _allow(session_id):
        raise HTTPException(429, "Too many messages. Please wait a moment before asking again.")

    if not EMERGENT_LLM_KEY:
        return {
            "session_id": session_id,
            "reply": "JOY Genius is not configured yet. Please contact JOY Automart support.",
        }

    # Try to detect signed-in user (silent if unauthenticated)
    user = await get_current_user(request)
    system = PUBLIC_PROMPT
    if user:
        try:
            workshop = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
            tier = workshop.get("pricing_tier", "retail")
            orders = await db.orders.find(
                {"user_id": user["user_id"]}, {"_id": 0}
            ).sort("created_at", -1).to_list(6)
            products = await db.products.find(
                {}, {"_id": 0, "product_id": 1, "sku": 1, "name": 1, "category": 1,
                     "price_bdt": 1, "stock": 1, "is_kit": 1}
            ).to_list(60)
            for p in products:
                p["your_price_bdt"] = tier_price(p.get("price_bdt", 0), tier)
            system = _build_authenticated_prompt(workshop, tier, orders, products)
        except Exception:
            logger.exception("genius: failed to build authenticated context (falling back to public)")
            system = PUBLIC_PROMPT

    # Pull short history for this genius session
    history = await db.guardian_messages.find(
        {"session_id": session_id},
        {"_id": 0, "role": 1, "content": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(16)

    transcript = ""
    if history:
        lines = []
        for h in history[-12:]:
            who = "User" if h.get("role") == "user" else "Genius"
            lines.append(f"{who}: {h.get('content', '').strip()}")
        transcript = "PRIOR CONVERSATION:\n" + "\n".join(lines) + "\n\n"

    composed = f"{transcript}NEW USER MESSAGE: {payload.message.strip()}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    try:
        raw = await chat.send_message(UserMessage(text=composed))
    except Exception as e:
        logger.exception("Genius Claude call failed")
        return {
            "session_id": session_id,
            "reply": f"Sorry — JOY Genius is unreachable right now ({type(e).__name__}). Please try again in a moment.",
        }

    reply_text = (raw if isinstance(raw, str) else str(raw)).strip()

    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.guardian_messages.insert_many([
            {"session_id": session_id, "role": "user",
             "content": payload.message.strip()[:1500], "created_at": now,
             "user_id": (user or {}).get("user_id")},
            {"session_id": session_id, "role": "assistant",
             "content": reply_text[:6000], "created_at": now,
             "user_id": (user or {}).get("user_id")},
        ])
    except Exception:
        logger.exception("genius: failed to persist messages (non-fatal)")

    return {
        "session_id": session_id,
        "reply": reply_text,
        "authenticated": bool(user),
    }


@api_router.get("/guardian/history")
async def guardian_history(session_id: str):
    if not session_id or not session_id.strip():
        raise HTTPException(400, "session_id required")
    msgs = await db.guardian_messages.find(
        {"session_id": session_id.strip()},
        {"_id": 0, "role": 1, "content": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(50)
    return {"session_id": session_id.strip(), "messages": msgs}
