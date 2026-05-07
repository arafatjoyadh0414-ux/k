"""Genius (AI Assistant) analytics.

Aggregates `chat_messages` data for an admin observability dashboard:
- Total sessions, user messages, assistant replies
- Actions surfaced (Add to cart / Reorder / View order chips)
- Action-click rate (requires action-click logs)
- Top user questions (most-asked patterns)
- Daily volume

Public action-click logging (auth required for chat session continuity):
    POST /api/chat/action-click — body: {session_id, action_type, action_label}

Admin:
    GET  /api/admin/genius-analytics?days=N
"""

import json
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

from core import api_router, db, require_admin, require_user


# ============= Models =============
class ActionClickIn(BaseModel):
    session_id: str = Field(..., max_length=80)
    action_type: str = Field(..., max_length=40)  # add_to_cart | view_order | reorder
    action_label: str | None = Field(default=None, max_length=120)
    product_id: str | None = Field(default=None, max_length=80)


# ============= Public (auth): log an action click =============
@api_router.post("/chat/action-click")
async def log_action_click(payload: ActionClickIn, request: Request):
    """Log when a user taps a Genius action chip — powers click-rate analytics."""
    user = await require_user(request)
    doc = {
        "click_id": str(uuid.uuid4()),
        "session_id": payload.session_id[:80],
        "user_id": user["user_id"],
        "action_type": payload.action_type[:40],
        "action_label": (payload.action_label or "")[:120],
        "product_id": (payload.product_id or "")[:80] or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.genius_action_clicks.insert_one(doc)
    except Exception:
        return {"ok": False}
    return {"ok": True, "click_id": doc["click_id"]}


# ============= Admin: aggregated analytics =============
def _normalize_question(text: str) -> str:
    """Light normalization for grouping similar questions."""
    return " ".join((text or "").strip().lower().split())[:120]


@api_router.get("/admin/genius-analytics")
async def admin_genius_analytics(request: Request, days: int = 30):
    """Aggregate dashboard data for the Mr Genius AI assistant."""
    await require_admin(request)
    days = max(1, min(int(days or 30), 365))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    base = {"created_at": {"$gte": cutoff}}

    total_messages = await db.chat_messages.count_documents(base)
    if total_messages == 0:
        return {
            "window_days": days,
            "total_messages": 0,
            "total_user_messages": 0,
            "total_assistant_replies": 0,
            "total_sessions": 0,
            "unique_users": 0,
            "actions_surfaced": 0,
            "actions_clicked": 0,
            "click_rate": 0.0,
            "top_questions": [],
            "daily_volume": [],
            "actions_by_type": [],
        }

    user_msg_count = await db.chat_messages.count_documents({**base, "role": "user"})
    asst_msg_count = await db.chat_messages.count_documents({**base, "role": "assistant"})
    sessions = await db.chat_messages.distinct("session_id", base)
    unique_users = await db.chat_messages.distinct("user_id", base)

    # Count actions surfaced — parse the JSON content of assistant messages
    asst_messages = await db.chat_messages.find(
        {**base, "role": "assistant"}, {"_id": 0, "content": 1, "created_at": 1}
    ).to_list(5000)
    actions_surfaced = 0
    actions_by_type_counter: Counter = Counter()
    for m in asst_messages:
        try:
            parsed = json.loads(m.get("content") or "{}")
            for a in parsed.get("actions") or []:
                actions_surfaced += 1
                actions_by_type_counter[a.get("type", "unknown")] += 1
        except Exception:
            continue

    # Action clicks
    actions_clicked = await db.genius_action_clicks.count_documents(base)
    click_rate = round(actions_clicked / actions_surfaced, 4) if actions_surfaced else 0.0

    # Top user questions (group normalized first 80 chars)
    user_messages = await db.chat_messages.find(
        {**base, "role": "user"}, {"_id": 0, "content": 1}
    ).to_list(5000)
    q_counter: Counter = Counter()
    sample_map: dict = {}
    for m in user_messages:
        norm = _normalize_question(m.get("content") or "")
        if not norm or len(norm) < 4:
            continue
        q_counter[norm] += 1
        if norm not in sample_map:
            sample_map[norm] = (m.get("content") or "").strip()[:140]
    top_questions = [
        {"query": sample_map[norm], "query_norm": norm, "count": c}
        for norm, c in q_counter.most_common(20)
    ]

    # Daily volume — total messages per day
    daily_pipeline = [
        {"$match": base},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "day": "$_id", "count": 1}},
    ]
    daily_volume = await db.chat_messages.aggregate(daily_pipeline).to_list(400)

    actions_by_type = [
        {"type": t, "count": c} for t, c in actions_by_type_counter.most_common(10)
    ]

    return {
        "window_days": days,
        "total_messages": total_messages,
        "total_user_messages": user_msg_count,
        "total_assistant_replies": asst_msg_count,
        "total_sessions": len(sessions),
        "unique_users": len(unique_users),
        "actions_surfaced": actions_surfaced,
        "actions_clicked": actions_clicked,
        "click_rate": click_rate,
        "top_questions": top_questions,
        "daily_volume": daily_volume,
        "actions_by_type": actions_by_type,
    }
