# Joy Automart B2B Portal — PRD

## Original Problem Statement
> Build a B2B portal for auto repair workshops in Bangladesh. A full system where they have all info, past orders, new orders, track orders. Product list for online order. Credit system. KYC like trade license. Company name: Joy Automart. Retail website: www.joyautomart.com.

## User Personas
1. **Workshop Owner (primary)** — runs an auto-repair workshop in Bangladesh. Needs verified parts, transparent B2B pricing, and credit-backed ordering. Practical, mobile-aware, English-comfortable.
2. **Joy Automart Admin** — operations team that approves KYC, sets credit limits, manages catalog, and processes orders.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Routes prefixed `/api`. Auth via Emergent Google OAuth (httpOnly cookie + Authorization Bearer fallback). Object Storage via Emergent for KYC documents.
- **Frontend**: React 19 + Tailwind + shadcn/ui. Industrial Swiss/high-contrast theme — white/slate surfaces with Joy Automart red (#E11D48) accents. Cabinet Grotesk + IBM Plex Sans + JetBrains Mono.

## Core Requirements (static)
- Email/Google sign-in for workshops
- Workshop profile + KYC (trade license, NID, owner photo)
- Admin KYC approve/reject flow
- Admin-set credit limit per workshop, credit usage tracked
- Product catalog (search + category filter)
- Cart + checkout with **Pay on Credit** or **COD**
- Credit-limit enforcement on order placement
- Order tracking timeline (Placed → Confirmed → Packed → Shipped → Delivered)
- Order history per workshop, all-orders view for admin
- Mark payment received (admin), credit auto-released on payment

## What's Been Implemented (2026-02-09)
**Backend (`/app/backend/server.py`)**
- Emergent Google Auth (`/auth/session`, `/auth/me`, `/auth/logout`)
- Workshop profile + KYC upload (Object Storage) + submit-for-review
- Catalog endpoints (list/search/filter, get one)
- Order placement with KYC gating, MOQ check, credit-limit enforcement
- Order list/detail, status updates with history, mark-paid, credit auto-release
- Admin: stats, workshops list/detail, KYC decision, credit limit, products CRUD, order management
- File serving with owner/admin ACL
- 12 seed products auto-loaded on first start

**Frontend (`/app/frontend/src`)**
- Landing page with Google login
- Workshop dashboard (KYC banner, credit summary, recent orders)
- Product catalog with search + category filter
- Cart + Checkout (Credit/COD with credit-limit hint)
- Orders list + Order detail with timeline
- Profile + KYC upload page
- Admin: dashboard, workshops list, workshop detail (KYC review + credit), orders list, order detail (status updates, mark paid), products CRUD

**Testing**
- 33 backend pytest cases — all passing (100%)

## Phase 2 — Catalog Expansion + Online Checkout (2026-02-09)
**Backend additions**
- New endpoint `GET /api/kits` returning the 5 signature body kits ordered by tier
- Stripe Checkout integration via emergentintegrations: `POST /api/checkout/create`, `GET /api/checkout/status/{session_id}`, `POST /api/webhook/stripe`
- BDT→USD conversion at checkout (`USD_TO_BDT=120` env)
- Product schema extended: `is_kit`, `kit_tier`, `kit_features[]`, `gallery[]`
- Idempotent seed (only inserts SKUs not in DB)
- Orphaned-draft-order rollback if Stripe call fails
- Expanded SEED_PRODUCTS with 14 extra parts across new categories
- 5 Signature body kits seeded: Shadow GT (entry), Stealth V2 (mass), Badland X (special), Luxe VIP (premium), Cyber Beast (flagship)

**Frontend additions**
- `/kits` Signature Series showcase page with hero (Before/After), 5 tier-badged kit cards with feature lists and Add-to-Cart
- `/payment/return` polls Stripe checkout status and redirects to order page on success
- Cart now has 3 payment options: **Pay Online (Card)**, Pay on Credit, COD
- Sidebar nav adds "Signature Kits" entry
- Catalog filter expanded with 14 categories (Body Kits, Modifications, Performance, Accessories, Lighting, Tyres & Wheels, Tools, Audio + originals)
- Order detail handles `pending_payment` status

**Testing**
- 51/51 backend tests pass (18 new Phase 2 + 33 Phase 1 regression)

## Phase 4 — Full B2B Supply Platform (2026-02-09)
**Backend additions**
- Pricing tiers: `retail` (0%), `silver` (5%), `gold` (10%), `platinum` (15%), `custom` — per-workshop `pricing_tier` field
- `GET /api/products` and `/products/:id` now return `your_price_bdt`, `retail_price_bdt`, `your_tier` based on caller's workshop tier
- Car compatibility: `car_fits: [{brand, model, year_from, year_to, engine}]` on products; `?car_brand&car_model&car_year` query filter
- Cost price + profit: `cost_price_bdt` (admin only), orders store `cost_total_bdt` + `profit_bdt`
- **Part Requests (Sourcing)**: `POST /api/part-requests`, `GET /api/part-requests`, `GET /api/part-requests/:id`, admin list/update with quote + status flow (new → checking → quoted → confirmed → ordered → delivered → cancelled)
- **Suppliers CRUD**: `GET/POST/PUT/DELETE /api/admin/suppliers` with name/country/contact/whatsapp/categories/MOQ/lead-time/payment-terms/rating
- **Reports**: `GET /api/admin/reports/summary` — revenue, profit, margin, Top 20 SKUs, Top 20 workshops, revenue by category, low-stock alerts
- `PATCH /api/admin/workshops/:id/tier` to assign pricing tier
- Bundle product support: `is_bundle`, `bundle_items[]` with resolver on detail endpoint

**Frontend additions**
- Workshop `/part-requests` — new sourcing form (car/part/qty/urgency/budget/notes) + list with live quote & status
- Workshop `/products/:id` — full product detail page with gallery, description, kit features, compatibility chips, bundle contents, tier price vs retail, Add/Buy-now, related products
- Workshop `/products` — "Find parts for your car" filter bar (Brand/Model/Year) + tier-price display on every card with struck-through retail
- Admin `/admin/part-requests` — sourcing desk with quote editor (price + lead-time + supplier note + admin note + status)
- Admin `/admin/suppliers` — supplier CRUD cards with ratings, categories, terms
- Admin `/admin/reports` — KPIs + Top SKUs/Workshops/Categories + Low-stock, all with CSV export
- Admin workshop detail now has Pricing Tier selector

**Testing**: backend lint clean. UI verified via screenshots (Products with Gold-tier pricing, Request Any Part, Suppliers, Reports).

## Backlog (Prioritized)
**P0**
- Online payment gateway (bKash / SSLCommerz / Stripe) for online prepay option
- Transactional email/SMS notifications (KYC approved, order status changes)

**P1**
- Bangla language toggle (UI strings)
- Product variants (e.g., size, fitment) and images gallery
- Bulk CSV product import for admin
- Workshop branch / multi-user team accounts
- Returns / RMA workflow
- Invoice PDF generation per order

**P2**
- Loyalty / volume-discount tiers
- Push notifications via web push
- Mobile app (React Native)
- Analytics dashboards (revenue trends, top SKUs, ageing receivables)
- Wishlist / saved-quotes

## Tech Decisions
- Emergent Google Auth (no app passwords) → simpler, secure
- Single-collection per entity in MongoDB; UUID-based IDs; never expose `_id`
- Credit usage incremented on order, released on cancel/payment
- Soft-delete pattern for files; storage_key cached at startup
