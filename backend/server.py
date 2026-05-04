from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Header, Query, Cookie
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse,
)
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi.responses import Response as FastAPIResponse
from invoice_pdf import render_invoice_pdf
from notifications import (
    notify_kyc_decision, notify_order_placed, notify_order_status, notify_delivery_assigned,
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
    pricing_tier: str = "silver"  # retail | silver | gold | platinum | custom
    created_at: str


# Global tier discount map (percentage off retail)
TIER_DISCOUNTS = {"retail": 0.0, "silver": 0.05, "gold": 0.10, "platinum": 0.15}


def tier_price(retail_price: float, tier: str) -> float:
    disc = TIER_DISCOUNTS.get(tier, 0.05)
    return round(retail_price * (1 - disc), 2)

class Product(BaseModel):
    product_id: str
    name: str
    sku: str
    category: str
    description: str = ""
    image_url: str = ""
    price_bdt: float  # retail price
    cost_price_bdt: float = 0.0  # admin-only, for profit calc
    moq: int = 1
    stock: int = 100
    brand: str = ""
    is_kit: bool = False
    kit_tier: str = ""  # entry | mass | special | premium | flagship
    kit_features: List[str] = []
    gallery: List[str] = []
    is_featured: bool = False
    featured_discount_pct: float = 0.0  # e.g. 0.10 = 10% off for workshops
    featured_label: str = ""  # e.g. "Featured Kit · February"
    # Car compatibility: list of {brand, model, year_from, year_to, engine}
    car_fits: List[dict] = []
    # Bundles: if is_bundle=True, bundle_items = [{product_id, quantity}]
    is_bundle: bool = False
    bundle_items: List[dict] = []
    created_at: str

class CartItem(BaseModel):
    product_id: str
    quantity: int


# Volume discount tiers (subtotal in BDT -> discount %)
DISCOUNT_TIERS = [
    (300000, 0.10),  # ≥3 lakh => 10%
    (100000, 0.07),  # ≥1 lakh => 7%
    (50000, 0.05),   # ≥50k   => 5%
]


def calc_discount(subtotal: float) -> tuple:
    """Returns (discount_pct, discount_amount, tier_label)"""
    for threshold, pct in DISCOUNT_TIERS:
        if subtotal >= threshold:
            return pct, round(subtotal * pct, 2), f"Volume tier · ৳{int(threshold):,}+"
    return 0.0, 0.0, ""

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
async def list_products(request: Request, q: str = "", category: str = "",
                        car_brand: str = "", car_model: str = "", car_year: int = 0):
    flt = {}
    if q:
        flt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    if category:
        flt["category"] = category
    if car_brand:
        flt["car_fits.brand"] = {"$regex": f"^{car_brand}$", "$options": "i"}
    if car_model:
        flt["car_fits.model"] = {"$regex": car_model, "$options": "i"}
    items = await db.products.find(flt, {"_id": 0}).to_list(500)
    if car_year:
        items = [p for p in items if any(
            (f.get("year_from", 0) <= car_year <= f.get("year_to", 9999))
            for f in p.get("car_fits", [])
        ) or not p.get("car_fits")]

    # Apply workshop tier pricing if authenticated as workshop
    user = await get_current_user(request)
    tier = "retail"
    if user and user.get("role") == "workshop":
        ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if ws:
            tier = ws.get("pricing_tier", "silver")

    for p in items:
        p["retail_price_bdt"] = p["price_bdt"]
        p["your_price_bdt"] = tier_price(p["price_bdt"], tier)
        p["your_tier"] = tier
        p.pop("cost_price_bdt", None)  # Hide cost price from non-admins
    return items


@api_router.get("/products/{product_id}")
async def get_product(product_id: str, request: Request):
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    user = await get_current_user(request)
    tier = "retail"
    if user and user.get("role") == "workshop":
        ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if ws:
            tier = ws.get("pricing_tier", "silver")
    p["retail_price_bdt"] = p["price_bdt"]
    p["your_price_bdt"] = tier_price(p["price_bdt"], tier)
    p["your_tier"] = tier
    if not (user and user.get("role") == "admin"):
        p.pop("cost_price_bdt", None)
    # Resolve bundle items
    if p.get("is_bundle") and p.get("bundle_items"):
        resolved = []
        for bi in p["bundle_items"]:
            child = await db.products.find_one({"product_id": bi["product_id"]}, {"_id": 0})
            if child:
                resolved.append({**bi, "name": child["name"], "sku": child["sku"], "image_url": child.get("image_url", "")})
        p["bundle_items_resolved"] = resolved
    return p


class ProductCreate(BaseModel):
    name: str
    sku: str
    category: str
    description: str = ""
    image_url: str = ""
    price_bdt: float
    cost_price_bdt: float = 0.0
    moq: int = 1
    stock: int = 100
    brand: str = ""
    is_kit: bool = False
    kit_tier: str = ""
    kit_features: List[str] = []
    gallery: List[str] = []
    car_fits: List[dict] = []
    is_bundle: bool = False
    bundle_items: List[dict] = []

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

    tier = ws.get("pricing_tier", "silver")
    total = 0.0
    cost_total = 0.0
    line_items = []
    for ci in payload.items:
        p = await db.products.find_one({"product_id": ci.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Invalid product: {ci.product_id}")
        if ci.quantity < p.get("moq", 1):
            raise HTTPException(400, f"{p['name']} MOQ is {p['moq']}")
        unit_price = tier_price(p["price_bdt"], tier)
        line_total = unit_price * ci.quantity
        cost_total += p.get("cost_price_bdt", 0.0) * ci.quantity
        total += line_total
        line_items.append({
            "product_id": p["product_id"],
            "name": p["name"],
            "sku": p["sku"],
            "image_url": p.get("image_url", ""),
            "price_bdt": unit_price,
            "retail_price_bdt": p["price_bdt"],
            "cost_price_bdt": p.get("cost_price_bdt", 0.0),
            "quantity": ci.quantity,
            "line_total": line_total
        })

    # Apply volume-discount
    discount_pct, discount_amount, tier_label = calc_discount(total)
    grand_total = round(total - discount_amount, 2)

    if payload.payment_method == "credit":
        available = ws["credit_limit"] - ws["credit_used"]
        if grand_total > available:
            raise HTTPException(400, f"Insufficient credit. Available: ৳{available:.2f}")

    order_id = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc)
    due_date = (now + timedelta(days=30)).isoformat() if payload.payment_method == "credit" else None

    order = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "workshop_id": ws["workshop_id"],
        "company_name": ws["company_name"],
        "pricing_tier": tier,
        "items": line_items,
        "subtotal_bdt": total,
        "cost_total_bdt": cost_total,
        "discount_pct": discount_pct,
        "discount_amount_bdt": discount_amount,
        "discount_label": tier_label,
        "total_bdt": grand_total,
        "profit_bdt": round(grand_total - cost_total, 2),
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
            {"$inc": {"credit_used": grand_total}}
        )

    # Fire order-placed notification
    try:
        notify_order_placed(order, user.get("email", ""))
    except Exception as e:
        logger.warning(f"Order-placed notify failed: {e}")

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
    fresh = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    # Fire status-change notification
    try:
        owner = await db.users.find_one({"user_id": fresh["user_id"]}, {"_id": 0})
        if owner and owner.get("email"):
            notify_order_status(fresh, owner["email"], payload.status)
    except Exception as e:
        logger.warning(f"Status notify failed: {e}")
    return fresh


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
    ws = await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})
    # Fire notification (no-ops if Resend not configured)
    if ws:
        owner = await db.users.find_one({"user_id": ws["user_id"]}, {"_id": 0})
        if owner and owner.get("email"):
            try:
                notify_kyc_decision(ws, owner["email"])
            except Exception as e:
                logger.warning(f"KYC notify failed: {e}")
    return ws


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


class TierUpdate(BaseModel):
    pricing_tier: str  # retail | silver | gold | platinum | custom

@api_router.patch("/admin/workshops/{workshop_id}/tier")
async def admin_set_tier(workshop_id: str, payload: TierUpdate, request: Request):
    await require_admin(request)
    if payload.pricing_tier not in ["retail", "silver", "gold", "platinum", "custom"]:
        raise HTTPException(400, "Invalid tier")
    await db.workshops.update_one(
        {"workshop_id": workshop_id},
        {"$set": {"pricing_tier": payload.pricing_tier}}
    )
    return await db.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})


@api_router.get("/tiers")
async def get_tiers():
    return {"tiers": TIER_DISCOUNTS}


# ============= Part Requests (Sourcing) =============
class PartRequestCreate(BaseModel):
    car_brand: str
    car_model: str
    car_year: int = 0
    vin_chassis: str = ""
    part_name: str
    part_number: str = ""
    quantity: int = 1
    urgency: str = "normal"
    budget_bdt: float = 0.0
    notes: str = ""
    photo_urls: List[str] = []


@api_router.post("/part-requests")
async def create_part_request(payload: PartRequestCreate, request: Request):
    user = await require_user(request)
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(403, "Workshop only")
    if not payload.car_brand.strip() or not payload.part_name.strip():
        raise HTTPException(400, "Car brand and part name required")
    req_id = f"PRT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "request_id": req_id, "user_id": user["user_id"], "workshop_id": ws["workshop_id"],
        "company_name": ws["company_name"],
        "car_brand": payload.car_brand.strip(), "car_model": payload.car_model.strip(),
        "car_year": payload.car_year, "vin_chassis": payload.vin_chassis.strip(),
        "part_name": payload.part_name.strip(), "part_number": payload.part_number.strip(),
        "quantity": payload.quantity, "urgency": payload.urgency, "budget_bdt": payload.budget_bdt,
        "notes": payload.notes.strip(), "photo_urls": payload.photo_urls,
        "status": "new",
        "status_history": [{"status": "new", "at": now, "note": "Request submitted"}],
        "quote_bdt": 0.0, "quote_lead_time_days": 0,
        "supplier_note": "", "admin_note": "", "order_id": "",
        "created_at": now,
    }
    await db.part_requests.insert_one(dict(doc))
    return {"request_id": req_id, "ok": True}


@api_router.get("/part-requests")
async def list_my_part_requests(request: Request, status: str = ""):
    user = await require_user(request)
    flt = {}
    if user.get("role") == "workshop":
        flt["user_id"] = user["user_id"]
    if status:
        flt["status"] = status
    items = await db.part_requests.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.get("/part-requests/{request_id}")
async def get_part_request(request_id: str, request: Request):
    user = await require_user(request)
    r = await db.part_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Not found")
    if user.get("role") != "admin" and r["user_id"] != user["user_id"]:
        raise HTTPException(403, "Forbidden")
    return r


@api_router.get("/admin/part-requests")
async def admin_list_part_requests(request: Request, status: str = ""):
    await require_admin(request)
    flt = {}
    if status:
        flt["status"] = status
    items = await db.part_requests.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


class PartRequestUpdate(BaseModel):
    status: str = ""
    quote_bdt: float = 0.0
    quote_lead_time_days: int = 0
    supplier_note: str = ""
    admin_note: str = ""
    note: str = ""


@api_router.patch("/admin/part-requests/{request_id}")
async def admin_update_part_request(request_id: str, payload: PartRequestUpdate, request: Request):
    await require_admin(request)
    valid = ["new", "checking", "quoted", "confirmed", "ordered", "delivered", "cancelled"]
    update = {}
    if payload.quote_bdt > 0:
        update["quote_bdt"] = payload.quote_bdt
    if payload.quote_lead_time_days > 0:
        update["quote_lead_time_days"] = payload.quote_lead_time_days
    if payload.supplier_note:
        update["supplier_note"] = payload.supplier_note
    if payload.admin_note:
        update["admin_note"] = payload.admin_note
    push = {}
    if payload.status:
        if payload.status not in valid:
            raise HTTPException(400, f"Invalid status. Use: {valid}")
        update["status"] = payload.status
        push["status_history"] = {"status": payload.status,
                                  "at": datetime.now(timezone.utc).isoformat(), "note": payload.note}
    ops = {}
    if update:
        ops["$set"] = update
    if push:
        ops["$push"] = push
    if ops:
        await db.part_requests.update_one({"request_id": request_id}, ops)
    return await db.part_requests.find_one({"request_id": request_id}, {"_id": 0})


# ============= Suppliers =============
class SupplierCreate(BaseModel):
    name: str
    country: str = ""
    contact_person: str = ""
    phone_whatsapp: str = ""
    email: str = ""
    categories: List[str] = []
    moq: str = ""
    lead_time_days: int = 0
    payment_terms: str = ""
    rating: int = 0
    notes: str = ""


@api_router.get("/admin/suppliers")
async def admin_list_suppliers(request: Request):
    await require_admin(request)
    items = await db.suppliers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/admin/suppliers")
async def admin_create_supplier(payload: SupplierCreate, request: Request):
    await require_admin(request)
    if not payload.name.strip():
        raise HTTPException(400, "Name required")
    sid = f"sup_{uuid.uuid4().hex[:10]}"
    doc = {**payload.model_dump(), "supplier_id": sid, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.suppliers.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/suppliers/{supplier_id}")
async def admin_update_supplier(supplier_id: str, payload: SupplierCreate, request: Request):
    await require_admin(request)
    await db.suppliers.update_one({"supplier_id": supplier_id}, {"$set": payload.model_dump()})
    return await db.suppliers.find_one({"supplier_id": supplier_id}, {"_id": 0})


@api_router.delete("/admin/suppliers/{supplier_id}")
async def admin_delete_supplier(supplier_id: str, request: Request):
    await require_admin(request)
    await db.suppliers.delete_one({"supplier_id": supplier_id})
    return {"ok": True}


# ============= Reports =============
@api_router.get("/admin/reports/summary")
async def admin_reports_summary(request: Request):
    await require_admin(request)
    sales_pipe = [{"$group": {"_id": None, "revenue": {"$sum": "$total_bdt"},
                              "profit": {"$sum": "$profit_bdt"}, "count": {"$sum": 1}}}]
    s = await db.orders.aggregate(sales_pipe).to_list(1)
    revenue = s[0]["revenue"] if s else 0.0
    profit = s[0].get("profit", 0.0) if s else 0.0
    order_count = s[0]["count"] if s else 0
    top_pipe = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.sku", "name": {"$first": "$items.name"},
                    "quantity": {"$sum": "$items.quantity"},
                    "revenue": {"$sum": "$items.line_total"}}},
        {"$sort": {"quantity": -1}}, {"$limit": 20},
    ]
    top_skus = await db.orders.aggregate(top_pipe).to_list(20)
    top_skus = [{"sku": x["_id"], "name": x["name"], "quantity": x["quantity"], "revenue": x["revenue"]}
                for x in top_skus]
    ws_pipe = [
        {"$group": {"_id": "$workshop_id", "company_name": {"$first": "$company_name"},
                    "orders": {"$sum": 1}, "revenue": {"$sum": "$total_bdt"}}},
        {"$sort": {"revenue": -1}}, {"$limit": 20},
    ]
    top_workshops = await db.orders.aggregate(ws_pipe).to_list(20)
    top_workshops = [{"workshop_id": x["_id"], "company_name": x["company_name"],
                      "orders": x["orders"], "revenue": x["revenue"]} for x in top_workshops]
    cat_pipe = [
        {"$unwind": "$items"},
        {"$lookup": {"from": "products", "localField": "items.product_id",
                     "foreignField": "product_id", "as": "prod"}},
        {"$unwind": "$prod"},
        {"$group": {"_id": "$prod.category", "revenue": {"$sum": "$items.line_total"},
                    "quantity": {"$sum": "$items.quantity"}}},
        {"$sort": {"revenue": -1}},
    ]
    by_category = await db.orders.aggregate(cat_pipe).to_list(20)
    by_category = [{"category": x["_id"], "revenue": x["revenue"], "quantity": x["quantity"]}
                   for x in by_category]
    low_stock = await db.products.find({"stock": {"$lt": 10}},
                                       {"_id": 0, "name": 1, "sku": 1, "stock": 1}).to_list(50)
    return {
        "revenue_bdt": revenue, "profit_bdt": profit, "order_count": order_count,
        "gross_margin_pct": round((profit / revenue * 100) if revenue else 0.0, 2),
        "top_skus": top_skus, "top_workshops": top_workshops,
        "by_category": by_category, "low_stock": low_stock,
    }



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
    new_inquiries = await db.inquiries.count_documents({"status": "new"})
    new_part_requests = await db.part_requests.count_documents({"status": "new"})

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
        "new_inquiries": new_inquiries,
        "new_part_requests": new_part_requests,
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


@api_router.get("/featured-kit")
async def get_featured_kit():
    """Returns the currently featured kit with workshop pricing."""
    kit = await db.products.find_one({"is_kit": True, "is_featured": True}, {"_id": 0})
    if not kit:
        kit = await db.products.find_one({"is_kit": True, "kit_tier": "flagship"}, {"_id": 0})
        if kit:
            kit["is_featured"] = True
            kit["featured_discount_pct"] = 0.10
            kit["featured_label"] = "Featured Kit · This Month"
    if not kit:
        return None
    discount_pct = float(kit.get("featured_discount_pct", 0.0))
    original = float(kit["price_bdt"])
    workshop_price = round(original * (1 - discount_pct), 2)
    return {
        **kit,
        "workshop_price_bdt": workshop_price,
        "savings_bdt": round(original - workshop_price, 2),
    }


class FeaturedKitUpdate(BaseModel):
    sku: str
    discount_pct: float
    label: str = ""


@api_router.put("/admin/featured-kit")
async def admin_set_featured(payload: FeaturedKitUpdate, request: Request):
    await require_admin(request)
    if payload.discount_pct < 0 or payload.discount_pct > 0.5:
        raise HTTPException(400, "discount_pct must be between 0 and 0.5")
    # Clear previous featured
    await db.products.update_many(
        {"is_kit": True, "is_featured": True},
        {"$set": {"is_featured": False, "featured_discount_pct": 0.0, "featured_label": ""}},
    )
    # Set new
    res = await db.products.update_one(
        {"sku": payload.sku, "is_kit": True},
        {"$set": {
            "is_featured": True,
            "featured_discount_pct": payload.discount_pct,
            "featured_label": payload.label or "Featured Kit · This Month",
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Kit not found")
    return await db.products.find_one({"sku": payload.sku}, {"_id": 0})


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

    # Apply volume discount
    discount_pct, discount_amount, tier_label = calc_discount(total_bdt)
    grand_total = round(total_bdt - discount_amount, 2)

    # Convert BDT -> USD (Stripe doesn't natively support BDT in standard accounts)
    amount_usd = round(grand_total / USD_TO_BDT, 2)
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
        "subtotal_bdt": total_bdt,
        "discount_pct": discount_pct,
        "discount_amount_bdt": discount_amount,
        "discount_label": tier_label,
        "total_bdt": grand_total,
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
    try:
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(sess_req)
    except Exception as e:
        # Roll back orphaned draft order so /api/orders doesn't show ghost entries
        await db.orders.delete_one({"order_id": order_id})
        logger.error(f"Stripe session creation failed for order {order_id}: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway unavailable. Please try again.")

    # Record transaction
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "session_id": session.session_id,
        "order_id": order_id,
        "user_id": user["user_id"],
        "amount_bdt": grand_total,
        "amount_usd": amount_usd,
        "currency": "usd",
        "metadata": {"order_id": order_id, "user_id": user["user_id"]},
        "payment_status": "initiated",
        "status": "pending",
        "created_at": now.isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id, "order_id": order_id}


# ============= Quote / Discount =============
class QuoteRequest(BaseModel):
    items: List[CartItem]


@api_router.post("/quote")
async def quote_cart(payload: QuoteRequest, request: Request):
    """Live cart preview with applied volume discount tier."""
    await require_user(request)
    subtotal = 0.0
    for ci in payload.items:
        p = await db.products.find_one({"product_id": ci.product_id}, {"_id": 0})
        if not p:
            continue
        subtotal += p["price_bdt"] * ci.quantity
    discount_pct, discount_amount, tier_label = calc_discount(subtotal)
    grand_total = round(subtotal - discount_amount, 2)
    return {
        "subtotal_bdt": subtotal,
        "discount_pct": discount_pct,
        "discount_amount_bdt": discount_amount,
        "discount_label": tier_label,
        "total_bdt": grand_total,
        "tiers": [
            {"threshold_bdt": t, "discount_pct": p, "label": f"৳{int(t):,}+"} for t, p in DISCOUNT_TIERS
        ],
    }


# ============= Kit Inquiries (public) =============
class KitInquiry(BaseModel):
    name: str
    phone: str
    email: str = ""
    city: str = ""
    car_make_model: str
    kit_sku: str
    message: str = ""


@api_router.post("/inquiries")
async def submit_inquiry(payload: KitInquiry):
    """Public endpoint - retail customers submit kit install inquiries."""
    if not payload.name.strip() or not payload.phone.strip() or not payload.car_make_model.strip():
        raise HTTPException(400, "Name, phone, and car make/model required")
    kit = await db.products.find_one({"sku": payload.kit_sku, "is_kit": True}, {"_id": 0})
    inquiry_id = f"INQ-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "inquiry_id": inquiry_id,
        "name": payload.name.strip(),
        "phone": payload.phone.strip(),
        "email": payload.email.strip(),
        "city": payload.city.strip(),
        "car_make_model": payload.car_make_model.strip(),
        "kit_sku": payload.kit_sku,
        "kit_name": kit["name"] if kit else payload.kit_sku,
        "message": payload.message.strip(),
        "status": "new",  # new | contacted | scheduled | converted | closed
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inquiries.insert_one(dict(doc))
    return {"inquiry_id": inquiry_id, "ok": True}


@api_router.get("/admin/inquiries")
async def admin_list_inquiries(request: Request, status: str = ""):
    await require_admin(request)
    flt = {}
    if status:
        flt["status"] = status
    items = await db.inquiries.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


class InquiryStatusUpdate(BaseModel):
    status: str
    admin_note: str = ""


@api_router.patch("/admin/inquiries/{inquiry_id}")
async def admin_update_inquiry(inquiry_id: str, payload: InquiryStatusUpdate, request: Request):
    await require_admin(request)
    valid = ["new", "contacted", "scheduled", "converted", "closed"]
    if payload.status not in valid:
        raise HTTPException(400, f"Invalid status. Use: {valid}")
    await db.inquiries.update_one(
        {"inquiry_id": inquiry_id},
        {"$set": {"status": payload.status, "admin_note": payload.admin_note}},
    )
    return await db.inquiries.find_one({"inquiry_id": inquiry_id}, {"_id": 0})


# ============= Bulk CSV product import =============
@api_router.post("/admin/products/bulk-csv")
async def admin_bulk_csv_import(request: Request, file: UploadFile = File(...)):
    """Admin bulk-import products via CSV.
    Required headers: name,sku,category,price_bdt
    Optional: description,image_url,moq,stock,brand
    """
    await require_admin(request)
    import csv
    import io
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 CSV")

    reader = csv.DictReader(io.StringIO(text))
    required = {"name", "sku", "category", "price_bdt"}
    if not reader.fieldnames or not required.issubset(set(h.strip() for h in reader.fieldnames)):
        raise HTTPException(400, f"CSV missing required headers: {sorted(required)}")

    inserted, updated, errors = 0, 0, []
    for i, row in enumerate(reader, start=2):
        try:
            name = row.get("name", "").strip()
            sku = row.get("sku", "").strip()
            category = row.get("category", "").strip()
            price_str = row.get("price_bdt", "").strip()
            if not (name and sku and category and price_str):
                errors.append({"row": i, "error": "missing required field"})
                continue
            doc = {
                "name": name, "sku": sku, "category": category,
                "description": (row.get("description") or "").strip(),
                "image_url": (row.get("image_url") or "").strip(),
                "price_bdt": float(price_str),
                "moq": int(row.get("moq") or 1),
                "stock": int(row.get("stock") or 100),
                "brand": (row.get("brand") or "").strip(),
                "is_kit": False, "kit_tier": "", "kit_features": [], "gallery": [],
            }
            existing = await db.products.find_one({"sku": sku}, {"_id": 0})
            if existing:
                await db.products.update_one({"sku": sku}, {"$set": doc})
                updated += 1
            else:
                doc["product_id"] = f"prd_{uuid.uuid4().hex[:10]}"
                doc["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.products.insert_one(doc)
                inserted += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})

    return {"inserted": inserted, "updated": updated, "errors": errors[:20], "total_errors": len(errors)}


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


# ============= Delivery Persons =============
class DeliveryPerson(BaseModel):
    name: str
    phone: str
    nid_no: str = ""
    vehicle_type: str = ""  # bike | van | pickup | truck
    vehicle_no: str = ""
    coverage_areas: List[str] = []
    status: str = "active"  # active | inactive
    notes: str = ""


@api_router.get("/admin/delivery-persons")
async def admin_list_delivery_persons(request: Request, status: str = ""):
    await require_admin(request)
    flt = {}
    if status:
        flt["status"] = status
    items = await db.delivery_persons.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    # attach in-flight count
    for d in items:
        d["active_assignments"] = await db.orders.count_documents({
            "delivery_person_id": d["delivery_person_id"],
            "status": {"$in": ["packed", "shipped"]}
        })
    return items


@api_router.post("/admin/delivery-persons")
async def admin_create_delivery_person(payload: DeliveryPerson, request: Request):
    await require_admin(request)
    if not payload.name.strip() or not payload.phone.strip():
        raise HTTPException(400, "Name and phone required")
    did = f"dp_{uuid.uuid4().hex[:10]}"
    doc = {**payload.model_dump(), "delivery_person_id": did,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.delivery_persons.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/delivery-persons/{delivery_person_id}")
async def admin_update_delivery_person(delivery_person_id: str, payload: DeliveryPerson, request: Request):
    await require_admin(request)
    res = await db.delivery_persons.update_one(
        {"delivery_person_id": delivery_person_id},
        {"$set": payload.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Delivery person not found")
    return await db.delivery_persons.find_one({"delivery_person_id": delivery_person_id}, {"_id": 0})


@api_router.delete("/admin/delivery-persons/{delivery_person_id}")
async def admin_delete_delivery_person(delivery_person_id: str, request: Request):
    await require_admin(request)
    existing = await db.delivery_persons.find_one(
        {"delivery_person_id": delivery_person_id}, {"_id": 0, "delivery_person_id": 1}
    )
    if not existing:
        raise HTTPException(404, "Delivery person not found")
    inflight = await db.orders.count_documents({
        "delivery_person_id": delivery_person_id,
        "status": {"$in": ["packed", "shipped"]}
    })
    if inflight:
        raise HTTPException(400, f"Cannot delete: {inflight} active assignment(s)")
    await db.delivery_persons.delete_one({"delivery_person_id": delivery_person_id})
    return {"ok": True}


# ============= Order: Assign Delivery & Fee =============
class DeliveryAssignment(BaseModel):
    delivery_person_id: str = ""
    delivery_fee_bdt: Optional[float] = None
    expected_delivery_date: str = ""
    note: str = ""


@api_router.patch("/admin/orders/{order_id}/delivery")
async def admin_assign_delivery(order_id: str, payload: DeliveryAssignment, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    update = {}
    history_note = ""
    if payload.delivery_person_id:
        dp = await db.delivery_persons.find_one(
            {"delivery_person_id": payload.delivery_person_id}, {"_id": 0}
        )
        if not dp:
            raise HTTPException(400, "Invalid delivery person")
        update["delivery_person_id"] = dp["delivery_person_id"]
        update["delivery_person_name"] = dp["name"]
        update["delivery_person_phone"] = dp["phone"]
        update["delivery_vehicle_no"] = dp.get("vehicle_no", "")
        history_note = f"Delivery assigned to {dp['name']} ({dp['phone']})"
    if payload.delivery_fee_bdt is not None:
        if payload.delivery_fee_bdt < 0:
            raise HTTPException(400, "delivery_fee_bdt must be >= 0")
        # Adjust order total: remove previous fee, add new fee
        prev_fee = order.get("delivery_fee_bdt", 0.0)
        delta = payload.delivery_fee_bdt - prev_fee
        update["delivery_fee_bdt"] = payload.delivery_fee_bdt
        new_total = round(order.get("total_bdt", 0.0) + delta, 2)
        update["total_bdt"] = new_total
        update["profit_bdt"] = round(new_total - order.get("cost_total_bdt", 0.0), 2)
        # Adjust credit usage if credit-paid + still unpaid
        if order.get("payment_method") == "credit" and order.get("payment_status") != "paid" and abs(delta) > 0.001:
            await db.workshops.update_one(
                {"workshop_id": order["workshop_id"]},
                {"$inc": {"credit_used": delta}}
            )
    if payload.expected_delivery_date:
        update["expected_delivery_date"] = payload.expected_delivery_date

    ops = {}
    if update:
        ops["$set"] = update
    if history_note or payload.note:
        ops["$push"] = {"status_history": {
            "status": order.get("status", "placed"),
            "at": datetime.now(timezone.utc).isoformat(),
            "note": payload.note or history_note,
        }}
    if ops:
        await db.orders.update_one({"order_id": order_id}, ops)
    fresh = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    # Fire delivery-assigned notification (only when rider actually changed)
    if payload.delivery_person_id and fresh and fresh.get("delivery_person_name"):
        try:
            owner = await db.users.find_one({"user_id": fresh["user_id"]}, {"_id": 0})
            if owner and owner.get("email"):
                notify_delivery_assigned(fresh, owner["email"])
        except Exception as e:
            logger.warning(f"Delivery notify failed: {e}")
    return fresh


# ============= Invoice PDF =============
@api_router.get("/orders/{order_id}/invoice.pdf")
async def download_invoice_pdf(order_id: str, request: Request):
    user = await require_user(request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if user.get("role") != "admin" and order["user_id"] != user["user_id"]:
        raise HTTPException(403, "Forbidden")
    workshop = await db.workshops.find_one(
        {"workshop_id": order["workshop_id"]}, {"_id": 0}
    ) or None
    pdf_bytes = render_invoice_pdf(order, workshop)
    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="invoice-{order_id}.pdf"',
            "Cache-Control": "no-store",
        },
    )


# ============= Returns / RMA =============
RETURN_WINDOW_DAYS = 7


class ReturnItem(BaseModel):
    product_id: str
    quantity: int
    reason: str = ""


class ReturnCreate(BaseModel):
    order_id: str
    items: List[ReturnItem]
    reason: str = ""


def _parse_iso(s) -> Optional[datetime]:
    if not s:
        return None
    try:
        if isinstance(s, str):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        else:
            dt = s
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


@api_router.post("/returns")
async def create_return(payload: ReturnCreate, request: Request):
    user = await require_user(request)
    ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(403, "Workshop only")
    order = await db.orders.find_one({"order_id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["user_id"] != user["user_id"]:
        raise HTTPException(403, "Not your order")
    if order.get("status") != "delivered":
        raise HTTPException(400, "Returns only allowed after delivery")
    # Find delivered timestamp
    delivered_at = None
    for h in order.get("status_history", []):
        if h.get("status") == "delivered":
            delivered_at = _parse_iso(h.get("at"))
    if not delivered_at:
        delivered_at = _parse_iso(order.get("created_at"))
    if delivered_at and (datetime.now(timezone.utc) - delivered_at).days > RETURN_WINDOW_DAYS:
        raise HTTPException(400, f"Return window ({RETURN_WINDOW_DAYS} days) has passed")
    if not payload.items:
        raise HTTPException(400, "At least one item required")

    # Validate items vs order; cap qty by order qty
    order_lookup = {it["product_id"]: it for it in order.get("items", [])}
    order_subtotal = float(order.get("subtotal_bdt") or 0.0) or 1.0  # avoid div-by-zero
    order_total = float(order.get("total_bdt") or 0.0)
    # Effective discount factor: ratio of what customer actually paid (post discount, post fee)
    # vs the gross subtotal. Applied per-line so refund matches what they paid.
    effective_factor = (order_total / order_subtotal) if order_subtotal > 0 else 1.0
    # Cap factor at 1.0 (don't refund more than gross when delivery fee inflates total)
    if effective_factor > 1.0:
        effective_factor = 1.0
    enriched = []
    refund_total = 0.0
    for ri in payload.items:
        if ri.product_id not in order_lookup:
            raise HTTPException(400, f"Item {ri.product_id} not in order")
        if ri.quantity <= 0:
            raise HTTPException(400, "Quantity must be > 0")
        order_item = order_lookup[ri.product_id]
        if ri.quantity > order_item.get("quantity", 0):
            raise HTTPException(400, f"Quantity exceeds ordered for {order_item.get('name')}")
        gross_line = order_item.get("price_bdt", 0.0) * ri.quantity
        line_refund = round(gross_line * effective_factor, 2)
        refund_total += line_refund
        enriched.append({
            "product_id": ri.product_id,
            "sku": order_item.get("sku", ""),
            "name": order_item.get("name", ""),
            "image_url": order_item.get("image_url", ""),
            "quantity": ri.quantity,
            "price_bdt": order_item.get("price_bdt", 0.0),
            "line_refund_bdt": line_refund,
            "reason": ri.reason or payload.reason or "",
        })

    return_id = f"RMA-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "return_id": return_id,
        "order_id": order["order_id"],
        "user_id": user["user_id"],
        "workshop_id": ws["workshop_id"],
        "company_name": ws.get("company_name", ""),
        "items": enriched,
        "reason": payload.reason or "",
        "refund_total_bdt": round(refund_total, 2),
        "refund_method": "",  # set on approval
        "status": "requested",  # requested | approved | rejected | completed
        "admin_note": "",
        "status_history": [{"status": "requested", "at": now, "note": "Return requested"}],
        "created_at": now,
    }
    await db.returns.insert_one(dict(doc))
    return {"return_id": return_id, "ok": True}


@api_router.get("/returns")
async def list_my_returns(request: Request, status: str = ""):
    user = await require_user(request)
    flt = {}
    if user.get("role") != "admin":
        flt["user_id"] = user["user_id"]
    if status:
        flt["status"] = status
    items = await db.returns.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.get("/returns/{return_id}")
async def get_return(return_id: str, request: Request):
    user = await require_user(request)
    r = await db.returns.find_one({"return_id": return_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Not found")
    if user.get("role") != "admin" and r["user_id"] != user["user_id"]:
        raise HTTPException(403, "Forbidden")
    return r


class ReturnDecision(BaseModel):
    decision: str  # approved | rejected | completed
    refund_method: str = ""  # credit-back | reship | cash
    admin_note: str = ""


@api_router.patch("/admin/returns/{return_id}")
async def admin_decide_return(return_id: str, payload: ReturnDecision, request: Request):
    await require_admin(request)
    r = await db.returns.find_one({"return_id": return_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Return not found")
    if payload.decision not in ["approved", "rejected", "completed"]:
        raise HTTPException(400, "Invalid decision")
    if r["status"] in ["rejected", "completed"]:
        raise HTTPException(400, f"Return already {r['status']}")

    update = {
        "status": payload.decision,
        "admin_note": payload.admin_note or r.get("admin_note", ""),
    }
    if payload.refund_method:
        if payload.refund_method not in ["credit-back", "reship", "cash"]:
            raise HTTPException(400, "Invalid refund_method")
        update["refund_method"] = payload.refund_method

    # On approval: restock, refund credit if applicable
    if payload.decision == "approved" and r["status"] == "requested":
        for it in r["items"]:
            await db.products.update_one(
                {"product_id": it["product_id"]},
                {"$inc": {"stock": int(it["quantity"])}}
            )
        # If refund_method credit-back: decrement workshop's credit_used
        order = await db.orders.find_one({"order_id": r["order_id"]}, {"_id": 0})
        if (
            payload.refund_method == "credit-back"
            and order
            and order.get("payment_method") == "credit"
        ):
            await db.workshops.update_one(
                {"workshop_id": r["workshop_id"]},
                {"$inc": {"credit_used": -r["refund_total_bdt"]}}
            )

    now = datetime.now(timezone.utc).isoformat()
    history = {"status": payload.decision, "at": now, "note": payload.admin_note or ""}
    await db.returns.update_one(
        {"return_id": return_id},
        {"$set": update, "$push": {"status_history": history}}
    )
    return await db.returns.find_one({"return_id": return_id}, {"_id": 0})


@api_router.get("/admin/returns")
async def admin_list_returns(request: Request, status: str = ""):
    await require_admin(request)
    flt = {}
    if status:
        flt["status"] = status
    items = await db.returns.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


# ============= Service Packs (Bundles) =============
@api_router.get("/service-packs")
async def list_service_packs(request: Request):
    """Return all bundle products (service packs) with tier pricing."""
    items = await db.products.find(
        {"is_bundle": True}, {"_id": 0}
    ).sort("price_bdt", 1).to_list(100)
    user = await get_current_user(request)
    tier = "retail"
    if user and user.get("role") == "workshop":
        ws = await db.workshops.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if ws:
            tier = ws.get("pricing_tier", "silver")
    for p in items:
        p["retail_price_bdt"] = p["price_bdt"]
        p["your_price_bdt"] = tier_price(p["price_bdt"], tier)
        p["your_tier"] = tier
        p.pop("cost_price_bdt", None)
        # Resolve bundle items (read-only, names + skus)
        resolved = []
        for bi in p.get("bundle_items", []):
            child = await db.products.find_one(
                {"product_id": bi["product_id"]}, {"_id": 0}
            )
            if child:
                resolved.append({
                    "product_id": bi["product_id"],
                    "quantity": bi.get("quantity", 1),
                    "name": child["name"],
                    "sku": child["sku"],
                    "image_url": child.get("image_url", ""),
                })
        p["bundle_items_resolved"] = resolved
    return items




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


# ===== Service Packs (bundles built from existing SKUs) =====
SEED_SERVICE_PACKS = [
    {
        "name": "JOY Basic Service Pack",
        "sku": "JA-PACK-BASIC",
        "category": "Service Packs",
        "brand": "Joy Automart",
        "description": "Routine maintenance bundle: oil change + filters + spark plugs. Perfect for 5,000–10,000 km service.",
        "image_url": "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=600",
        "price_bdt": 4250,
        "moq": 1,
        "stock": 999,
        "is_bundle": True,
        "bundle_skus": [
            ("JA-FLD-001", 1),  # Engine oil 4L
            ("JA-ENG-001", 1),  # Oil filter
            ("JA-ENG-003", 1),  # Air filter
            ("JA-ENG-002", 4),  # Spark plug x4
        ],
    },
    {
        "name": "JOY Premium Service Pack",
        "sku": "JA-PACK-PREMIUM",
        "category": "Service Packs",
        "brand": "Joy Automart",
        "description": "Major service: oil + all filters + plugs + brake pads + fluids top-up. Recommended at 30,000 km.",
        "image_url": "https://images.unsplash.com/photo-1530027621759-29e6f5d28848?w=600",
        "price_bdt": 9800,
        "moq": 1,
        "stock": 999,
        "is_bundle": True,
        "bundle_skus": [
            ("JA-FLD-001", 2),
            ("JA-ENG-001", 1),
            ("JA-ENG-003", 1),
            ("JA-ENG-002", 4),
            ("JA-BRK-002", 1),  # Brake pad set
        ],
    },
    {
        "name": "JOY Brake Refresh Pack",
        "sku": "JA-PACK-BRAKE",
        "category": "Service Packs",
        "brand": "Joy Automart",
        "description": "Front-axle brake refresh: rotor pair + ceramic pads. Quiet, fade-resistant.",
        "image_url": "https://images.unsplash.com/photo-1760317890314-e964ffd7e6a6",
        "price_bdt": 11500,
        "moq": 1,
        "stock": 999,
        "is_bundle": True,
        "bundle_skus": [
            ("JA-BRK-001", 2),  # Disc rotor x2
            ("JA-BRK-002", 1),  # Pad set
        ],
    },
    {
        "name": "JOY Suspension Tune-Up Pack",
        "sku": "JA-PACK-SUSP",
        "category": "Service Packs",
        "brand": "Joy Automart",
        "description": "Rear shocks pair + front wheel bearings — restore that showroom ride feel.",
        "image_url": "https://images.unsplash.com/photo-1769218401073-71a5b1020c9b",
        "price_bdt": 14500,
        "moq": 1,
        "stock": 999,
        "is_bundle": True,
        "bundle_skus": [
            ("JA-SUS-001", 2),
            ("JA-SUS-002", 2),
        ],
    },
    {
        "name": "JOY Lighting Upgrade Pack",
        "sku": "JA-PACK-LIGHT",
        "category": "Service Packs",
        "brand": "Joy Automart",
        "description": "Convert your headlights to LED + premium H4 spares for quick swaps. Brighter & whiter.",
        "image_url": "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=600",
        "price_bdt": 6500,
        "moq": 1,
        "stock": 999,
        "is_bundle": True,
        "bundle_skus": [
            ("JA-LGT-001", 1),
            ("JA-ELC-001", 2),
        ],
    },
]


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    # Indexes (idempotent — Mongo creates if missing)
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.workshops.create_index("user_id", unique=True)
        await db.workshops.create_index("workshop_id", unique=True)
        await db.products.create_index("product_id", unique=True)
        await db.products.create_index("sku", unique=True, sparse=True)
        await db.products.create_index([("category", 1), ("is_kit", 1)])
        await db.products.create_index([("is_bundle", 1)])
        await db.orders.create_index("order_id", unique=True)
        await db.orders.create_index([("user_id", 1), ("created_at", -1)])
        await db.orders.create_index([("status", 1), ("created_at", -1)])
        await db.part_requests.create_index("request_id", unique=True)
        await db.part_requests.create_index([("user_id", 1), ("created_at", -1)])
        await db.delivery_persons.create_index("delivery_person_id", unique=True)
        await db.suppliers.create_index("supplier_id", unique=True)
        await db.returns.create_index("return_id", unique=True)
        await db.returns.create_index([("user_id", 1), ("created_at", -1)])
        await db.returns.create_index([("status", 1), ("created_at", -1)])
        logger.info("Indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")

    # Idempotent seed: only insert SKUs not already in DB
    existing_skus = set()
    async for d in db.products.find({}, {"_id": 0, "sku": 1}):
        sku = d.get("sku")
        if sku:
            existing_skus.add(sku)

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

    # Seed service packs (resolve bundle_skus -> bundle_items[product_id])
    for pack in SEED_SERVICE_PACKS:
        if pack["sku"] in existing_skus:
            continue
        bundle_items = []
        for sku, qty in pack["bundle_skus"]:
            child = await db.products.find_one({"sku": sku}, {"_id": 0, "product_id": 1})
            if child:
                bundle_items.append({"product_id": child["product_id"], "quantity": qty})
        if not bundle_items:
            logger.warning(f"Skipping service pack {pack['sku']}: no children resolved")
            continue
        pdoc = {k: v for k, v in pack.items() if k != "bundle_skus"}
        pdoc["bundle_items"] = bundle_items
        pdoc["product_id"] = f"prd_{uuid.uuid4().hex[:10]}"
        pdoc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.products.insert_one(pdoc)
        existing_skus.add(pack["sku"])
        logger.info(f"Seeded service pack: {pack['sku']}")

    # Auto-flag Cyber Beast as featured if no featured kit exists
    has_featured = await db.products.count_documents({"is_kit": True, "is_featured": True})
    if has_featured == 0:
        await db.products.update_one(
            {"sku": "JA-KIT-CYBER"},
            {"$set": {
                "is_featured": True,
                "featured_discount_pct": 0.10,
                "featured_label": "Featured Kit · This Month",
            }},
        )
        logger.info("Flagged Cyber Beast as featured kit")


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
