from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Header, Query, Cookie
from starlette.middleware.cors import CORSMiddleware
import os
import uuid
import json
import requests
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

# Shared singletons & helpers live in core.py — single source of truth.
from core import (
    app, api_router, db, client, logger,
    EMERGENT_LLM_KEY, ADMIN_EMAILS, STRIPE_API_KEY, USD_TO_BDT, APP_NAME,
    init_storage, put_object, get_object,
    tier_price, calc_discount, _parse_iso,
    TIER_DISCOUNTS, DISCOUNT_TIERS,
    get_current_user, require_user, require_admin,
)



# ============= Models =============

# Route modules — importing them registers their decorators on api_router.
from routes import insights as _insights_routes  # noqa: F401
from routes import chat as _chat_routes  # noqa: F401
from routes import auth_workshop as _auth_routes  # noqa: F401
from routes import products as _products_routes  # noqa: F401
from routes import orders as _orders_routes  # noqa: F401
from routes import admin_misc as _admin_routes  # noqa: F401
from routes import sourcing as _sourcing_routes  # noqa: F401
from routes import payments as _payments_routes  # noqa: F401
from routes import catalog as _catalog_routes  # noqa: F401
from routes import returns as _returns_routes  # noqa: F401
from routes import driver as _driver_routes  # noqa: F401
from routes import vin as _vin_routes  # noqa: F401
from routes import recurring as _recurring_routes  # noqa: F401
from routes import customer_photos as _cust_photos_routes  # noqa: F401
from routes import public_stats as _public_stats_routes  # noqa: F401
from routes import team as _team_routes  # noqa: F401
from routes import fleets as _fleets_routes  # noqa: F401
from routes.recurring import start_recurring_worker

# Pydantic models (kept here for back-compat). Authoritative copies live in server_models.py.
from server_models import User, Workshop, Product, CartItem, OrderCreate  # noqa: F401

from routes.insights import evaluate_and_apply_auto_upgrade  # noqa: F401


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
    {
        "name": "JOY Beast Wide Body Kit (BYD Sealion 6)",
        "sku": "JA-KIT-JOYBEAST",
        "category": "Body Kits",
        "brand": "Joy Performance",
        "description": (
            "Bigger. Meaner. Unstoppable. Transform your BYD Sealion 6 into a head-turning beast on every road. "
            "OEM-precision widebody fitment with carbon-fiber-look glass, 21\" alloy wheels with premium tyres, "
            "and a paint-ready surface. Full package fitted, including rims & tyres."
        ),
        "image_url": "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/643f6kpt_file_0000000065c872078d88514e4cc0cb6c.png",
        "price_bdt": 420000, "moq": 1, "stock": 15,
        "is_kit": True, "kit_tier": "special",
        "kit_features": [
            "Aggressive Widebody Stance — Maximum Road Presence",
            "Front Bumper + Front Lip Splitter",
            "Side Skirts (Left & Right)",
            "Widebody Fender Flares (full set)",
            "Rear Diffuser + Rear Spoiler (Big Wing)",
            "21\" Alloy Wheels with BYD Logo Center Cap",
            "Premium Tyres Included",
            "Carbon-Fiber-Look Glass — UV Protection, Heat Resistant",
            "Carbon-Fiber Mirror Cover (ABS)",
            "OEM-Level Precision Fitment for BYD Sealion 6",
            "Paint-Ready Surface — Smooth Finish",
            "Easy Installation (Screw & Clip Mounting)",
            "Free Gift: Adhesive Promoter (stronger bond)",
            "100% Fitment Guarantee · 48–72H Installation",
        ],
        "gallery": [
            "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/643f6kpt_file_0000000065c872078d88514e4cc0cb6c.png",
            "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/rldm8yat_file_00000000736c72068cf0c3a64a5f3a22.png",
            "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/4nw424xo_file_00000000df7471faacaa015e25ab7b23.png",
            "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/xkiyc362_file_00000000c6d87207a953d9af1719d04a.png",
        ],
        "car_fits": ["BYD Sealion 6", "BYD"],
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
        await db.chat_messages.create_index("message_id", unique=True)
        await db.chat_messages.create_index([("session_id", 1), ("created_at", 1)])
        await db.chat_messages.create_index([("user_id", 1), ("created_at", -1)])
        await db.recurring_orders.create_index("recurring_id", unique=True)
        await db.recurring_orders.create_index([("is_active", 1), ("next_run_at", 1)])
        await db.recurring_orders.create_index([("user_id", 1), ("created_at", -1)])
        await db.vin_cache.create_index("vin", unique=True)
        await db.saved_vins.create_index([("user_id", 1), ("created_at", -1)])
        logger.info("Indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")

    # Start the recurring-orders background worker
    try:
        start_recurring_worker()
    except Exception as e:
        logger.warning(f"Recurring worker start failed: {e}")

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
