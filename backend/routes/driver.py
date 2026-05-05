"""Driver-facing endpoints — token-authenticated mobile view.

Drivers don't have user accounts. Each delivery_person is issued a
single-use `access_token` (UUID) when created. The driver opens
`/driver/<id>?token=<token>` on their phone to see their assigned
in-flight orders and mark them delivered.

All endpoints REQUIRE the matching `?token=` query param.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel

from core import api_router, db, logger
from notifications import notify_order_status


async def _auth_driver(delivery_person_id: str, token: str) -> dict:
    if not token:
        raise HTTPException(401, "Missing token")
    dp = await db.delivery_persons.find_one(
        {"delivery_person_id": delivery_person_id}, {"_id": 0}
    )
    if not dp:
        raise HTTPException(404, "Driver not found")
    if dp.get("access_token") != token:
        raise HTTPException(401, "Invalid token")
    return dp


@api_router.get("/driver/{delivery_person_id}/profile")
async def driver_profile(delivery_person_id: str, token: str = ""):
    dp = await _auth_driver(delivery_person_id, token)
    # Don't leak the token back; trim what we send.
    return {
        "delivery_person_id": dp["delivery_person_id"],
        "name": dp.get("name", ""),
        "phone": dp.get("phone", ""),
        "vehicle_type": dp.get("vehicle_type", ""),
        "vehicle_no": dp.get("vehicle_no", ""),
        "status": dp.get("status", "active"),
    }


@api_router.get("/driver/{delivery_person_id}/orders")
async def driver_orders(delivery_person_id: str, token: str = "",
                        include_done: bool = False):
    """In-flight orders assigned to this driver. Set include_done=true to
    also include orders delivered in the last 7 days."""
    await _auth_driver(delivery_person_id, token)
    flt: dict = {"delivery_person_id": delivery_person_id}
    if include_done:
        # Include recent deliveries
        flt["$or"] = [
            {"status": {"$in": ["packed", "shipped"]}},
            {"status": "delivered"},
        ]
    else:
        flt["status"] = {"$in": ["packed", "shipped"]}
    orders = await db.orders.find(
        flt,
        {"_id": 0, "order_id": 1, "company_name": 1, "shipping_address": 1,
         "items": 1, "total_bdt": 1, "payment_method": 1, "status": 1,
         "delivery_fee": 1, "created_at": 1, "delivery_eta": 1, "user_id": 1},
    ).sort("created_at", -1).to_list(200)
    # Pick contact phone from workshop
    user_ids = [o["user_id"] for o in orders if o.get("user_id")]
    workshops = {}
    if user_ids:
        async for w in db.workshops.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "contact_phone": 1, "city": 1},
        ):
            workshops[w["user_id"]] = w
    for o in orders:
        w = workshops.get(o.get("user_id"))
        o["contact_phone"] = (w or {}).get("contact_phone", "")
        o["city"] = (w or {}).get("city", "")
        o["item_count"] = sum(it.get("quantity", 0) for it in o.get("items", []))
    return orders


class DriverStatusUpdate(BaseModel):
    status: str  # shipped | delivered
    note: str = ""


@api_router.patch("/driver/{delivery_person_id}/orders/{order_id}/status")
async def driver_update_status(delivery_person_id: str, order_id: str,
                               payload: DriverStatusUpdate, token: str = ""):
    """Driver-side status transitions. Allowed: packed→shipped, shipped→delivered."""
    await _auth_driver(delivery_person_id, token)
    if payload.status not in ("shipped", "delivered"):
        raise HTTPException(400, "Drivers can only set 'shipped' or 'delivered'")

    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("delivery_person_id") != delivery_person_id:
        raise HTTPException(403, "Order is not assigned to you")

    # Enforce valid transitions
    cur = order.get("status")
    if payload.status == "shipped" and cur != "packed":
        raise HTTPException(400, f"Cannot ship from status '{cur}'")
    if payload.status == "delivered" and cur != "shipped":
        raise HTTPException(400, f"Cannot deliver from status '{cur}' — order must be shipped first")

    now = datetime.now(timezone.utc).isoformat()
    note = payload.note or "Updated by driver"
    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {"status": payload.status},
            "$push": {"status_history": {"status": payload.status, "at": now, "note": note}},
        },
    )

    # Fire notification to workshop
    fresh = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    try:
        owner = await db.users.find_one({"user_id": fresh["user_id"]}, {"_id": 0})
        if owner and owner.get("email"):
            notify_order_status(fresh, owner["email"], payload.status)
    except Exception as e:
        logger.warning(f"Driver status notify failed: {e}")
    return fresh
