"""WMS Lite — Job Card → Parts Order workflow.

Workshop creates a Job Card for a customer's vehicle (VIN/plate, complaint,
mechanic). Adds required parts as line items (linking to catalog SKUs).
Auto-pushes to a draft cart with one tap.

Schema:
  job_cards: {
    job_id, workshop_id, created_by,
    customer_name, customer_phone, vehicle_brand, vehicle_model, vehicle_year, vehicle_plate, vin,
    complaint, mechanic_name?, status (open|in_progress|completed|cancelled),
    parts: [{sku, name, quantity, price_bdt, source: "catalog"|"manual"}],
    labour_charge_bdt?, notes?,
    created_at, updated_at, completed_at?
  }
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel

from core import api_router, db, logger, require_user, tier_price


VALID_STATUSES = {"open", "in_progress", "completed", "cancelled"}


# ============= Models =============
class JobPart(BaseModel):
    sku: str
    name: Optional[str] = None
    quantity: int
    price_bdt: Optional[float] = None
    source: Optional[str] = "catalog"


class JobCardCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    vehicle_brand: str
    vehicle_model: str
    vehicle_year: Optional[int] = None
    vehicle_plate: Optional[str] = None
    vin: Optional[str] = None
    complaint: str
    mechanic_name: Optional[str] = None
    parts: Optional[List[JobPart]] = None
    labour_charge_bdt: Optional[float] = None
    notes: Optional[str] = None


class JobCardUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_plate: Optional[str] = None
    vin: Optional[str] = None
    complaint: Optional[str] = None
    mechanic_name: Optional[str] = None
    parts: Optional[List[JobPart]] = None
    labour_charge_bdt: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# ============= Helpers =============
async def _user_workshop_id(user: dict) -> str:
    if user.get("role") == "admin":
        raise HTTPException(403, "Admins do not own job cards")
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0, "workshop_id": 1, "pricing_tier": 1})
    if not ws:
        ws = await db.workshops.find_one({"member_user_ids": user["user_id"]}, {"_id": 0, "workshop_id": 1, "pricing_tier": 1})
    if not ws:
        raise HTTPException(404, "Workshop not found")
    return ws["workshop_id"]


async def _user_workshop_full(user: dict) -> dict:
    if user.get("role") == "admin":
        raise HTTPException(403, "Admins do not own job cards")
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        ws = await db.workshops.find_one({"member_user_ids": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workshop not found")
    return ws


def _job_total(card: dict) -> float:
    parts_total = sum(float(p.get("price_bdt") or 0) * int(p.get("quantity") or 0) for p in (card.get("parts") or []))
    return parts_total + float(card.get("labour_charge_bdt") or 0)


# ============= Endpoints =============
@api_router.get("/job-cards")
async def list_job_cards(request: Request, status: Optional[str] = None):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    q: dict = {"workshop_id": workshop_id}
    if status and status in VALID_STATUSES:
        q["status"] = status
    cards = []
    async for c in db.job_cards.find(q, {"_id": 0}).sort("created_at", -1):
        c["total_bdt"] = _job_total(c)
        c["parts_count"] = len(c.get("parts") or [])
        cards.append(c)
    return {"job_cards": cards}


@api_router.post("/job-cards")
async def create_job_card(payload: JobCardCreate, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    if not payload.customer_name.strip() or not payload.complaint.strip() or not payload.vehicle_brand.strip() or not payload.vehicle_model.strip():
        raise HTTPException(400, "customer_name, complaint, vehicle_brand and vehicle_model are required")
    job_id = f"JC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "job_id": job_id,
        "workshop_id": workshop_id,
        "created_by": user["user_id"],
        "customer_name": payload.customer_name.strip(),
        "customer_phone": (payload.customer_phone or "").strip() or None,
        "vehicle_brand": payload.vehicle_brand.strip(),
        "vehicle_model": payload.vehicle_model.strip(),
        "vehicle_year": payload.vehicle_year,
        "vehicle_plate": (payload.vehicle_plate or "").strip() or None,
        "vin": (payload.vin or "").strip() or None,
        "complaint": payload.complaint.strip(),
        "mechanic_name": (payload.mechanic_name or "").strip() or None,
        "parts": [p.model_dump() for p in (payload.parts or [])],
        "labour_charge_bdt": payload.labour_charge_bdt,
        "notes": (payload.notes or "").strip() or None,
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }
    await db.job_cards.insert_one(dict(doc))
    doc["total_bdt"] = _job_total(doc)
    doc["parts_count"] = len(doc.get("parts") or [])
    return doc


@api_router.get("/job-cards/{job_id}")
async def get_job_card(job_id: str, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    c = await db.job_cards.find_one({"job_id": job_id, "workshop_id": workshop_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Job card not found")
    c["total_bdt"] = _job_total(c)
    c["parts_count"] = len(c.get("parts") or [])
    return c


@api_router.patch("/job-cards/{job_id}")
async def update_job_card(job_id: str, payload: JobCardUpdate, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    update: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    data = payload.model_dump(exclude_unset=True)
    if "status" in data:
        if data["status"] not in VALID_STATUSES:
            raise HTTPException(400, f"Invalid status. Use one of: {', '.join(VALID_STATUSES)}")
        update["status"] = data["status"]
        if data["status"] == "completed":
            update["completed_at"] = datetime.now(timezone.utc).isoformat()
    for k in ("customer_name", "customer_phone", "vehicle_brand", "vehicle_model", "vehicle_plate", "vin", "complaint", "mechanic_name", "notes"):
        if k in data:
            v = (data[k] or "").strip() if isinstance(data[k], str) else data[k]
            update[k] = v or None
    if "vehicle_year" in data:
        update["vehicle_year"] = data["vehicle_year"]
    if "labour_charge_bdt" in data:
        update["labour_charge_bdt"] = data["labour_charge_bdt"]
    if "parts" in data and data["parts"] is not None:
        update["parts"] = [JobPart(**p).model_dump() if isinstance(p, dict) else p.model_dump() for p in data["parts"]]
    res = await db.job_cards.update_one(
        {"job_id": job_id, "workshop_id": workshop_id},
        {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Job card not found")
    return await get_job_card(job_id, request)


@api_router.delete("/job-cards/{job_id}")
async def delete_job_card(job_id: str, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    res = await db.job_cards.delete_one({"job_id": job_id, "workshop_id": workshop_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Job card not found")
    return {"ok": True}


@api_router.post("/job-cards/{job_id}/to-cart")
async def job_card_to_cart(job_id: str, request: Request):
    """Returns a tier-priced cart payload that the frontend can merge with its CartContext."""
    user = await require_user(request)
    ws = await _user_workshop_full(user)
    workshop_id = ws["workshop_id"]
    tier = ws.get("pricing_tier", "retail")
    card = await db.job_cards.find_one({"job_id": job_id, "workshop_id": workshop_id}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Job card not found")
    cart_items: list = []
    missing: list = []
    for part in card.get("parts") or []:
        sku = (part.get("sku") or "").strip()
        if not sku:
            continue
        product = await db.products.find_one(
            {"sku": sku},
            {"_id": 0, "product_id": 1, "sku": 1, "name": 1, "image_url": 1, "price_bdt": 1, "moq": 1, "stock": 1},
        )
        if not product:
            missing.append({"sku": sku, "name": part.get("name")})
            continue
        retail = float(product.get("price_bdt", 0))
        cart_items.append({
            "product_id": product["product_id"],
            "sku": product["sku"],
            "name": product["name"],
            "image_url": product.get("image_url"),
            "price_bdt": tier_price(retail, tier),
            "retail_price_bdt": retail,
            "quantity": int(part.get("quantity") or 1),
            "moq": product.get("moq", 1),
            "stock": product.get("stock", 0),
        })
    return {
        "job_id": job_id,
        "items": cart_items,
        "missing_skus": missing,
        "tier": tier,
    }
