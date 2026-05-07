"""Search-intent capture & analytics.

Logs every public catalog search query into `public_search_logs` for
demand-discovery insights. Anonymous-friendly: stores a hashed IP for
deduplication only — never the raw IP. Powers the admin "Search
Intelligence" dashboard (top queries, zero-result queries, daily volume).

Public:
    POST /api/public/search-log     — fire-and-forget log endpoint

Admin:
    GET  /api/admin/search-analytics — top queries, zero-results, time-series
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

from core import api_router, db, require_admin


# ============= Models =============
class SearchLogIn(BaseModel):
    query: str = Field(..., max_length=120)
    source: str = Field(default="landing", max_length=40)  # landing|catalog|header|mobile-rail
    hit_count: int = 0
    clicked_sku: str | None = None  # optional — set when user clicks a result


def _hash_ip(ip: str) -> str:
    """Salted SHA-256 of client IP — for deduplication, never reversible."""
    if not ip:
        return ""
    return hashlib.sha256(f"joy-search-salt::{ip}".encode("utf-8")).hexdigest()[:16]


def _normalize_query(q: str) -> str:
    """Trim + lowercase + collapse whitespace — for grouping similar queries."""
    return " ".join((q or "").strip().lower().split())


# ============= Public: log a search =============
@api_router.post("/public/search-log")
async def log_public_search(payload: SearchLogIn, request: Request):
    """Fire-and-forget search-intent capture. Frontend should NOT block on this."""
    q = (payload.query or "").strip()
    if not q or len(q) < 2:
        return {"ok": True, "skipped": "too_short"}

    client_ip = request.client.host if request.client else ""
    doc = {
        "log_id": str(uuid.uuid4()),
        "query": q[:120],
        "query_norm": _normalize_query(q)[:120],
        "source": (payload.source or "landing")[:40],
        "hit_count": int(payload.hit_count or 0),
        "zero_result": int(payload.hit_count or 0) == 0,
        "clicked_sku": (payload.clicked_sku or "")[:80] or None,
        "ip_hash": _hash_ip(client_ip),
        "user_agent": (request.headers.get("user-agent") or "")[:200],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.public_search_logs.insert_one(doc)
    except Exception:
        # Never fail the user request because of analytics
        return {"ok": False}
    return {"ok": True, "log_id": doc["log_id"]}


# ============= Admin: analytics dashboard =============
@api_router.get("/admin/search-analytics")
async def admin_search_analytics(request: Request, days: int = 30):
    """Aggregate dashboard data:
      - total_logs         : total search events in window
      - unique_queries     : distinct normalized queries
      - unique_visitors    : distinct ip_hash count (rough)
      - zero_result_rate   : 0..1
      - top_queries        : [{query, count, zero_result_count, sample_clicked_sku}]
      - zero_result_queries: top zero-hit demand signals (hot leads for sourcing)
      - daily_volume       : [{day:YYYY-MM-DD, count}]
      - by_source          : [{source, count}]
    """
    await require_admin(request)
    days = max(1, min(int(days or 30), 365))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    base = {"created_at": {"$gte": cutoff}}

    total_logs = await db.public_search_logs.count_documents(base)
    if total_logs == 0:
        return {
            "window_days": days,
            "total_logs": 0,
            "unique_queries": 0,
            "unique_visitors": 0,
            "zero_result_rate": 0.0,
            "top_queries": [],
            "zero_result_queries": [],
            "daily_volume": [],
            "by_source": [],
        }

    zero_count = await db.public_search_logs.count_documents({**base, "zero_result": True})
    unique_queries = len(await db.public_search_logs.distinct("query_norm", base))
    unique_visitors = len(await db.public_search_logs.distinct("ip_hash", base))

    # Top queries by frequency
    top_pipeline = [
        {"$match": base},
        {
            "$group": {
                "_id": "$query_norm",
                "count": {"$sum": 1},
                "zero_count": {"$sum": {"$cond": ["$zero_result", 1, 0]}},
                "sample_query": {"$first": "$query"},
                "sample_clicked_sku": {"$first": "$clicked_sku"},
                "last_seen": {"$max": "$created_at"},
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 25},
        {
            "$project": {
                "_id": 0,
                "query": "$sample_query",
                "query_norm": "$_id",
                "count": 1,
                "zero_result_count": "$zero_count",
                "sample_clicked_sku": 1,
                "last_seen": 1,
            }
        },
    ]
    top_queries = await db.public_search_logs.aggregate(top_pipeline).to_list(25)

    # Zero-result demand signals — what visitors want but we don't carry
    zero_pipeline = [
        {"$match": {**base, "zero_result": True}},
        {
            "$group": {
                "_id": "$query_norm",
                "count": {"$sum": 1},
                "sample_query": {"$first": "$query"},
                "last_seen": {"$max": "$created_at"},
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 25},
        {
            "$project": {
                "_id": 0,
                "query": "$sample_query",
                "query_norm": "$_id",
                "count": 1,
                "last_seen": 1,
            }
        },
    ]
    zero_result_queries = await db.public_search_logs.aggregate(zero_pipeline).to_list(25)

    # Daily volume — slice ISO timestamp's first 10 chars (YYYY-MM-DD)
    daily_pipeline = [
        {"$match": base},
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "day": "$_id", "count": 1}},
    ]
    daily_volume = await db.public_search_logs.aggregate(daily_pipeline).to_list(400)

    # By source
    source_pipeline = [
        {"$match": base},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$project": {"_id": 0, "source": "$_id", "count": 1}},
    ]
    by_source = await db.public_search_logs.aggregate(source_pipeline).to_list(20)

    return {
        "window_days": days,
        "total_logs": total_logs,
        "unique_queries": unique_queries,
        "unique_visitors": unique_visitors,
        "zero_result_rate": round(zero_count / total_logs, 4) if total_logs else 0.0,
        "top_queries": top_queries,
        "zero_result_queries": zero_result_queries,
        "daily_volume": daily_volume,
        "by_source": by_source,
    }
