"""Customer-car proof-of-service photos.

Workshops capture a photo of the customer's actual vehicle (via phone
camera) when they look up the VIN. Photos are stored in Mongo as
base64-encoded blobs under the VIN — providing a documented service
record for liability and dispute resolution.

Storage choice: base64 in Mongo (not object storage) — keeps photos
attached to the VIN record without managing storage tokens for what is
inherently small (a few hundred KB per workshop visit). If volume grows,
swap to put_object/get_object from core.
"""

import base64
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel

from core import api_router, db, require_user


MAX_PHOTO_BYTES = 3 * 1024 * 1024  # 3 MB after client-side compression


@api_router.post("/vin/customer-photo")
async def upload_customer_photo(
    request: Request,
    vin: str = Form(...),
    note: str = Form(""),
    photo: UploadFile = File(...),
):
    """Workshop captures a photo of the customer's actual vehicle. Stored
    against the VIN so it surfaces every time that VIN is looked up."""
    user = await require_user(request)
    vin = (vin or "").strip().upper()
    if len(vin) != 17:
        raise HTTPException(400, "Invalid VIN.")
    raw = await photo.read()
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(413, f"Photo too large. Max {MAX_PHOTO_BYTES // 1024 // 1024} MB.")
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only image files allowed.")

    doc = {
        "photo_id": f"cph_{uuid.uuid4().hex[:10]}",
        "vin": vin,
        "user_id": user["user_id"],
        "company_name": (await db.workshops.find_one(
            {"user_id": user["user_id"]}, {"_id": 0, "company_name": 1}
        ) or {}).get("company_name", ""),
        "note": note,
        "content_type": photo.content_type,
        "image_b64": base64.b64encode(raw).decode("ascii"),
        "size_bytes": len(raw),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.vin_customer_photos.insert_one(dict(doc))
    # Don't echo the base64 back; return only summary for fast UI
    doc.pop("image_b64", None)
    doc.pop("_id", None)
    return doc


@api_router.get("/vin/customer-photos")
async def list_customer_photos(request: Request, vin: str):
    """List photo summaries for a VIN — across ALL workshops who serviced
    it. The actual base64 is fetched per-photo via the GET-by-id endpoint
    so the list call stays small."""
    await require_user(request)
    vin = (vin or "").strip().upper()
    if len(vin) != 17:
        raise HTTPException(400, "Invalid VIN.")
    items = await db.vin_customer_photos.find(
        {"vin": vin},
        {"_id": 0, "image_b64": 0},
    ).sort("created_at", -1).to_list(50)
    return items


@api_router.get("/vin/customer-photos/{photo_id}/data")
async def get_customer_photo_data(photo_id: str, request: Request):
    """Return the base64 data URL for a single photo. Auth required."""
    await require_user(request)
    p = await db.vin_customer_photos.find_one({"photo_id": photo_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Photo not found")
    return {
        "photo_id": p["photo_id"],
        "data_url": f"data:{p.get('content_type', 'image/jpeg')};base64,{p['image_b64']}",
        "note": p.get("note", ""),
        "company_name": p.get("company_name", ""),
        "created_at": p.get("created_at"),
    }


@api_router.delete("/vin/customer-photos/{photo_id}")
async def delete_customer_photo(photo_id: str, request: Request):
    user = await require_user(request)
    res = await db.vin_customer_photos.delete_one(
        {"photo_id": photo_id, "user_id": user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found or not yours")
    return {"ok": True}