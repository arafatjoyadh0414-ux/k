"""Shared Pydantic models used by route modules.

Importing this from route modules avoids the circular dependency that
would arise if models lived in `server.py` (since route modules already
import indirectly via `core`).
"""

from typing import List, Optional
from pydantic import BaseModel, Field

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


# Global tier discount map and helpers live in core.py

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


# Volume discount tiers and helper live in core.py

class OrderCreate(BaseModel):
    items: List[CartItem]
    payment_method: str  # credit | cod
    shipping_address: str
    notes: str = ""


# Auth helpers (get_current_user, require_user, require_admin) live in core.py


