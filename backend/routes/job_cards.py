"""WMS Lite — Job Card → Parts Order workflow."""

import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from core import api_router, db, logger, require_user, tier_price
from job_card_pdf import render_job_card_pdf
from routes.audit import log_audit
import os


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
    await log_audit(
        user=user, workshop_id=workshop_id, action="job_card.create",
        target_type="job_card", target_id=job_id,
        summary=f"Created job card for {doc['customer_name']} · {doc['vehicle_brand']} {doc['vehicle_model']}",
    )
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
    summary_bits = []
    if "status" in update:
        summary_bits.append(f"status → {update['status']}")
    if "parts" in update:
        summary_bits.append(f"{len(update['parts'])} parts")
    if "labour_charge_bdt" in update:
        summary_bits.append(f"labour ৳{update['labour_charge_bdt']}")
    await log_audit(
        user=user, workshop_id=workshop_id, action="job_card.update",
        target_type="job_card", target_id=job_id,
        summary=f"Updated {job_id}: {', '.join(summary_bits) or 'fields'}",
    )
    return await get_job_card(job_id, request)


@api_router.delete("/job-cards/{job_id}")
async def delete_job_card(job_id: str, request: Request):
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    res = await db.job_cards.delete_one({"job_id": job_id, "workshop_id": workshop_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Job card not found")
    await log_audit(
        user=user, workshop_id=workshop_id, action="job_card.delete",
        target_type="job_card", target_id=job_id,
        summary=f"Deleted {job_id}",
    )
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


# ============= PDF + Public Share =============
APP_URL = os.environ.get("APP_URL") or os.environ.get("EMERGENT_PREVIEW_URL") or ""


@api_router.get("/job-cards/{job_id}/share")
async def get_or_create_share_token(job_id: str, request: Request):
    """Owner/member-only — returns a stable public share token + URL."""
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    card = await db.job_cards.find_one({"job_id": job_id, "workshop_id": workshop_id}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Job card not found")
    token = card.get("share_token")
    if not token:
        token = secrets.token_urlsafe(20)
        await db.job_cards.update_one(
            {"job_id": job_id, "workshop_id": workshop_id},
            {"$set": {"share_token": token, "shared_at": datetime.now(timezone.utc).isoformat()}},
        )
    base = APP_URL.rstrip("/") or "https://b2bjoymart.com"
    share_url = f"{base}/jc/{token}"
    pdf_url = f"{base}/api/job-cards/public/{token}.pdf"
    return {"token": token, "share_url": share_url, "pdf_url": pdf_url}


@api_router.get("/job-cards/{job_id}/pdf")
async def download_job_card_pdf(job_id: str, request: Request):
    """Authenticated PDF download for the workshop."""
    user = await require_user(request)
    workshop_id = await _user_workshop_id(user)
    card = await db.job_cards.find_one({"job_id": job_id, "workshop_id": workshop_id}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Job card not found")
    workshop = await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})
    # Ensure share token exists so PDF can include the public link
    token = card.get("share_token")
    if not token:
        token = secrets.token_urlsafe(20)
        await db.job_cards.update_one({"job_id": job_id, "workshop_id": workshop_id},
                                      {"$set": {"share_token": token}})
    base = APP_URL.rstrip("/") or "https://b2bjoymart.com"
    share_url = f"{base}/jc/{token}"
    pdf = render_job_card_pdf(card, workshop, share_url)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{job_id}.pdf"'})


@api_router.get("/job-cards/public/{token}.pdf")
async def public_job_card_pdf(token: str):
    """Public PDF — accessed by customers via the share link."""
    card = await db.job_cards.find_one({"share_token": token}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Job card not found")
    workshop = await db.workshops.find_one({"workshop_id": card.get("workshop_id")}, {"_id": 0})
    base = APP_URL.rstrip("/") or "https://b2bjoymart.com"
    share_url = f"{base}/jc/{token}"
    pdf = render_job_card_pdf(card, workshop, share_url)
    filename = card.get("job_id") or "job_card"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{filename}.pdf"'})


@api_router.get("/job-cards/public/{token}")
async def public_job_card_json(token: str):
    """Public JSON for the React share-page renderer."""
    card = await db.job_cards.find_one({"share_token": token}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Job card not found")
    workshop = await db.workshops.find_one({"workshop_id": card.get("workshop_id")},
                                            {"_id": 0, "company_name": 1, "city": 1, "contact_phone": 1, "joy_id": 1})
    return {
        "job_id": card.get("job_id"),
        "customer_name": card.get("customer_name"),
        "vehicle_brand": card.get("vehicle_brand"),
        "vehicle_model": card.get("vehicle_model"),
        "vehicle_year": card.get("vehicle_year"),
        "vehicle_plate": card.get("vehicle_plate"),
        "vin": card.get("vin"),
        "complaint": card.get("complaint"),
        "mechanic_name": card.get("mechanic_name"),
        "parts": card.get("parts") or [],
        "labour_charge_bdt": card.get("labour_charge_bdt"),
        "status": card.get("status"),
        "notes": card.get("notes"),
        "total_bdt": _job_total(card),
        "created_at": card.get("created_at"),
        "shared_at": card.get("shared_at"),
        "workshop": workshop,
    }
