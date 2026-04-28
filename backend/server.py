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
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")
USD_TO_BDT = float(os.environ.get("USD_TO_BDT", "120"))

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
    is_kit: bool = False
    kit_tier: str = ""  # entry | mass | special | premium | flagship
    kit_features: List[str] = []
    gallery: List[str] = []
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
    is_kit: bool = False
    kit_tier: str = ""
    kit_features: List[str] = []
    gallery: List[str] = []

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


# ============= Kits =============
@api_router.get("/kits")
async def list_kits():
    items = await db.products.find({"is_kit": True}, {"_id": 0}).to_list(50)
    # Sort by tier order: entry, mass, special, premium, flagship
    order = {"entry": 1, "mass": 2, "special": 3, "premium": 4, "flagship": 5}
    items.sort(key=lambda x: order.get(x.get("kit_tier", ""), 99))
    return items


# ============= Stripe =============
PAYMENT_METHODS = ["credit", "cod", "online"]


class StripeCheckoutCreate(BaseModel):
    items: List[CartItem]
    shipping_address: str
    notes: str = ""
    origin_url: str  # frontend origin (window.location.origin)


@api_router.post("/checkout/create")
async def create_stripe_checkout(payload: StripeCheckoutCreate, request: Request):
    user = await require_user(request)
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(403, "Workshop only")
    if ws["kyc_status"] != "approved":
        raise HTTPException(403, "KYC must be approved before placing orders")

    # Build line items + total ENTIRELY on backend (never trust frontend amounts)
    total_bdt = 0.0
    line_items = []
    for ci in payload.items:
        p = await db.products.find_one({"product_id": ci.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Invalid product: {ci.product_id}")
        if ci.quantity < p.get("moq", 1):
            raise HTTPException(400, f"{p['name']} MOQ is {p['moq']}")
        line_total = p["price_bdt"] * ci.quantity
        total_bdt += line_total
        line_items.append({
            "product_id": p["product_id"], "name": p["name"], "sku": p["sku"],
            "image_url": p.get("image_url", ""), "price_bdt": p["price_bdt"],
            "quantity": ci.quantity, "line_total": line_total,
        })

    # Convert BDT -> USD (Stripe doesn't natively support BDT in standard accounts)
    amount_usd = round(total_bdt / USD_TO_BDT, 2)
    if amount_usd < 1:
        amount_usd = 1.0  # Stripe minimum

    # Create draft order (status pending_payment) BEFORE redirecting
    order_id = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc)
    draft_order = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "workshop_id": ws["workshop_id"],
        "company_name": ws["company_name"],
        "items": line_items,
        "total_bdt": total_bdt,
        "payment_method": "online",
        "payment_status": "unpaid",
        "due_date": None,
        "shipping_address": payload.shipping_address,
        "notes": payload.notes,
        "status": "pending_payment",
        "status_history": [{"status": "pending_payment", "at": now.isoformat(), "note": "Awaiting online payment"}],
        "created_at": now.isoformat(),
    }
    await db.orders.insert_one(dict(draft_order))

    success_url = f"{payload.origin_url}/payment/return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{payload.origin_url}/cart"
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    sess_req = CheckoutSessionRequest(
        amount=float(amount_usd), currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata={"order_id": order_id, "user_id": user["user_id"], "workshop_id": ws["workshop_id"]},
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(sess_req)

    # Record transaction
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "session_id": session.session_id,
        "order_id": order_id,
        "user_id": user["user_id"],
        "amount_bdt": total_bdt,
        "amount_usd": amount_usd,
        "currency": "usd",
        "metadata": {"order_id": order_id, "user_id": user["user_id"]},
        "payment_status": "initiated",
        "status": "pending",
        "created_at": now.isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id, "order_id": order_id}


@api_router.get("/checkout/status/{session_id}")
async def stripe_checkout_status(session_id: str, request: Request):
    user = await require_user(request)
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Transaction not found")
    if txn["user_id"] != user["user_id"]:
        raise HTTPException(403, "Forbidden")

    # If already finalized, return cached
    if txn["payment_status"] == "paid":
        return {"payment_status": "paid", "status": "complete", "order_id": txn["order_id"]}

    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

    new_payment_status = status.payment_status
    new_status = status.status
    update = {"payment_status": new_payment_status, "status": new_status}
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})

    # If paid and order not yet finalized, finalize once
    if new_payment_status == "paid" and txn["payment_status"] != "paid":
        order = await db.orders.find_one({"order_id": txn["order_id"]}, {"_id": 0})
        if order and order.get("status") == "pending_payment":
            now = datetime.now(timezone.utc).isoformat()
            await db.orders.update_one(
                {"order_id": txn["order_id"]},
                {
                    "$set": {"status": "placed", "payment_status": "paid"},
                    "$push": {"status_history": {"status": "placed", "at": now, "note": "Online payment received"}},
                },
            )

    return {"payment_status": new_payment_status, "status": new_status, "order_id": txn["order_id"]}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(400, "Invalid webhook")

    if event.payment_status == "paid":
        txn = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
        if txn and txn["payment_status"] != "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "status": "complete"}},
            )
            order = await db.orders.find_one({"order_id": txn["order_id"]}, {"_id": 0})
            if order and order.get("status") == "pending_payment":
                now = datetime.now(timezone.utc).isoformat()
                await db.orders.update_one(
                    {"order_id": txn["order_id"]},
                    {
                        "$set": {"status": "placed", "payment_status": "paid"},
                        "$push": {"status_history": {"status": "placed", "at": now, "note": "Online payment received (webhook)"}},
                    },
                )
    return {"ok": True}


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

    # ===== Modifications =====
    {"name": "Cold Air Intake Kit", "sku": "JA-MOD-001", "category": "Modifications", "brand": "TurboFlow",
     "description": "High-flow cold air intake. Adds 8-12 hp on most 1.5L-2.5L engines.",
     "image_url": "https://images.unsplash.com/photo-1580414155951-8de2588a1d8c?w=600",
     "price_bdt": 18500, "moq": 1, "stock": 50},
    {"name": "Cat-Back Exhaust System", "sku": "JA-MOD-002", "category": "Modifications", "brand": "RoarTech",
     "description": "Stainless steel cat-back with twin tip. Deep aggressive note.",
     "image_url": "https://images.unsplash.com/photo-1635073908681-b4dfd1f01b03?w=600",
     "price_bdt": 42000, "moq": 1, "stock": 25},

    # ===== Performance =====
    {"name": "ECU Stage 1 Tune", "sku": "JA-PRF-001", "category": "Performance", "brand": "JoyTune",
     "description": "Custom Stage 1 ECU tune. +20% torque, dyno-validated.",
     "image_url": "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600",
     "price_bdt": 28000, "moq": 1, "stock": 100},
    {"name": "Performance Brake Caliper (4-Pot)", "sku": "JA-PRF-002", "category": "Performance", "brand": "ApexBrake",
     "description": "Forged 4-piston caliper with 330mm rotor kit.",
     "image_url": "https://images.unsplash.com/photo-1530027621759-29e6f5d28848?w=600",
     "price_bdt": 87000, "moq": 1, "stock": 15},

    # ===== Accessories =====
    {"name": "Premium Floor Mats (Set of 5)", "sku": "JA-ACC-001", "category": "Accessories", "brand": "JoyHome",
     "description": "All-weather TPE floor mats, custom-fit per model.",
     "image_url": "https://images.unsplash.com/photo-1542362567-b07e54358753?w=600",
     "price_bdt": 5800, "moq": 1, "stock": 200},
    {"name": "Dashcam 4K Front + Rear", "sku": "JA-ACC-002", "category": "Accessories", "brand": "EyeRoad",
     "description": "4K UHD dashcam with parking mode, GPS and 64GB storage.",
     "image_url": "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600",
     "price_bdt": 14500, "moq": 1, "stock": 80},

    # ===== Lighting =====
    {"name": "LED Headlight Conversion (Pair)", "sku": "JA-LGT-001", "category": "Lighting", "brand": "BrightLine",
     "description": "Plug-and-play LED H4 conversion, 6500K, 12000 lumens.",
     "image_url": "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=600",
     "price_bdt": 6800, "moq": 1, "stock": 120},
    {"name": "LED Light Bar 32-inch", "sku": "JA-LGT-002", "category": "Lighting", "brand": "TrailBeam",
     "description": "Off-road combo beam light bar with wiring kit.",
     "image_url": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600",
     "price_bdt": 12500, "moq": 1, "stock": 60},

    # ===== Tyres & Wheels =====
    {"name": "Alloy Wheel 18-inch (BKU Style)", "sku": "JA-WHL-001", "category": "Tyres & Wheels", "brand": "BKU",
     "description": "18-inch forged alloy wheel, gloss black. Sold individually.",
     "image_url": "https://images.unsplash.com/photo-1626387346567-68d0c692648d?w=600",
     "price_bdt": 18500, "moq": 4, "stock": 80},
    {"name": "All-Season Tyre 215/55R17", "sku": "JA-TYR-001", "category": "Tyres & Wheels", "brand": "GripPro",
     "description": "All-season touring tyre, 215/55R17. Quiet, long-life compound.",
     "image_url": "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=600",
     "price_bdt": 9500, "moq": 4, "stock": 200},

    # ===== Tools =====
    {"name": "Hydraulic Floor Jack 3-Ton", "sku": "JA-TOL-001", "category": "Tools", "brand": "HeavyLift",
     "description": "Low-profile 3-ton hydraulic jack with quick lift.",
     "image_url": "https://images.unsplash.com/photo-1632823469850-1b7b1e8b7e1c?w=600",
     "price_bdt": 11500, "moq": 1, "stock": 40},
    {"name": "OBD2 Diagnostic Scanner", "sku": "JA-TOL-002", "category": "Tools", "brand": "DiagPro",
     "description": "Multi-brand OBD2 scanner with live data and code reset.",
     "image_url": "https://images.unsplash.com/photo-1632823469850-1b7b1e8b7e1c?w=600",
     "price_bdt": 8500, "moq": 1, "stock": 60},

    # ===== Audio =====
    {"name": "Android Head Unit 10-inch", "sku": "JA-AUD-001", "category": "Audio", "brand": "BeatBox",
     "description": "10-inch Android head unit with CarPlay/Auto, 4+64GB.",
     "image_url": "https://images.unsplash.com/photo-1531104985437-d790bb43c9b6?w=600",
     "price_bdt": 22500, "moq": 1, "stock": 50},
    {"name": "6.5-inch Coaxial Speakers (Pair)", "sku": "JA-AUD-002", "category": "Audio", "brand": "BeatBox",
     "description": "200W peak coaxial speakers, silk dome tweeter.",
     "image_url": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600",
     "price_bdt": 4800, "moq": 1, "stock": 100},
]

# ===== Signature Body Kits =====
KIT_OVERVIEW_IMG = "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/4zbzw2t5_file_00000000f52c7207a61592d53fb54486.png"
KIT_SHADOW_IMG = "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/ftktdb9d_file_00000000e5c471fa9c15918ce1b6db0d.png"
KIT_STEALTH_ALT = "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/3110uf3f_file_00000000ddac71fa9cf015d8a30d68ef.png"
KIT_STEALTH_IMG = "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/b4d78cfy_file_00000000246c7207bd9ecb2d202ccfd3.png"
KIT_BASE_IMG = "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/1eis8km7_file_000000000e8072079096c123f02b91a0.png"

SEED_KITS = [
    {
        "name": "Shadow GT Body Kit", "sku": "JA-KIT-SHADOW", "category": "Body Kits", "brand": "Joy Performance",
        "description": "Sporty, balanced — the entry-performance hero. Aggressive without shouting.",
        "image_url": KIT_SHADOW_IMG, "price_bdt": 300000, "moq": 1, "stock": 12,
        "is_kit": True, "kit_tier": "entry",
        "kit_features": [
            "Aggressive GT Style", "Large Front Splitter", "Wide Fenders",
            "Side Skirts Extensions", "Rear Diffuser", "Roof Spoiler", "Carbon Accents",
        ],
        "gallery": [KIT_SHADOW_IMG, KIT_OVERVIEW_IMG, KIT_BASE_IMG],
    },
    {
        "name": "Stealth V2 Body Kit", "sku": "JA-KIT-STEALTH", "category": "Body Kits", "brand": "Joy Performance",
        "description": "Clean, aggressive, BD-roads friendly. The mass-market flagship for daily drivers.",
        "image_url": KIT_STEALTH_IMG, "price_bdt": 350000, "moq": 1, "stock": 18,
        "is_kit": True, "kit_tier": "mass",
        "kit_features": [
            "Stealth Fighter Look", "Angular Bumper Design", "Vented Wide Fenders",
            "Sharp Side Skirts", "Vented Hood", "Carbon Mirror Caps", "Rear Wing Spoiler",
        ],
        "gallery": [KIT_STEALTH_IMG, KIT_STEALTH_ALT, KIT_OVERVIEW_IMG],
    },
    {
        "name": "Badland X Body Kit", "sku": "JA-KIT-BADLAND", "category": "Body Kits", "brand": "Joy Performance",
        "description": "Off-road + rugged. Built for SUV lovers and adventure buyers.",
        "image_url": KIT_STEALTH_ALT, "price_bdt": 425000, "moq": 1, "stock": 8,
        "is_kit": True, "kit_tier": "special",
        "kit_features": [
            "Off-Road Widebody", "Rugged Bumper Design", "Bolt-On Fender Flares",
            "Rocker Panel Guards", "Roof Spoiler", "Rear Bumper Guard", "Matte Carbon Accents",
        ],
        "gallery": [KIT_STEALTH_ALT, KIT_OVERVIEW_IMG, KIT_BASE_IMG],
    },
    {
        "name": "Luxe VIP Body Kit", "sku": "JA-KIT-LUXE", "category": "Body Kits", "brand": "Joy Performance",
        "description": "Rich, smooth, black-on-black. The premium-seller for business class — Gulshan, Banani, Uttara.",
        "image_url": KIT_OVERVIEW_IMG, "price_bdt": 500000, "moq": 1, "stock": 6,
        "is_kit": True, "kit_tier": "premium",
        "kit_features": [
            "VIP Luxury Style", "Smooth Widebody Lines", "Chrome Delete",
            "Low Front Lip", "Extended Side Skirts", "Integrated Rear Lip", "Gloss Carbon Accents",
        ],
        "gallery": [KIT_OVERVIEW_IMG, KIT_STEALTH_IMG, KIT_BASE_IMG],
    },
    {
        "name": "Cyber Beast Body Kit", "sku": "JA-KIT-CYBER", "category": "Body Kits", "brand": "Joy Performance",
        "description": "Crazy. Aggressive. Viral. The flagship marketing weapon — show cars, influencers, launch campaigns.",
        "image_url": KIT_OVERVIEW_IMG, "price_bdt": 800000, "moq": 1, "stock": 3,
        "is_kit": True, "kit_tier": "flagship",
        "kit_features": [
            "Futuristic Cyber Look", "Geometric Body Lines", "Extreme Wide Flares",
            "Layered Side Skirts", "Rear Diffuser Blade", "Roof Wing", "Carbon Fiber Everywhere",
        ],
        "gallery": [KIT_OVERVIEW_IMG, KIT_STEALTH_IMG, KIT_SHADOW_IMG],
    },
]


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    # Idempotent seed: only insert SKUs not already in DB
    existing_skus = set()
    async for d in db.products.find({}, {"_id": 0, "sku": 1}):
        existing_skus.add(d["sku"])

    inserted = 0
    for p in SEED_PRODUCTS + SEED_KITS:
        if p["sku"] in existing_skus:
            continue
        doc = {
            **p,
            "is_kit": p.get("is_kit", False),
            "kit_tier": p.get("kit_tier", ""),
            "kit_features": p.get("kit_features", []),
            "gallery": p.get("gallery", []),
            "product_id": f"prd_{uuid.uuid4().hex[:10]}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.products.insert_one(doc)
        inserted += 1
    if inserted:
        logger.info(f"Seeded {inserted} new products/kits")


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
