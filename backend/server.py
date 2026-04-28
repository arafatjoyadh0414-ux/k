from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Header, Query, Cookie
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "joyautomart"
storage_key = None

app = FastAPI(title="Joy Automart B2B API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============= Storage =============
def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ============= Models =============
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "workshop"  # workshop | admin
    created_at: str

class Workshop(BaseModel):
    workshop_id: str
    user_id: str
    company_name: str = ""
    contact_phone: str = ""
    address: str = ""
    city: str = ""
    trade_license_no: str = ""
    kyc_status: str = "not_submitted"  # not_submitted | pending | approved | rejected
    kyc_remark: str = ""
    credit_limit: float = 0.0
    credit_used: float = 0.0
    documents: List[dict] = []  # [{type, path, filename}]
    created_at: str

class Product(BaseModel):
    product_id: str
    name: str
    sku: str
    category: str
    description: str = ""
    image_url: str = ""
    price_bdt: float
    moq: int = 1
    stock: int = 100
    brand: str = ""
    created_at: str

class CartItem(BaseModel):
    product_id: str
    quantity: int

class OrderCreate(BaseModel):
    items: List[CartItem]
    payment_method: str  # credit | cod
    shipping_address: str
    notes: str = ""


# ============= Auth helpers =============
async def get_current_user(request: Request) -> Optional[dict]:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(request: Request) -> dict:
    u = await get_current_user(request)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return u


async def require_admin(request: Request) -> dict:
    u = await require_user(request)
    if u.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return u


# ============= Auth routes =============
@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id}, timeout=15
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data["email"].lower()
    name = data.get("name", email)
    picture = data.get("picture", "")
    session_token = data["session_token"]

    # Check if first user or in ADMIN_EMAILS - assign admin
    user_count = await db.users.count_documents({})
    role = "admin" if (email in ADMIN_EMAILS or user_count == 0) else "workshop"

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": role,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(dict(user_doc))
        # Create workshop record if not admin
        if role == "workshop":
            workshop_id = f"ws_{uuid.uuid4().hex[:12]}"
            await db.workshops.insert_one({
                "workshop_id": workshop_id,
                "user_id": user_id,
                "company_name": "",
                "contact_phone": "",
                "address": "",
                "city": "",
                "trade_license_no": "",
                "kyc_status": "not_submitted",
                "kyc_remark": "",
                "credit_limit": 0.0,
                "credit_used": 0.0,
                "documents": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    else:
        # update name/picture
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
        user_doc["name"] = name
        user_doc["picture"] = picture

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 60 * 60
    )
    return {"user": user_doc}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await require_user(request)
    return user


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# ============= Workshop & KYC =============
@api_router.get("/workshop/me")
async def workshop_me(request: Request):
    user = await require_user(request)
    if user.get("role") == "admin":
        return {"is_admin": True, "user": user}
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"workshop": ws, "user": user}


class WorkshopUpdate(BaseModel):
    company_name: str
    contact_phone: str
    address: str
    city: str
    trade_license_no: str

@api_router.put("/workshop/profile")
async def update_workshop(payload: WorkshopUpdate, request: Request):
    user = await require_user(request)
    await db.workshops.update_one(
        {"user_id": user["user_id"]},
        {"$set": payload.model_dump()}
    )
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return ws


@api_router.post("/workshop/kyc/upload")
async def upload_kyc(request: Request, doc_type: str = Form(...), file: UploadFile = File(...)):
    user = await require_user(request)
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/kyc/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    result = put_object(path, data, file.content_type or "application/octet-stream")
    doc = {
        "type": doc_type,  # trade_license | nid | owner_photo
        "path": result["path"],
        "filename": file.filename,
        "content_type": file.content_type,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    await db.workshops.update_one(
        {"user_id": user["user_id"]},
        {"$pull": {"documents": {"type": doc_type}}}
    )
    await db.workshops.update_one(
        {"user_id": user["user_id"]},
        {"$push": {"documents": doc}}
    )
    return doc


@api_router.post("/workshop/kyc/submit")
async def submit_kyc(request: Request):
    user = await require_user(request)
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workshop not found")
    if not ws.get("company_name") or not ws.get("trade_license_no"):
        raise HTTPException(400, "Complete profile first")
    doc_types = {d["type"] for d in ws.get("documents", [])}
    if "trade_license" not in doc_types:
        raise HTTPException(400, "Trade license document required")
    await db.workshops.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"kyc_status": "pending", "kyc_remark": ""}}
    )
    return {"ok": True}


@api_router.get("/files/{path:path}")
async def serve_file(path: str, request: Request):
    user = await require_user(request)
    # Owner or admin can view
    parts = path.split("/")
    if user.get("role") != "admin":
        # path starts with joyautomart/kyc/{user_id}/...
        if len(parts) < 3 or parts[2] != user["user_id"]:
            raise HTTPException(403, "Forbidden")
    data, ctype = get_object(path)
    return Response(content=data, media_type=ctype)


# ============= Products =============
@api_router.get("/products")
async def list_products(q: str = "", category: str = ""):
    flt = {}
    if q:
        flt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    if category:
        flt["category"] = category
    items = await db.products.find(flt, {"_id": 0}).to_list(500)
    return items


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p


class ProductCreate(BaseModel):
    name: str
    sku: str
    category: str
    description: str = ""
    image_url: str = ""
    price_bdt: float
    moq: int = 1
    stock: int = 100
    brand: str = ""

@api_router.post("/admin/products")
async def admin_create_product(payload: ProductCreate, request: Request):
    await require_admin(request)
    pid = f"prd_{uuid.uuid4().hex[:10]}"
    doc = {**payload.model_dump(), "product_id": pid, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.products.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, payload: ProductCreate, request: Request):
    await require_admin(request)
    await db.products.update_one({"product_id": product_id}, {"$set": payload.model_dump()})
    return await db.products.find_one({"product_id": product_id}, {"_id": 0})


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, request: Request):
    await require_admin(request)
    await db.products.delete_one({"product_id": product_id})
    return {"ok": True}


# ============= Orders =============
@api_router.post("/orders")
async def create_order(payload: OrderCreate, request: Request):
    user = await require_user(request)
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(403, "Workshop only")
    if ws["kyc_status"] != "approved":
        raise HTTPException(403, "KYC must be approved before placing orders")

    # Build order items
    total = 0.0
    line_items = []
    for ci in payload.items:
        p = await db.products.find_one({"product_id": ci.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Invalid product: {ci.product_id}")
        if ci.quantity < p.get("moq", 1):
            raise HTTPException(400, f"{p['name']} MOQ is {p['moq']}")
        line_total = p["price_bdt"] * ci.quantity
        total += line_total
        line_items.append({
            "product_id": p["product_id"],
            "name": p["name"],
            "sku": p["sku"],
            "image_url": p.get("image_url", ""),
            "price_bdt": p["price_bdt"],
            "quantity": ci.quantity,
            "line_total": line_total
        })

    if payload.payment_method == "credit":
        available = ws["credit_limit"] - ws["credit_used"]
        if total > available:
            raise HTTPException(400, f"Insufficient credit. Available: ৳{available:.2f}")

    order_id = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc)
    due_date = (now + timedelta(days=30)).isoformat() if payload.payment_method == "credit" else None

    order = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "workshop_id": ws["workshop_id"],
        "company_name": ws["company_name"],
        "items": line_items,
        "total_bdt": total,
        "payment_method": payload.payment_method,
        "payment_status": "unpaid",
        "due_date": due_date,
        "shipping_address": payload.shipping_address,
        "notes": payload.notes,
        "status": "placed",
        "status_history": [{"status": "placed", "at": now.isoformat(), "note": "Order placed"}],
        "created_at": now.isoformat()
    }
    await db.orders.insert_one(dict(order))

    if payload.payment_method == "credit":
        await db.workshops.update_one(
            {"workshop_id": ws["workshop_id"]},
            {"$inc": {"credit_used": total}}
        )

    order.pop("_id", None)
    return order


@api_router.get("/orders")
async def list_orders(request: Request, status: str = ""):
    user = await require_user(request)
    flt = {}
    if user.get("role") != "admin":
        flt["user_id"] = user["user_id"]
    if status:
        flt["status"] = status
    orders = await db.orders.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    user = await require_user(request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Not found")
    if user.get("role") != "admin" and order["user_id"] != user["user_id"]:
        raise HTTPException(403, "Forbidden")
    return order


class OrderStatusUpdate(BaseModel):
    status: str
    note: str = ""

@api_router.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, payload: OrderStatusUpdate, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Not found")
    valid = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"]
    if payload.status not in valid:
        raise HTTPException(400, f"Invalid status. Use: {valid}")
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {"status": payload.status},
            "$push": {"status_history": {"status": payload.status, "at": now, "note": payload.note}}
        }
    )
    if payload.status == "cancelled" and order["payment_method"] == "credit" and order.get("payment_status") != "paid":
        await db.workshops.update_one(
            {"workshop_id": order["workshop_id"]},
            {"$inc": {"credit_used": -order["total_bdt"]}}
        )
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api_router.patch("/admin/orders/{order_id}/payment")
async def admin_mark_paid(order_id: str, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Not found")
    if order.get("payment_status") == "paid":
        return order
    await db.orders.update_one({"order_id": order_id}, {"$set": {"payment_status": "paid"}})
    if order["payment_method"] == "credit":
        await db.workshops.update_one(
            {"workshop_id": order["workshop_id"]},
            {"$inc": {"credit_used": -order["total_bdt"]}}
        )
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


# ============= Admin: Workshops =============
@api_router.get("/admin/workshops")
async def admin_list_workshops(request: Request, kyc_status: str = ""):
    await require_admin(request)
    flt = {}
    if kyc_status:
        flt["kyc_status"] = kyc_status
    items = await db.workshops.find(flt, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # attach user email
    for w in items:
        u = await db.users.find_one({"user_id": w["user_id"]}, {"_id": 0})
        w["email"] = u["email"] if u else ""
        w["owner_name"] = u["name"] if u else ""
    return items


@api_router.get("/admin/workshops/{workshop_id}")
async def admin_get_workshop(workshop_id: str, request: Request):
    await require_admin(request)
    w = await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Not found")
    u = await db.users.find_one({"user_id": w["user_id"]}, {"_id": 0})
    w["email"] = u["email"] if u else ""
    w["owner_name"] = u["name"] if u else ""
    return w


class KycDecision(BaseModel):
    decision: str  # approved | rejected
    remark: str = ""

@api_router.patch("/admin/workshops/{workshop_id}/kyc")
async def admin_kyc_decision(workshop_id: str, payload: KycDecision, request: Request):
    await require_admin(request)
    if payload.decision not in ["approved", "rejected"]:
        raise HTTPException(400, "Invalid decision")
    await db.workshops.update_one(
        {"workshop_id": workshop_id},
        {"$set": {"kyc_status": payload.decision, "kyc_remark": payload.remark}}
    )
    return await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})


class CreditUpdate(BaseModel):
    credit_limit: float

@api_router.patch("/admin/workshops/{workshop_id}/credit")
async def admin_set_credit(workshop_id: str, payload: CreditUpdate, request: Request):
    await require_admin(request)
    if payload.credit_limit < 0:
        raise HTTPException(400, "Invalid limit")
    await db.workshops.update_one(
        {"workshop_id": workshop_id},
        {"$set": {"credit_limit": payload.credit_limit}}
    )
    return await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})


# ============= Admin: Stats =============
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    total_workshops = await db.workshops.count_documents({})
    pending_kyc = await db.workshops.count_documents({"kyc_status": "pending"})
    approved = await db.workshops.count_documents({"kyc_status": "approved"})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": {"$in": ["placed", "confirmed", "packed"]}})
    products_count = await db.products.count_documents({})

    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_bdt"}}}]
    revenue_doc = await db.orders.aggregate(pipeline).to_list(1)
    revenue = revenue_doc[0]["total"] if revenue_doc else 0.0

    return {
        "total_workshops": total_workshops,
        "pending_kyc": pending_kyc,
        "approved_workshops": approved,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "products_count": products_count,
        "total_revenue_bdt": revenue
    }


# ============= Seed =============
SEED_PRODUCTS = [
    {"name": "Brake Disc Rotor (Front)", "sku": "JA-BRK-001", "category": "Brake", "brand": "JoyOEM",
     "description": "High-carbon steel front brake disc rotor. Suitable for sedans and SUVs.",
     "image_url": "https://images.unsplash.com/photo-1760317890314-e964ffd7e6a6", "price_bdt": 4500, "moq": 2, "stock": 200},
    {"name": "Brake Pad Set (Ceramic)", "sku": "JA-BRK-002", "category": "Brake", "brand": "JoyOEM",
     "description": "Low-dust ceramic brake pads. Pack of 4.", "image_url": "https://images.unsplash.com/photo-1760317890322-364a810cd4da",
     "price_bdt": 2200, "moq": 4, "stock": 500},
    {"name": "Shock Absorber (Rear)", "sku": "JA-SUS-001", "category": "Suspension", "brand": "RideMax",
     "description": "Gas-charged rear shock absorber. Pair pricing.", "image_url": "https://images.unsplash.com/photo-1769218401073-71a5b1020c9b",
     "price_bdt": 6800, "moq": 2, "stock": 120},
    {"name": "Engine Oil Filter", "sku": "JA-ENG-001", "category": "Engine", "brand": "FilterPro",
     "description": "Premium spin-on oil filter. Universal fit.", "image_url": "https://images.unsplash.com/photo-1486496572940-2bb2341fdbdf?w=600",
     "price_bdt": 450, "moq": 10, "stock": 1000},
    {"name": "Spark Plug (Iridium)", "sku": "JA-ENG-002", "category": "Engine", "brand": "Ignyte",
     "description": "Iridium-tipped long-life spark plug.", "image_url": "https://images.unsplash.com/photo-1620891549027-942fdc95d3f5?w=600",
     "price_bdt": 850, "moq": 4, "stock": 800},
    {"name": "Headlight Bulb H4", "sku": "JA-ELC-001", "category": "Electrical", "brand": "BrightLine",
     "description": "H4 60/55W halogen bulb.", "image_url": "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=600",
     "price_bdt": 320, "moq": 2, "stock": 600},
    {"name": "12V Car Battery 65Ah", "sku": "JA-ELC-002", "category": "Electrical", "brand": "PowerCell",
     "description": "Maintenance-free 65Ah lead-acid battery.", "image_url": "https://images.unsplash.com/photo-1620639200286-9466f7a18a52?w=600",
     "price_bdt": 9500, "moq": 1, "stock": 80},
    {"name": "Air Filter Element", "sku": "JA-ENG-003", "category": "Engine", "brand": "FilterPro",
     "description": "Paper element air filter.", "image_url": "https://images.unsplash.com/photo-1635260413530-b0a52cb13a51?w=600",
     "price_bdt": 580, "moq": 5, "stock": 400},
    {"name": "Timing Belt Kit", "sku": "JA-ENG-004", "category": "Engine", "brand": "JoyOEM",
     "description": "Complete timing belt kit with tensioner.", "image_url": "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=600",
     "price_bdt": 7200, "moq": 1, "stock": 60},
    {"name": "CV Joint Boot Kit", "sku": "JA-DRV-001", "category": "Drivetrain", "brand": "DriveLine",
     "description": "Outer CV joint boot with grease.", "image_url": "https://images.unsplash.com/photo-1504222490345-c075b6008014?w=600",
     "price_bdt": 950, "moq": 2, "stock": 200},
    {"name": "Wheel Bearing (Front)", "sku": "JA-SUS-002", "category": "Suspension", "brand": "RideMax",
     "description": "Sealed front wheel hub bearing.", "image_url": "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=600",
     "price_bdt": 1850, "moq": 2, "stock": 150},
    {"name": "Engine Oil 5W-30 (4L)", "sku": "JA-FLD-001", "category": "Fluids", "brand": "FlowLab",
     "description": "Synthetic engine oil 5W-30, 4L jug.", "image_url": "https://images.unsplash.com/photo-1635771053408-7e6a5be37b3a?w=600",
     "price_bdt": 2400, "moq": 4, "stock": 300},
]


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    if await db.products.count_documents({}) == 0:
        for p in SEED_PRODUCTS:
            await db.products.insert_one({
                **p,
                "product_id": f"prd_{uuid.uuid4().hex[:10]}",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        logger.info(f"Seeded {len(SEED_PRODUCTS)} products")


@api_router.get("/")
async def root():
    return {"app": "Joy Automart B2B API", "ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
