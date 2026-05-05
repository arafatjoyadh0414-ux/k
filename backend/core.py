"""Shared core for Joy Automart B2B API.

Owns the FastAPI app, the /api router, MongoDB client/db, env vars,
auth helpers, storage helpers, and small utility functions used by
multiple route modules.

Importing from this module is safe: nothing here imports from `server`
or any `routes/*` module, so there are no circular import risks.
"""

import os
import logging
import uuid
import json
import requests
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from fastapi import (
    FastAPI, APIRouter, HTTPException, Request, Response,
    UploadFile, File, Form, Header, Query, Cookie,
)
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient


# ============= Environment =============
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
storage_key: Optional[str] = None


# ============= App & Router =============
app = FastAPI(title="Joy Automart B2B API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============= Object Storage =============
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
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ============= Pricing & Discounts =============
TIER_DISCOUNTS = {"retail": 0.0, "silver": 0.05, "gold": 0.10, "platinum": 0.15}


def tier_price(retail_price: float, tier: str) -> float:
    disc = TIER_DISCOUNTS.get(tier, 0.05)
    return round(retail_price * (1 - disc), 2)


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


# ============= Date/Time util =============
def parse_iso(s) -> Optional[datetime]:
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


# Backwards-compat alias used in some places
_parse_iso = parse_iso


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
