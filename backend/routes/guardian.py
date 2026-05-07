"""Public AI Guardian Bot — answers car-related questions for any visitor
(no auth required). Distinct from the authenticated /chat endpoint which is
tied to the workshop/dealer's catalogue + orders.

The Guardian Bot is a generalist automotive expert: maintenance, diagnostics,
parts compatibility, tyres, batteries, fluids, model differences, common
issues, BD-specific market context (LRP, BRTA, fuel quality), and gentle
hand-offs to JOY Automart's catalogue when a part is needed.

Uses the same Claude Sonnet 4.5 model via the Emergent LLM key.
Rate-limited by visitor session (in-memory) to prevent abuse.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel

from core import api_router, db
from emergentintegrations.llm.chat import LlmChat, UserMessage

import os

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"

# Per-session rate limit (in-memory) — best-effort soft guard, not security
_RATE: dict[str, list[float]] = {}
_RATE_WINDOW_S = 60
_RATE_MAX = 8  # max 8 messages per minute per session


def _allow(session_id: str) -> bool:
    now = time.time()
    bucket = _RATE.setdefault(session_id, [])
    # Drop entries older than the window
    while bucket and now - bucket[0] > _RATE_WINDOW_S:
        bucket.pop(0)
    if len(bucket) >= _RATE_MAX:
        return False
    bucket.append(now)
    return True


SYSTEM_PROMPT = """You are JOY Guardian — a friendly, expert automotive assistant
for visitors to JOY Automart, Bangladesh's first AI-powered auto parts platform.

Your job is to answer ANY car-related question accurately, concisely, and in
plain English (or Bengali if the user writes in Bengali). You are warm,
unpretentious, and direct — like a senior technician who genuinely wants to
help, not a salesperson.

WHAT YOU HELP WITH (be confident here):
- Symptom-to-cause diagnostics (e.g. "AC blowing warm air", "knocking on
  startup", "vibration at 80 km/h", "battery drains overnight")
- Maintenance schedules, fluid intervals, brake-pad life, timing belt vs
  chain advice, tyre wear patterns
- Parts compatibility — which engine code / chassis / year takes which part
- Battery sizing (CCA, group), tyre sizing/load index/speed rating
- Engine oil grade selection (viscosity, API/ACEA spec) for BD climate
- Common issues by model (Toyota Allion, Premio, Axio, Probox, Noah, Voxy,
  Harrier, Fielder; Honda Vezel, Grace, Civic; Nissan X-Trail, Sunny, Bluebird;
  Mitsubishi Outlander, Pajero; BYD Sealion 6, Atto 3; Suzuki Swift, Alto;
  Hyundai Creta, Tucson; Kia Sportage; Mazda Demio; Land Rover Range Rover Sport)
- BD-specific context: LRP (Liquid Recycled Particulate) fuel quality,
  monsoon-season prep, BRTA fitness inspections, customs/import nuances for
  reconditioned (recon) vs brand-new vehicles, AC overhaul costs in Dhaka
- Workshop quote sanity-checks (e.g. "is BDT 18,000 fair for a Toyota Vitz
  full brake-pad set + machining?")

HAND-OFFS (be helpful, never pushy):
- If the user needs a specific part, mention that JOY Automart stocks 1000+
  verified SKUs and they can search the catalogue or submit a part request.
- For complex jobs (engine rebuild, transmission overhaul, EV battery work),
  recommend they book through a JOY-verified workshop.
- For body kits, JOY BEAST is the in-house atelier (Cyber Beast, Shadow GT,
  Beast Wide Body, Custom Atelier).

RULES:
- NEVER invent part numbers or prices. If asked, say "verify on the catalogue".
- NEVER give medical, legal or financial advice.
- If a question is genuinely unrelated to cars, vehicles, mobility or the
  automotive industry, politely redirect: "I'm focused on cars and the
  automotive trade — happy to help with anything in that space."
- If the user writes Bengali (Bangla script), reply in Bengali. If they
  write English with Banglish words, reply in English with Banglish where
  natural. If they write only English, reply in English.
- Keep replies under 180 words unless the user explicitly asks for detail.
- Use bullet points for lists, plain prose for diagnostics. No markdown
  headers, no emoji-spam. One subtle emoji at most per reply (optional).

You speak with calm authority and zero corporate fluff. You are JOY Guardian.
"""


class GuardianRequest(BaseModel):
    session_id: Optional[str] = ""
    message: str


@api_router.post("/guardian/message")
async def guardian_message(payload: GuardianRequest, request: Request):
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
            "reply": "Guardian is not configured yet. Please contact JOY Automart support.",
        }

    # Pull short history (last 8 turns) for this guardian session so the bot
    # has context across the visitor's conversation.
    history = await db.guardian_messages.find(
        {"session_id": session_id},
        {"_id": 0, "role": 1, "content": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(16)

    transcript = ""
    if history:
        lines = []
        for h in history[-12:]:
            who = "User" if h.get("role") == "user" else "Guardian"
            lines.append(f"{who}: {h.get('content', '').strip()}")
        transcript = "PRIOR CONVERSATION:\n" + "\n".join(lines) + "\n\n"

    composed = f"{transcript}NEW USER MESSAGE: {payload.message.strip()}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    try:
        raw = await chat.send_message(UserMessage(text=composed))
    except Exception as e:
        logger.exception("Guardian Claude call failed")
        return {
            "session_id": session_id,
            "reply": f"Sorry — Guardian is unreachable right now ({type(e).__name__}). Please try again in a moment.",
        }

    reply_text = raw if isinstance(raw, str) else str(raw)
    reply_text = reply_text.strip()

    # Persist for future turns + analytics (no PII captured)
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.guardian_messages.insert_many([
            {
                "session_id": session_id,
                "role": "user",
                "content": payload.message.strip()[:1500],
                "created_at": now,
            },
            {
                "session_id": session_id,
                "role": "assistant",
                "content": reply_text[:6000],
                "created_at": now,
            },
        ])
    except Exception:
        logger.exception("guardian: failed to persist messages (non-fatal)")

    return {"session_id": session_id, "reply": reply_text}


@api_router.get("/guardian/history")
async def guardian_history(session_id: str):
    if not session_id or not session_id.strip():
        raise HTTPException(400, "session_id required")
    msgs = await db.guardian_messages.find(
        {"session_id": session_id.strip()},
        {"_id": 0, "role": 1, "content": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(50)
    return {"session_id": session_id.strip(), "messages": msgs}
