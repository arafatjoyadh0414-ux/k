"""Search-intent capture & analytics.

Logs every public catalog search query into `public_search_logs` for
demand-discovery insights. Anonymous-friendly: stores a hashed IP for
deduplication only — never the raw IP. Powers the admin "Search
Intelligence" dashboard (top queries, zero-result queries, daily volume).

Auto-promotes zero-result queries into actionable sourcing leads when
they cross the threshold (>=5 unique-visitor searches in last 7 days).
This closes the loop from search demand → procurement action.

Public:
    POST /api/public/search-log     — fire-and-forget log endpoint

Admin:
    GET  /api/admin/search-analytics — top queries, zero-results, time-series
    GET  /api/admin/sourcing-leads   — promoted demand-signal leads
    POST /api/admin/sourcing-leads/{lead_id}/status — update lead status
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
        # Async lead promotion — never blocks the user response
        if doc["zero_result"]:
            await _maybe_promote_to_sourcing_lead(doc["query_norm"], doc["query"])
    except Exception:
        # Never fail the user request because of analytics
        return {"ok": False}
    return {"ok": True, "log_id": doc["log_id"]}


# ============= Lead promotion logic =============
SOURCING_LEAD_THRESHOLD = 5  # unique searches in window
SOURCING_LEAD_WINDOW_DAYS = 7


async def _maybe_promote_to_sourcing_lead(query_norm: str, sample_query: str) -> None:
    """Auto-create / update a sourcing lead when a zero-result query
    crosses the demand threshold within the rolling window."""
    if not query_norm:
        return
    cutoff = (datetime.now(timezone.utc) - timedelta(days=SOURCING_LEAD_WINDOW_DAYS)).isoformat()
    base_match = {"query_norm": query_norm, "zero_result": True, "created_at": {"$gte": cutoff}}

    total = await db.public_search_logs.count_documents(base_match)
    unique_visitors = len(await db.public_search_logs.distinct("ip_hash", base_match))
    if total < SOURCING_LEAD_THRESHOLD and unique_visitors < SOURCING_LEAD_THRESHOLD:
        return

    existing = await db.sourcing_leads.find_one({"query_norm": query_norm})
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        # Bump counters; preserve manual status
        await db.sourcing_leads.update_one(
            {"query_norm": query_norm},
            {
                "$set": {
                    "last_seen_at": now,
                    "search_count_window": total,
                    "unique_visitors_window": unique_visitors,
                    "sample_query": sample_query,
                }
            },
        )
        return

    # Brand-new lead
    lead = {
        "lead_id": str(uuid.uuid4()),
        "query_norm": query_norm,
        "sample_query": sample_query,
        "search_count_window": total,
        "unique_visitors_window": unique_visitors,
        "status": "open",  # open | sourcing | added | rejected
        "priority": "high" if total >= SOURCING_LEAD_THRESHOLD * 2 else "medium",
        "notes": "",
        "first_seen_at": now,
        "last_seen_at": now,
        "created_at": now,
    }
    await db.sourcing_leads.insert_one(lead)


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



# ============= Admin: Sourcing Leads =============
class SourcingLeadStatusIn(BaseModel):
    status: str = Field(..., max_length=20)  # open | sourcing | added | rejected
    notes: str | None = None


@api_router.get("/admin/sourcing-leads")
async def admin_list_sourcing_leads(request: Request, status: str | None = None):
    """List demand-promoted leads. Optionally filter by status."""
    await require_admin(request)
    q: dict = {}
    if status:
        q["status"] = status
    leads = await db.sourcing_leads.find(q, {"_id": 0}).sort("last_seen_at", -1).to_list(200)
    # Counts by status (always full breakdown for the page header)
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    by_status_raw = await db.sourcing_leads.aggregate(pipeline).to_list(20)
    by_status = {row["_id"]: row["count"] for row in by_status_raw}
    return {
        "leads": leads,
        "by_status": by_status,
        "threshold": SOURCING_LEAD_THRESHOLD,
        "window_days": SOURCING_LEAD_WINDOW_DAYS,
    }


@api_router.post("/admin/sourcing-leads/{lead_id}/status")
async def admin_update_sourcing_lead(lead_id: str, payload: SourcingLeadStatusIn, request: Request):
    """Update a lead's workflow status (open → sourcing → added | rejected)."""
    await require_admin(request)
    valid = {"open", "sourcing", "added", "rejected"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(valid)}")
    update = {
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.notes is not None:
        update["notes"] = payload.notes[:500]
    res = await db.sourcing_leads.update_one({"lead_id": lead_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="lead not found")
    lead = await db.sourcing_leads.find_one({"lead_id": lead_id}, {"_id": 0})
    return {"ok": True, "lead": lead}
