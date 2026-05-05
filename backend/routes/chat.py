"""AI Assistant chat endpoints (Claude Sonnet 4.5)."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel

from core import api_router, db, require_user, tier_price
from ai_assistant import chat_once


class ChatRequest(BaseModel):
    session_id: str = ""
    message: str


@api_router.post("/chat/message")
async def chat_message(payload: ChatRequest, request: Request):
    user = await require_user(request)
    if not payload.message or not payload.message.strip():
        raise HTTPException(400, "Message required")
    session_id = (payload.session_id or "").strip() or f"chat_{uuid.uuid4().hex[:12]}"

    # Resolve workshop + tier (admin gets read-only assistant view)
    workshop = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    tier = (workshop or {}).get("pricing_tier", "retail")

    # Apply tier pricing on a slim catalog snapshot
    products = await db.products.find(
        {},
        {"_id": 0, "product_id": 1, "sku": 1, "name": 1, "category": 1,
         "price_bdt": 1, "stock": 1, "is_kit": 1, "is_bundle": 1}
    ).to_list(150)
    for p in products:
        p["your_price_bdt"] = tier_price(p["price_bdt"], tier)

    # Recent orders for this user (admins see latest globally)
    if user.get("role") == "admin":
        orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)
    else:
        orders = await db.orders.find(
            {"user_id": user["user_id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(6)

    # Predictive nudges (reorder cadence) — feed to chatbot for proactive suggestions
    reorder_nudges = []
    if user.get("role") != "admin":
        all_orders = await db.orders.find(
            {"user_id": user["user_id"]}, {"_id": 0, "items": 1, "created_at": 1}
        ).sort("created_at", 1).to_list(500)
        sku_dates = {}
        sku_label = {}
        for o in all_orders:
            for it in o.get("items", []):
                sku = it.get("sku")
                if sku:
                    sku_dates.setdefault(sku, []).append(o["created_at"])
                    sku_label[sku] = it.get("name", sku)
        now = datetime.now(timezone.utc)
        for sku, dates in sku_dates.items():
            if len(dates) < 2:
                continue
            try:
                deltas = [
                    (datetime.fromisoformat(dates[i].replace("Z", "+00:00"))
                     - datetime.fromisoformat(dates[i-1].replace("Z", "+00:00"))).days
                    for i in range(1, len(dates))
                ]
                if not deltas:
                    continue
                avg = sum(deltas) / len(deltas)
                last = datetime.fromisoformat(dates[-1].replace("Z", "+00:00"))
                since = (now - last).days
                if avg > 0 and since >= avg * 0.85:
                    reorder_nudges.append({
                        "sku": sku,
                        "name": sku_label.get(sku, sku),
                        "avg_days": round(avg),
                        "days_since_last": since,
                    })
            except Exception:
                pass
        reorder_nudges = sorted(reorder_nudges, key=lambda x: -x["days_since_last"])[:3]

    # Load conversation history
    history = await db.chat_messages.find(
        {"session_id": session_id, "user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)

    # Persist user message
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_one(dict({
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "session_id": session_id,
        "user_id": user["user_id"],
        "role": "user",
        "content": payload.message,
        "created_at": now_iso,
    }))

    # Call Claude
    parsed = await chat_once(
        session_id=session_id,
        user_text=payload.message,
        workshop=workshop,
        tier=tier,
        products=products,
        orders=orders,
        history=history,
        reorder_nudges=reorder_nudges,
    )

    # Validate place_order action against credit & KYC
    safe_actions = []
    for a in parsed.get("actions", []) or []:
        if not isinstance(a, dict) or "type" not in a:
            continue
        if a["type"] == "place_order":
            if not workshop or workshop.get("kyc_status") != "approved":
                continue  # silently drop — show as text only
        safe_actions.append(a)
    parsed["actions"] = safe_actions

    # Persist assistant reply (store full JSON for audit)
    await db.chat_messages.insert_one(dict({
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "session_id": session_id,
        "user_id": user["user_id"],
        "role": "assistant",
        "content": json.dumps({"reply": parsed.get("reply", ""), "actions": safe_actions}),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }))

    return {
        "session_id": session_id,
        "reply": parsed.get("reply", ""),
        "actions": safe_actions,
    }


@api_router.get("/chat/history")
async def chat_history(request: Request, session_id: str):
    user = await require_user(request)
    msgs = await db.chat_messages.find(
        {"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return msgs
