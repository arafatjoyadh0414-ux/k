"""Web Push notifications — VAPID-signed, no third-party APIs.

Workshops subscribe their browsers/devices via /api/push/subscribe.
Backend triggers (order shipped, low stock) call send_push_to_user(user_id, ...)
which fetches all subscriptions for that user and pushes to each one.

Schema:
  push_subscriptions: {
    sub_id, user_id, endpoint, keys: {p256dh, auth},
    user_agent, created_at, last_used_at, failure_count
  }
"""

import base64
import json
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel
from pywebpush import webpush, WebPushException

from core import api_router, db, logger, require_user

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:contact@joyautomart.com").strip()


def _vapid_private_pem() -> Optional[str]:
    b64 = os.environ.get("VAPID_PRIVATE_PEM_B64", "").strip()
    if not b64:
        return None
    try:
        return base64.b64decode(b64).decode()
    except Exception:
        return None


# ============= Models =============
class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribePayload(BaseModel):
    endpoint: str
    keys: PushKeys


# ============= Public config =============
@api_router.get("/push/public-key")
async def push_public_key():
    """Public endpoint — frontend needs this to call pushManager.subscribe()."""
    if not VAPID_PUBLIC_KEY:
        return {"public_key": None, "configured": False}
    return {"public_key": VAPID_PUBLIC_KEY, "configured": True}


# ============= Subscribe / unsubscribe =============
@api_router.post("/push/subscribe")
async def subscribe(payload: PushSubscribePayload, request: Request):
    user = await require_user(request)
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(503, "Push notifications not configured")
    user_agent = (request.headers.get("user-agent") or "")[:300]
    now = datetime.now(timezone.utc).isoformat()
    # Upsert by endpoint (browsers can re-issue subscriptions)
    res = await db.push_subscriptions.update_one(
        {"endpoint": payload.endpoint},
        {
            "$set": {
                "user_id": user["user_id"],
                "endpoint": payload.endpoint,
                "keys": payload.keys.model_dump(),
                "user_agent": user_agent,
                "last_used_at": now,
                "failure_count": 0,
            },
            "$setOnInsert": {
                "sub_id": f"ps_{uuid.uuid4().hex[:14]}",
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {"ok": True, "new": res.upserted_id is not None}


@api_router.post("/push/unsubscribe")
async def unsubscribe(payload: PushSubscribePayload, request: Request):
    user = await require_user(request)
    await db.push_subscriptions.delete_one({"endpoint": payload.endpoint, "user_id": user["user_id"]})
    return {"ok": True}


# ============= Send helper =============
async def send_push_to_user(
    user_id: str,
    *,
    title: str,
    body: str,
    url: str = "/dashboard",
    tag: Optional[str] = None,
    icon: Optional[str] = None,
) -> int:
    """Push a notification to every subscription owned by user_id.
    Returns number of successful pushes. Best-effort — never raises into caller.
    Removes subscriptions that return 404/410 (browser unsubscribed)."""
    priv_pem = _vapid_private_pem()
    if not (priv_pem and VAPID_PUBLIC_KEY):
        logger.info("push: VAPID not configured, skipping")
        return 0
    payload_json = json.dumps({
        "title": title[:120],
        "body": body[:240],
        "url": url,
        "tag": tag or "joy-default",
        "icon": icon or "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg",
    })
    sent = 0
    cursor = db.push_subscriptions.find({"user_id": user_id}, {"_id": 0})
    subs = []
    async for sub in cursor:
        subs.append(sub)

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"],
                },
                data=payload_json,
                vapid_private_key=priv_pem,
                vapid_claims={"sub": VAPID_SUBJECT},
                ttl=86400,
            )
            sent += 1
            await db.push_subscriptions.update_one(
                {"endpoint": sub["endpoint"]},
                {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat(), "failure_count": 0}},
            )
        except WebPushException as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410):
                # Subscription gone — drop it
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
                logger.info(f"push: pruned dead subscription {sub.get('sub_id')}")
            else:
                logger.warning(f"push: webpush failed status={status} err={e}")
                await db.push_subscriptions.update_one(
                    {"endpoint": sub["endpoint"]},
                    {"$inc": {"failure_count": 1}},
                )
        except Exception as e:
            logger.warning(f"push: send error: {e}")
    return sent


# ============= Test endpoint =============
@api_router.post("/push/test")
async def send_test(request: Request):
    user = await require_user(request)
    sent = await send_push_to_user(
        user["user_id"],
        title="JOY Automart — Test notification",
        body="If you can see this, push notifications are working on this device.",
        url="/dashboard",
        tag="test",
    )
    return {"sent": sent}
