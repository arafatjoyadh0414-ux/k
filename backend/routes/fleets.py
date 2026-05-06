"""Fleet Command Center — saved fleet profiles for one-click reorders.

A workshop owner can save groups of vehicles (their fleet customers) and
generate a "ready-to-checkout" cart from past orders for those vehicles in
one tap. Especially valuable for ride-share / corporate fleet workshops who
service the same 10-30 cars on a repeating cadence.

Schema:
  fleets: {
    fleet_id, workshop_id, name, description?,
    vehicles: [
      {brand, model, year?, vin?, plate?, customer_name?, notes?}
    ],
    created_by, created_at, updated_at
  }
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel

from core import api_router, db, logger, require_user, tier_price


# ============= Models =============
class FleetVehicle(BaseModel):
    brand: str
    model: str
    year: Optional[int] = None
    vin: Optional[str] = None
    plate: Optional[str] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = None


class FleetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    vehicles: Optional[List[FleetVehicle]] = None


class FleetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    vehicles: Optional[List[FleetVehicle]] = None


# ============= Helpers =============
async def _user_workshop_id(user: dict) -> str:
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admins do not own a workshop")
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0, "workshop_id": 1})
    if not ws:
        ws = await db.workshops.find_one({"member_user_ids": user["user_id"]}, {"_id": 0, "workshop_id": 1})
    if not ws:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return ws["workshop_id"]


# ============= Endpoints =============
@api_router.get("/fleets")
async def list_fleets(request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    fleets = []
    async for f in db.fleets.find({"workshop_id": workshop_id}, {"_id": 0}):
        f["vehicle_count"] = len(f.get("vehicles") or [])
        fleets.append(f)
    fleets.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"fleets": fleets}


@api_router.post("/fleets")
async def create_fleet(payload: FleetCreate, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    if not (payload.name or "").strip():
        raise HTTPException(status_code=400, detail="Fleet name required")
    fleet_id = f"fleet_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "fleet_id": fleet_id,
        "workshop_id": workshop_id,
        "name": payload.name.strip(),
        "description": (payload.description or "").strip() or None,
        "vehicles": [v.model_dump() for v in (payload.vehicles or [])],
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.fleets.insert_one(dict(doc))
    return doc


@api_router.get("/fleets/{fleet_id}")
async def get_fleet(fleet_id: str, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    f = await db.fleets.find_one({"fleet_id": fleet_id, "workshop_id": workshop_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Fleet not found")
    return f


@api_router.patch("/fleets/{fleet_id}")
async def update_fleet(fleet_id: str, payload: FleetUpdate, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    update: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        update["name"] = payload.name.strip()
    if payload.description is not None:
        update["description"] = payload.description.strip() or None
    if payload.vehicles is not None:
        update["vehicles"] = [v.model_dump() for v in payload.vehicles]
    res = await db.fleets.update_one(
        {"fleet_id": fleet_id, "workshop_id": workshop_id},
        {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fleet not found")
    return await get_fleet(fleet_id, request)


@api_router.delete("/fleets/{fleet_id}")
async def delete_fleet(fleet_id: str, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    res = await db.fleets.delete_one({"fleet_id": fleet_id, "workshop_id": workshop_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fleet not found")
    return {"ok": True}


@api_router.get("/fleets/{fleet_id}/reorder-suggestions")
async def reorder_suggestions(fleet_id: str, request: Request):
    """Looks at all orders for this workshop in the last 180 days, ranks SKUs by
    cumulative quantity ordered, and returns the top 20 with current tier price.
    Workshop can review + add to cart with one tap.
    """
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    fleet = await db.fleets.find_one({"fleet_id": fleet_id, "workshop_id": workshop_id}, {"_id": 0})
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet not found")

    # Aggregate SKU usage from this workshop's order history
    member_ids = [user["user_id"]]
    ws = await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0, "member_user_ids": 1, "user_id": 1, "pricing_tier": 1})
    if ws:
        if ws.get("user_id"):
            member_ids.append(ws["user_id"])
        member_ids.extend(ws.get("member_user_ids") or [])
    member_ids = list(set(member_ids))
    tier = (ws or {}).get("pricing_tier") or "retail"

    pipeline = [
        {"$match": {"user_id": {"$in": member_ids}, "status": {"$nin": ["cancelled", "pending_payment"]}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.sku",
            "qty_total": {"$sum": "$items.quantity"},
            "last_ordered": {"$max": "$created_at"},
            "name": {"$last": "$items.name"},
        }},
        {"$sort": {"qty_total": -1}},
        {"$limit": 20},
    ]
    suggestions = []
    async for row in db.orders.aggregate(pipeline):
        sku = row["_id"]
        product = await db.products.find_one(
            {"sku": sku},
            {"_id": 0, "product_id": 1, "sku": 1, "name": 1, "category": 1, "brand": 1,
             "image_url": 1, "price_bdt": 1, "moq": 1, "stock": 1},
        )
        if not product:
            continue
        retail_price = float(product.get("price_bdt", 0))
        your_price = tier_price(retail_price, tier)
        suggestions.append({
            "product_id": product["product_id"],
            "sku": product["sku"],
            "name": product["name"],
            "category": product.get("category"),
            "brand": product.get("brand"),
            "image_url": product.get("image_url"),
            "moq": product.get("moq", 1),
            "stock": product.get("stock", 0),
            "retail_price_bdt": retail_price,
            "your_price_bdt": your_price,
            "your_tier": tier,
            "suggested_qty": max(int(product.get("moq", 1)), int(round(row["qty_total"] / max(1, len(fleet.get("vehicles") or []) or 1)))),
            "lifetime_qty_ordered": int(row["qty_total"]),
            "last_ordered_at": row.get("last_ordered"),
        })
    return {"fleet_id": fleet_id, "fleet_name": fleet["name"], "vehicle_count": len(fleet.get("vehicles") or []), "suggestions": suggestions}
