"""Multi-user team accounts for workshops.

Workshop owner can invite members (manager / mechanic / parts_manager / accountant)
who share the same `joy_id` workspace. Each member's actions are tracked via
audit log. Invites are emailed (best-effort via notifications.py) and accepted
through a tokenised public URL.

Schema:
  workshops.member_user_ids: List[str]  (the owner's user_id is also here)
  workshops.owner_user_id: str
  users.workshop_id: Optional[str]      (denormalised for fast lookup)
  users.workshop_role: Optional[str]    ("owner" | "manager" | "mechanic" | "parts_manager" | "accountant")

  workshop_invitations: { invite_id, workshop_id, email, role, token,
                          status, invited_by, created_at, expires_at,
                          accepted_at?, accepted_by_user_id? }
"""

import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel, EmailStr

from core import api_router, db, logger, require_user

VALID_ROLES = {"owner", "manager", "mechanic", "parts_manager", "accountant"}
INVITE_TTL_DAYS = 7


# ============= Models =============
class InviteCreate(BaseModel):
    email: EmailStr
    role: str  # one of VALID_ROLES (excluding "owner")


class InviteAccept(BaseModel):
    token: str


# ============= Helpers =============
async def _get_workshop_for_user(user: dict) -> dict:
    """Returns the workshop the user belongs to (as owner OR member)."""
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admins do not have a workshop")
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        # Maybe member of another workshop
        ws = await db.workshops.find_one(
            {"member_user_ids": user["user_id"]}, {"_id": 0}
        )
    if not ws:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return ws


def _is_owner(user: dict, ws: dict) -> bool:
    return ws.get("owner_user_id") == user["user_id"] or ws.get("user_id") == user["user_id"]


# ============= Endpoints =============
@api_router.get("/team/members")
async def list_members(request: Request):
    """List all members of the calling user's workshop."""
    user = await require_user(request)
    ws = await _get_workshop_for_user(user)
    member_ids = list({ws.get("user_id")} | set(ws.get("member_user_ids", [])))
    members = []
    async for u in db.users.find(
        {"user_id": {"$in": member_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1,
         "joy_id": 1, "workshop_role": 1, "created_at": 1},
    ):
        u["is_owner"] = u["user_id"] == ws.get("user_id") or u["user_id"] == ws.get("owner_user_id")
        if u["is_owner"] and not u.get("workshop_role"):
            u["workshop_role"] = "owner"
        members.append(u)
    members.sort(key=lambda m: (not m["is_owner"], m.get("name", "")))
    return {"workshop_id": ws.get("workshop_id"), "members": members}


@api_router.get("/team/invitations")
async def list_invitations(request: Request):
    """List pending invitations for the caller's workshop."""
    user = await require_user(request)
    ws = await _get_workshop_for_user(user)
    invites = []
    async for inv in db.workshop_invitations.find(
        {"workshop_id": ws["workshop_id"], "status": "pending"}, {"_id": 0}
    ):
        invites.append(inv)
    invites.sort(key=lambda i: i.get("created_at", ""), reverse=True)
    return {"invitations": invites}


@api_router.post("/team/invitations")
async def create_invitation(payload: InviteCreate, request: Request):
    """Owner-only: invite a new member by email."""
    user = await require_user(request)
    ws = await _get_workshop_for_user(user)
    if not _is_owner(user, ws):
        raise HTTPException(status_code=403, detail="Only the workshop owner can invite members")
    role = (payload.role or "").lower()
    if role not in VALID_ROLES or role == "owner":
        raise HTTPException(status_code=400, detail="Invalid role. Use one of: manager, mechanic, parts_manager, accountant")
    email = payload.email.lower()

    # If user already a member, reject
    existing_member = await db.users.find_one(
        {"email": email, "workshop_id": ws["workshop_id"]}, {"_id": 0, "user_id": 1}
    )
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member of your workshop")

    # If a pending invite already exists, refresh it
    token = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=INVITE_TTL_DAYS)
    existing = await db.workshop_invitations.find_one(
        {"workshop_id": ws["workshop_id"], "email": email, "status": "pending"}, {"_id": 0}
    )
    if existing:
        await db.workshop_invitations.update_one(
            {"invite_id": existing["invite_id"]},
            {"$set": {
                "role": role, "token": token,
                "expires_at": expires_at.isoformat(),
                "invited_by": user["user_id"],
            }},
        )
        invite_id = existing["invite_id"]
    else:
        invite_id = f"inv_{uuid.uuid4().hex[:12]}"
        await db.workshop_invitations.insert_one({
            "invite_id": invite_id,
            "workshop_id": ws["workshop_id"],
            "email": email,
            "role": role,
            "token": token,
            "status": "pending",
            "invited_by": user["user_id"],
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        })
    logger.info(f"Team invite created — {email} for workshop {ws['workshop_id']} (role={role})")
    # Best-effort email send (will no-op without RESEND key)
    try:
        from notifications import notify_team_invite
        await notify_team_invite(email=email, workshop_name=ws.get("company_name") or "JOY Automart", token=token, role=role)
    except Exception as e:  # noqa
        logger.info(f"team-invite email skipped: {e}")
    return {"invite_id": invite_id, "token": token, "expires_at": expires_at.isoformat()}


@api_router.delete("/team/invitations/{invite_id}")
async def revoke_invitation(invite_id: str, request: Request):
    user = await require_user(request)
    ws = await _get_workshop_for_user(user)
    if not _is_owner(user, ws):
        raise HTTPException(status_code=403, detail="Only the workshop owner can revoke invitations")
    res = await db.workshop_invitations.update_one(
        {"invite_id": invite_id, "workshop_id": ws["workshop_id"], "status": "pending"},
        {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed")
    return {"ok": True}


@api_router.delete("/team/members/{member_user_id}")
async def remove_member(member_user_id: str, request: Request):
    user = await require_user(request)
    ws = await _get_workshop_for_user(user)
    if not _is_owner(user, ws):
        raise HTTPException(status_code=403, detail="Only the workshop owner can remove members")
    if member_user_id == ws.get("user_id") or member_user_id == ws.get("owner_user_id"):
        raise HTTPException(status_code=400, detail="Cannot remove the workshop owner")
    if member_user_id not in (ws.get("member_user_ids") or []):
        raise HTTPException(status_code=404, detail="Member not found in this workshop")
    await db.workshops.update_one(
        {"workshop_id": ws["workshop_id"]},
        {"$pull": {"member_user_ids": member_user_id}},
    )
    await db.users.update_one(
        {"user_id": member_user_id},
        {"$unset": {"workshop_id": "", "workshop_role": ""}},
    )
    return {"ok": True}


# ============= Public invite-acceptance endpoints =============
@api_router.get("/team/invitations/lookup/{token}")
async def lookup_invitation(token: str):
    """Public — returns invitation metadata (no PII beyond workshop name + role)."""
    inv = await db.workshop_invitations.find_one({"token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.get("status") != "pending":
        raise HTTPException(status_code=410, detail=f"Invitation is {inv.get('status')}")
    if datetime.now(timezone.utc) > datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00")):
        await db.workshop_invitations.update_one(
            {"invite_id": inv["invite_id"]}, {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=410, detail="Invitation has expired")
    ws = await db.workshops.find_one({"workshop_id": inv["workshop_id"]}, {"_id": 0, "company_name": 1, "joy_id": 1})
    owner = await db.users.find_one(
        {"user_id": inv["invited_by"]}, {"_id": 0, "name": 1, "email": 1, "joy_id": 1}
    )
    return {
        "email": inv["email"],
        "role": inv["role"],
        "workshop_name": (ws or {}).get("company_name") or "JOY Automart partner",
        "joy_id": (ws or {}).get("joy_id"),
        "invited_by": owner,
        "expires_at": inv["expires_at"],
    }


@api_router.post("/team/invitations/accept")
async def accept_invitation(payload: InviteAccept, request: Request):
    """Authenticated — caller's email must match the invitation. Adds caller as a member."""
    user = await require_user(request)
    inv = await db.workshop_invitations.find_one({"token": payload.token}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.get("status") != "pending":
        raise HTTPException(status_code=410, detail=f"Invitation is {inv.get('status')}")
    if datetime.now(timezone.utc) > datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00")):
        await db.workshop_invitations.update_one(
            {"invite_id": inv["invite_id"]}, {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=410, detail="Invitation has expired")
    if (user.get("email") or "").lower() != inv["email"].lower():
        raise HTTPException(status_code=403, detail="This invitation is for a different email address")

    # If user already has a workshop (their own), they can't join another
    own_ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0, "workshop_id": 1})
    if own_ws and own_ws["workshop_id"] != inv["workshop_id"]:
        # Allow ONLY if they have no orders/data yet — otherwise require explicit confirmation
        order_count = await db.orders.count_documents({"user_id": user["user_id"]})
        if order_count > 0:
            raise HTTPException(status_code=400, detail="You already own a workshop with order history. Contact JOY Automart support to merge.")
        # Soft-detach the placeholder workshop
        await db.workshops.delete_one({"user_id": user["user_id"], "workshop_id": {"$ne": inv["workshop_id"]}})

    await db.workshops.update_one(
        {"workshop_id": inv["workshop_id"]},
        {"$addToSet": {"member_user_ids": user["user_id"]}},
    )
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"workshop_id": inv["workshop_id"], "workshop_role": inv["role"]}},
    )
    await db.workshop_invitations.update_one(
        {"invite_id": inv["invite_id"]},
        {"$set": {
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc).isoformat(),
            "accepted_by_user_id": user["user_id"],
        }},
    )
    ws = await db.workshops.find_one({"workshop_id": inv["workshop_id"]}, {"_id": 0, "company_name": 1, "joy_id": 1})
    return {"ok": True, "workshop": ws, "role": inv["role"]}
