"""Audit Log — per-teammate attribution for sensitive actions.

Log entries are emitted from key write endpoints (orders, returns, job cards,
fleets, credit, KYC). Workshop owners can view who did what across their
shared workspace.

Schema:
  audit_log: {
    log_id, workshop_id, user_id, user_name, user_email, user_role,
    action: "order.create" | "order.update" | "order.cancel" |
            "job_card.create" | "job_card.update" | "job_card.delete" |
            "job_card.push_to_cart" | "fleet.create" | "fleet.update" |
            "fleet.delete" | "team.invite" | "team.accept" | "team.remove" |
            "return.create" | "credit.adjust" | ...,
    target_type: "order" | "job_card" | "fleet" | "invite" | "user" | etc,
    target_id, summary, metadata?, created_at
  }
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, Request

from core import api_router, db, logger, require_user


async def log_audit(
    *,
    user: dict,
    workshop_id: str,
    action: str,
    target_type: str,
    target_id: str,
    summary: str,
    metadata: Optional[dict] = None,
) -> None:
    """Best-effort write — never raise into the caller."""
    try:
        await db.audit_log.insert_one({
            "log_id": f"al_{uuid.uuid4().hex[:14]}",
            "workshop_id": workshop_id,
            "user_id": user.get("user_id"),
            "user_name": user.get("name") or "",
            "user_email": user.get("email") or "",
            "user_role": user.get("workshop_role") or ("owner" if user.get("user_id") else None) or user.get("role"),
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "summary": summary,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:  # noqa
        logger.info(f"audit log skipped: {e}")


async def _user_workshop_id(user: dict) -> str:
    if user.get("role") == "admin":
        raise HTTPException(403, "Admins do not have a workshop")
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0, "workshop_id": 1})
    if not ws:
        ws = await db.workshops.find_one({"member_user_ids": user["user_id"]}, {"_id": 0, "workshop_id": 1})
    if not ws:
        raise HTTPException(404, "Workshop not found")
    return ws["workshop_id"]


def _is_owner(user: dict, ws: dict) -> bool:
    return ws.get("owner_user_id") == user["user_id"] or ws.get("user_id") == user["user_id"]


@api_router.get("/audit-log")
async def list_audit_log(
    request: Request,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    user_id: Optional[str] = None,
    days: int = 30,
    limit: int = 100,
):
    """List audit entries for the caller's workshop. Owner sees all members; members see only their own."""
    user = await require_user(request)
    if user.get("role") == "admin":
        raise HTTPException(403, "Use admin tools instead")
    workshop_id = await _user_workshop_id(user)
    ws = await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})

    q: dict = {"workshop_id": workshop_id}
    # Members can only see their own actions; owners see everyone's
    if not _is_owner(user, ws or {}):
        q["user_id"] = user["user_id"]
    elif user_id:
        q["user_id"] = user_id
    if target_type:
        q["target_type"] = target_type
    if target_id:
        q["target_id"] = target_id

    if days and days > 0:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=int(days))).isoformat()
        q["created_at"] = {"$gte": cutoff}

    entries = []
    async for entry in db.audit_log.find(q, {"_id": 0}).sort("created_at", -1).limit(min(int(limit), 500)):
        entries.append(entry)
    return {"entries": entries, "count": len(entries)}
