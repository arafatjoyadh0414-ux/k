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

## Phase 5 — Service Packs + Delivery Management (2026-05-04)
**Backend additions**
- `GET /api/service-packs` — public endpoint returning all bundle products with tier-priced `your_price_bdt`/`retail_price_bdt` and resolved `bundle_items_resolved[]` (name + sku + quantity per child)
- 5 seeded JOY service packs (idempotent at startup): JA-PACK-BASIC, JA-PACK-PREMIUM, JA-PACK-BRAKE, JA-PACK-SUSP, JA-PACK-LIGHT — each composed of existing SKUs
- Delivery Persons CRUD (`GET/POST/PUT/DELETE /api/admin/delivery-persons`) with `name/phone/nid_no/vehicle_type/vehicle_no/coverage_areas/status/notes` + `active_assignments` count per rider (orders in packed/shipped). Returns 404 for unknown IDs; rejects deletes when active assignments exist.
- `PATCH /api/admin/orders/{order_id}/delivery` — assigns rider (denormalises name/phone/vehicle onto order), sets delivery fee (Optional[float]; partial PATCH preserves existing fee), sets `expected_delivery_date`. Auto-adjusts `total_bdt` and `profit_bdt` by fee delta and credit-used by same delta when order is unpaid credit. Rejects negative fees with 400.

**Frontend additions**
- `/service-packs` workshop page with hero + 3-col responsive grid of pack cards. Tier discount visible (struck-through retail + savings badge). Add-to-cart for each pack.
- `/admin/delivery-persons` admin CRUD page with form, vehicle/area chips, active-assignments count, edit/delete actions
- `AdminOrderDetail` now has Delivery card: rider select, fee input, expected-date input, save button. Header shows assigned rider info. Order total auto-updates with fee.
- Workshop `OrderDetail` shows "Out for Delivery" card when admin has assigned a rider
- Sidebar nav: workshop gets "Service Packs" item; admin gets "Delivery Team" item

**Testing**: 18/18 Phase 4 backend pytest cases pass + e2e frontend flows validated. Action items addressed: Optional[float] fee semantics, negative-fee 400, 404 on unknown delivery_person_id, defensive option text.

## Phase 6 — Invoice PDF + Returns + i18n + Email Scaffolding (2026-05-04)
**Backend additions**
- `GET /api/orders/{order_id}/invoice.pdf` — JOY-letterhead PDF via reportlab (bill-to/ship-to/payment, items table, discounts/delivery breakdown, signature block)
- Returns/RMA endpoints: `POST /api/returns`, `GET /api/returns`, `GET /api/returns/{id}`, `GET /api/admin/returns`, `PATCH /api/admin/returns/{id}` — 7-day window from delivered, item validation, status flow (requested→approved/rejected→completed). On approval: `product.stock += qty` and `workshop.credit_used -= refund_total_bdt` if `credit-back` on credit order. Refund amount **prorated** by `total_bdt/subtotal_bdt` so volume-discounted orders refund what was actually paid.
- `notifications.py` — Resend email + SMS scaffolding gated behind `RESEND_API_KEY`/`SMS_PROVIDER` env vars. Triggers KYC-approval/rejection, order-placed, order-status-change, delivery-assigned. No-ops gracefully (single log line) when keys missing — never blocks API.
- New env vars: `RESEND_API_KEY`, `RESEND_FROM`, `APP_PUBLIC_URL`, `SMS_PROVIDER`

**Frontend additions**
- `LanguageContext` (en/bn dictionaries) + topbar **Bangla / English toggle** (data-testid=lang-toggle), persisted to localStorage. Currently translates sidebar nav + key labels — incrementally expandable.
- Workshop `/returns` list page; admin `/admin/returns` page with status filters, expandable rows, refund-method picker, approve/reject/complete actions
- `OrderDetail` (workshop) — replaced "Print" with **"Invoice PDF"** download button + **"Request Return"** button when `status=delivered` and within 7 days. Modal with per-item qty + reason + overall reason.
- `AdminOrderDetail` — adds Invoice PDF download
- New nav: workshop sidebar gets "Returns"; admin sidebar gets "Returns"

**Testing**: 29/29 Phase 5 backend pytest cases pass + full e2e frontend flows validated. Notification skip-logging confirmed. Refund proration applied (post-testing fix).

## Phase 7 — Commercial Polish (2026-05-04)
**Production hardening (no new features)**
- Removed hardcoded "Made with Emergent" badge from `frontend/public/index.html`. Belt-and-suspenders CSS + JS DOM observer in `index.css`/`index.js` to keep it gone if re-injected.
- Replaced placeholder `<title>` with **"JOY Automart · B2B Workshop Portal · Bangladesh"**; added Open Graph + Twitter card meta + JOY logo as favicon/apple-touch-icon.
- Footer rebuilt on Landing — 4-col grid (about + contact, Portal links, Legal links, Sign-off). Email/web links throughout.
- New static pages: `/terms` and `/privacy` (full Bangladesh-jurisdiction copy with KYC, credit, returns, sourcing, liability sections). Branded shell with header/footer.
- Catch-all `*` → branded 404 page (data-testid=not-found-page).
- MongoDB indexes added on startup for hot paths: `users.email`, `user_sessions.session_token` (TTL on `expires_at`), `workshops.user_id`, `products.sku/category/is_bundle`, `orders.user_id+created_at`, `orders.status+created_at`, `returns.user_id+created_at`, `delivery_persons`, `suppliers`. Idempotent.
- Cleaned dummy/test orders, returns, delivery persons left over from QA iterations.
- Footer link in Layout topbar now respects en/bn toggle.

**Status: COMMERCIAL READY** — pending only customer-supplied Resend/bKash/SSLCommerz keys for live notifications and online payments.

## Phase 8 — In-portal AI Assistant (2026-05-04)
**Backend additions**
- `POST /api/chat/message` and `GET /api/chat/history` — multi-turn assistant powered by Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via Emergent LLM key
- `ai_assistant.py` — system-prompt-based structured JSON output (`{reply, actions[]}`); auto-detects English / Bangla; injects workshop's tier prices, KYC, credit, and recent orders into the system prompt
- Action types: `show_product`, `show_kit`, `show_order`, `navigate`, `place_order` (gated behind KYC=approved + workshop role server-side)
- `chat_messages` collection with indexes on `session_id+created_at` and `user_id+created_at`
- Full history persisted; new sessions auto-create and the `session_id` is returned for follow-up turns
- Verified: tier discount honoured (gold 10% off), Bangla replies emit when user writes Bangla, multi-turn context preserved across 4+ turns, place_order needs explicit confirmation

**Frontend additions**
- `ChatWidget.jsx` — floating bottom-right bubble + slide-in drawer (auth-gated)
- Renders product cards with **[Add to cart]** button, order pills with deep links, navigate CTAs, and a confirm-order panel that calls `POST /api/orders` directly
- Greeting + 3 suggested-prompt chips (English or Bangla based on `LanguageContext`)
- Typing dots, multi-line composer, history restored on drawer reopen via `localStorage`-stored `session_id`

**Status**: live in preview. Pending: redeploy to push to production at `b2bjoymart.com`.

## Backlog (Prioritized)
**P0 — needs customer keys**
- `RESEND_API_KEY` for live email notifications (scaffolding done)
- bKash / SSLCommerz merchant keys for online payment go-live
- Google Cloud OAuth Client ID + Secret for custom JOY-branded login (replaces Emergent OAuth screen)

**P1**
- Expand i18n dictionary to Orders/Cart/Returns/PartRequest pages + toast strings
- Bulk-order CSV upload for workshops
- Live SMS dispatch (Twilio or bulksmsbd)
- "Make My Car" AI wizard + Chatbot
- Search log tracking (zero-result insights)
- Bulk CSV product import for admin
- Workshop branch / multi-user team accounts
- Driver mobile view (`/my-deliveries` filtered by phone)

**P2**
- **Refactor `server.py` (~2120 lines) into `/app/backend/routes/*.py` modules** (high priority — flagged 2 iterations in a row)
- Decimal/paisa-int money refactor
- Push notifications via web push
- Mobile app (React Native)
- Analytics dashboards (revenue trends, ageing receivables)
- Wishlist / saved-quotes
- Atomic return-approval (findOneAndUpdate to prevent race-condition restock)
- Persist `delivered_at` timestamp on orders (don't fall back to created_at for return window)
- Tighten admin-returns guard: block re-decide on already-approved returns (currently allowed for the approved→completed transition)
- Batch resolve for /service-packs bundle children ($lookup) to remove N+1
- Update Phase 3 tests to expect tier-discounted subtotals (5 stale tests)

## Tech Decisions
- Emergent Google Auth (no app passwords) → simpler, secure
- Single-collection per entity in MongoDB; UUID-based IDs; never expose `_id`
- Credit usage incremented on order, released on cancel/payment
- Soft-delete pattern for files; storage_key cached at startup
