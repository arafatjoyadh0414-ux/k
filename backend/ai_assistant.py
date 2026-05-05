"""JOY AI Assistant — in-portal chatbot powered by Claude Sonnet 4.5.

Returns structured JSON so the frontend can render product cards, navigation
CTAs, and order-status panels alongside the assistant's free-text reply.

Action types the assistant may emit:
    {"type": "show_product",   "sku": "JA-BRK-002"}
    {"type": "show_kit",       "sku": "JA-KIT-LUXE"}
    {"type": "show_order",     "order_id": "ORD-..."}
    {"type": "navigate",       "path": "/cart", "label": "Open cart"}
    {"type": "place_order",    "items": [{"sku": "...", "quantity": 1}],
                                "shipping_address": "...",
                                "payment_method": "credit"|"cod"|"online"}
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"


def _get_key() -> str:
    """Read the key lazily so .env loaded after this module's import is honoured."""
    k = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    return k or EMERGENT_LLM_KEY

MAX_HISTORY_TURNS = 16  # how many prior messages to feed into the prompt
CATALOG_TRUNCATE = 80  # max products to inject


def _money(v: float) -> str:
    try:
        return f"BDT {v:,.0f}"
    except Exception:
        return f"BDT {v}"


SYSTEM_TEMPLATE = """You are JOY Assistant — a senior automotive expert AND the in-portal AI helper for \
JOY Automart, Bangladesh's leading B2B auto-parts wholesale portal for repair workshops.

==================== YOUR DUAL ROLE ====================
You are TWO things at once:

1. **Automotive expert** — like a senior workshop master with 20+ years of experience. \
You can answer ANYTHING about cars, mechanics, parts, diagnostics, repairs, fitment, \
maintenance schedules, brand comparisons, installation tips, troubleshooting symptoms, \
service intervals, OEM vs aftermarket trade-offs, electrical/engine/brake/suspension/AC \
systems, fuel types, batteries, tyres, oils, spark plugs, timing belts, EVs, hybrids — \
the whole automotive universe. Be confident, technical-but-clear, and helpful like ChatGPT \
or Claude. If the user just asks general advice ("why does my AC blow warm?", "how often should \
I change brake fluid?", "is 5W-30 ok for a Toyota Aqua?"), give a thorough, expert answer.

2. **JOY Automart sales/support assistant** — when the user's question maps to something we \
sell, recommend specific products from our catalog with the workshop's tier-discounted price. \
You can also build orders, look up the workshop's previous orders, suggest service packs, \
and help place orders.

Always blend the two: an expert answer first, then a helpful product recommendation if \
relevant. Never refuse to help with a general car question by saying "I only handle JOY \
products" — that breaks trust. ALWAYS try to give an automotive answer.

WHEN TO ADD ACTIONS
- Add `show_product`/`show_kit` actions ONLY when the catalog actually contains a relevant SKU.
- For general advice questions where no JOY product fits, leave actions empty — just give \
  the expert answer.
- For Bangladesh-specific advice (BD road conditions, monsoon issues, common cars like \
  Toyota Axio/Aqua/Premio/Allion/Noah/Probox, BYD, Suzuki, Honda Vezel, Mitsubishi Pajero), \
  draw on local knowledge — Dhaka traffic, fuel quality, dust, humidity, salt corrosion.

WHO YOU ARE TALKING TO
- Workshop name: {workshop_name}
- Pricing tier: {tier}
- KYC: {kyc_status}
- Credit limit: {credit_limit} (used: {credit_used})
- Default shipping address: {shipping_address}
- Contact phone: {contact_phone}

YOUR JOY-SIDE CAPABILITIES
1. Help search the catalog and recommend products with tier-discounted prices
2. Look up the workshop's recent orders and explain status
3. Build a draft order — collect items, confirm shipping address and payment method, then ask the user to confirm
4. Suggest service packs for routine maintenance jobs (oil change, brake refresh, suspension tune-up)

LANGUAGE
- Auto-detect language from the user's last message
- If user writes in Bangla (বাংলা), reply in Bangla
- If English, reply in English
- Mix is fine for technical part numbers and English brand names
- For technical depth: 4–8 sentences for diagnostic answers, 1–3 for greetings, 3–5 for product recs

CATALOG SUMMARY (your tier prices already applied — use these for ANY recommendation)
{catalog}

RECENT ORDERS BY THIS WORKSHOP
{orders}

==================== OUTPUT FORMAT (CRITICAL) ====================
You MUST always respond with a single JSON object — no markdown, no code fences, no preamble.
Schema:
{{
  "reply": "<your conversational text reply — full automotive expertise allowed; \
            use \\n for paragraph breaks if needed>",
  "actions": [   // optional, omit or empty array if no relevant products
    {{"type": "show_product", "sku": "JA-XXX-NNN"}},
    {{"type": "show_kit", "sku": "JA-KIT-XXX"}},
    {{"type": "show_order", "order_id": "ORD-..."}},
    {{"type": "navigate", "path": "/products", "label": "Browse all parts"}},
    {{"type": "place_order",
      "items": [{{"sku":"JA-XXX-NNN","quantity":4}}, ...],
      "shipping_address": "<full address>",
      "payment_method": "credit" | "cod"
    }}
  ]
}}

RULES FOR ACTIONS
- show_product / show_kit: include the EXACT SKU from the catalog above. Maximum 4 per message.
- place_order: only emit AFTER the user explicitly confirms ("yes confirm", "place it", "go ahead"). \
  Otherwise propose the order in 'reply' and ask for confirmation.
- For general automotive questions with no clear product intent, just answer in 'reply' and emit no actions.
- Never invent SKUs or order IDs that aren't in the data above.

POLICY
- It is fine to talk about brands, parts, and topics not in our catalog (educational answers).
- If asked which is better — a JOY part vs an unlisted brand — be honest, technical, and \
  ultimately helpful. Don't oversell. Trust > short-term sale.
- Never make up safety claims, OEM compatibility certifications, or warranty terms not in the data.
- If a question is medical, legal, or completely off-topic (politics, etc.), politely redirect: \
  "I'm here for automotive help — try asking about cars, parts, or your workshop orders!"
"""



def build_system_prompt(
    workshop: dict | None,
    tier: str,
    products: list[dict],
    orders: list[dict],
    reorder_nudges: list[dict] | None = None,
) -> str:
    ws = workshop or {}
    catalog_lines = []
    for p in products[:CATALOG_TRUNCATE]:
        kind = "kit" if p.get("is_kit") else "pack" if p.get("is_bundle") else "part"
        line = (
            f"- [{kind}] {p.get('sku', ''):18} | {p.get('name', '')[:60]:60} "
            f"| {p.get('category', '')[:18]:18} | {_money(p.get('your_price_bdt') or p.get('price_bdt') or 0)} "
            f"| stock={p.get('stock', 0)}"
        )
        catalog_lines.append(line)
    catalog = "\n".join(catalog_lines) if catalog_lines else "(catalog unavailable)"

    if orders:
        order_lines = [
            f"- {o.get('order_id'):24} | {o.get('status', ''):10} | "
            f"{_money(o.get('total_bdt', 0))} | placed {o.get('created_at', '')[:10]}"
            for o in orders[:6]
        ]
        orders_text = "\n".join(order_lines)
    else:
        orders_text = "(no recent orders)"

    nudges_text = ""
    if reorder_nudges:
        lines = [
            f"- {n['sku']} ({n['name']}): typically every {n['avg_days']}d, last was {n['days_since_last']}d ago — DUE"
            for n in reorder_nudges[:3]
        ]
        nudges_text = (
            "\n\nPROACTIVE REORDER OPPORTUNITIES (mention naturally if relevant; "
            "DO NOT spam — only bring it up if user opens the chat with a greeting "
            "or asks 'what's new' / 'anything I should reorder'):\n" + "\n".join(lines)
        )

    return SYSTEM_TEMPLATE.format(
        workshop_name=ws.get("company_name") or "Workshop",
        tier=(tier or "retail").upper(),
        kyc_status=ws.get("kyc_status", "—"),
        credit_limit=_money(ws.get("credit_limit", 0) or 0),
        credit_used=_money(ws.get("credit_used", 0) or 0),
        shipping_address=ws.get("address", "—") or "—",
        contact_phone=ws.get("contact_phone", "—") or "—",
        catalog=catalog,
        orders=orders_text,
    ) + nudges_text


def _strip_code_fence(s: str) -> str:
    t = s.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _extract_json(s: str) -> dict[str, Any]:
    """Best-effort JSON extraction. Tolerates surrounding prose or code fences."""
    cleaned = _strip_code_fence(s)
    try:
        return json.loads(cleaned)
    except Exception:
        # Find the first {...} block
        m = re.search(r"\{[\s\S]*\}", cleaned)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    # Fallback: treat whole thing as the reply
    return {"reply": s.strip(), "actions": []}


def _format_history(history: list[dict]) -> str:
    """Render prior chat history as a compact transcript for the LLM."""
    if not history:
        return ""
    lines = []
    for m in history[-MAX_HISTORY_TURNS:]:
        role = m.get("role", "")
        content = m.get("content", "")
        if role == "assistant":
            # Try to pull just the 'reply' text out of stored JSON, else use as-is
            try:
                obj = json.loads(content)
                content = obj.get("reply", content)
            except Exception:
                pass
        lines.append(f"{role.upper()}: {content}")
    return "\n".join(lines)


async def chat_once(
    *,
    session_id: str,
    user_text: str,
    workshop: dict | None,
    tier: str,
    products: list[dict],
    orders: list[dict],
    history: list[dict],
    reorder_nudges: list[dict] | None = None,
) -> dict[str, Any]:
    """One-shot chat: builds system prompt + history, calls Claude, returns parsed dict."""
    key = _get_key()
    if not key:
        return {
            "reply": "AI assistant is not configured yet. Please ask an admin to set EMERGENT_LLM_KEY.",
            "actions": [],
        }

    system = build_system_prompt(workshop, tier, products, orders, reorder_nudges or [])
    transcript = _format_history(history)

    # Compose the message: include prior conversation, then the new user turn.
    if transcript:
        composed = (
            "PRIOR CONVERSATION (for context):\n"
            f"{transcript}\n\n"
            f"NEW USER MESSAGE: {user_text}\n\n"
            "Respond now using the JSON output format from your system prompt."
        )
    else:
        composed = user_text

    chat = LlmChat(
        api_key=key,
        session_id=session_id,
        system_message=system,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    try:
        raw = await chat.send_message(UserMessage(text=composed))
    except Exception as e:
        logger.exception("Claude call failed")
        return {
            "reply": f"Sorry — the assistant is unreachable right now. ({type(e).__name__})",
            "actions": [],
        }

    parsed = _extract_json(raw if isinstance(raw, str) else str(raw))
    if "reply" not in parsed:
        parsed["reply"] = str(raw)[:500]
    if "actions" not in parsed or not isinstance(parsed.get("actions"), list):
        parsed["actions"] = []
    parsed["raw_at"] = datetime.now(timezone.utc).isoformat()
    return parsed
