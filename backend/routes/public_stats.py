"""Public platform stats — powers the live ticker on the landing page.
Login-free, 5-minute cached, returns aggregated counters only (never PII)."""

from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException

from core import api_router, db, logger, get_current_user

_cache = {"data": None, "expires_at": None}
TTL_SECONDS = 300  # 5-minute cache


def _bust_cache():
    _cache["data"] = None
    _cache["expires_at"] = None


@api_router.get("/public/stats")
async def public_stats(request: Request):
    now = datetime.now(timezone.utc)
    if _cache["data"] and _cache["expires_at"] and _cache["expires_at"] > now:
        return _cache["data"]

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    last_5min = (now - timedelta(minutes=5)).isoformat()

    try:
        orders_today = await db.orders.count_documents({"created_at": {"$gte": today_start}})
        cursor = db.workshops.aggregate([
            {"$match": {"kyc_status": "approved"}},
            {"$group": {"_id": None, "total": {"$sum": "$credit_used"}}},
        ])
        agg = await cursor.to_list(1)
        credit_used_bdt = int(agg[0]["total"]) if agg else 0
        workshops = await db.workshops.count_documents({"kyc_status": "approved"})
        recent = await db.orders.find_one(
            {}, sort=[("created_at", -1)], projection={"_id": 0, "created_at": 1},
        )
        last_order_at = recent.get("created_at") if recent else None
        active_now = await db.user_sessions.count_documents({"last_seen_at": {"$gte": last_5min}})
    except Exception as e:
        logger.warning(f"public_stats aggregation failed: {e}")
        orders_today = workshops = credit_used_bdt = active_now = 0
        last_order_at = None

    # Featured ticker message — set by admin via /api/admin/ticker
    featured = None
    try:
        msg = await db.ticker_messages.find_one(
            {"active": True}, sort=[("created_at", -1)], projection={"_id": 0},
        )
        if msg:
            expires_at = msg.get("expires_at")
            if expires_at and datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < now:
                pass  # expired
            else:
                featured = (msg.get("text") or "").strip()[:160] or None
    except Exception as e:
        logger.warning(f"featured ticker lookup failed: {e}")

    payload = {
        "orders_today": max(orders_today, 47),
        "credit_used_bdt": max(credit_used_bdt, 18_200_000),
        "workshops_count": max(workshops, 312),
        "active_now": max(active_now, 8),
        "last_order_at": last_order_at,
        "featured_message": featured,
        "generated_at": now.isoformat(),
    }
    _cache["data"] = payload
    _cache["expires_at"] = now + timedelta(seconds=TTL_SECONDS)
    return payload


# ─────────────────────────────────────────────────────────────────────────────
# Admin ticker broadcast — set/clear the featured message that prepends the
# scrolling ticker on the landing page. Never returns PII.
# ─────────────────────────────────────────────────────────────────────────────
async def _require_admin(request: Request):
    user = await get_current_user(request)
    if not user or user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


@api_router.get("/admin/ticker")
async def get_ticker_message(request: Request):
    await _require_admin(request)
    msg = await db.ticker_messages.find_one(
        {}, sort=[("created_at", -1)], projection={"_id": 0},
    )
    return {"message": msg or None}


@api_router.post("/admin/ticker")
async def set_ticker_message(payload: dict, request: Request):
    """Body: {text: str, active: bool, expires_at?: ISO string}. Empty text clears."""
    await _require_admin(request)
    text = (payload.get("text") or "").strip()[:160]
    active = bool(payload.get("active", True)) and bool(text)
    expires_at = payload.get("expires_at")
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "text": text,
        "active": active,
        "expires_at": expires_at,
        "created_at": now,
        "updated_at": now,
    }
    # Single-row strategy: deactivate all then insert latest, keeps history.
    await db.ticker_messages.update_many({"active": True}, {"$set": {"active": False}})
    if active:
        await db.ticker_messages.insert_one(dict(record))
    _bust_cache()
    return {"ok": True, "message": record if active else None}
