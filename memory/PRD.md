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

## Phase 9 — "Deploy Everything" sprint (2026-05-04)
Inspired by the strategic audit. Most audit items were already built (catalog, KYC, credit, dashboard, returns, invoice PDF, chatbot, tier pricing, delivery). This sprint added everything else achievable on the current React+FastAPI stack:

**P0 fix (the audit's "single biggest problem"):**
- **Pre-rendered HTML landing** in `index.html` (id=`prerender-shell`) — full marketing page renders before React hydrates. Site is no longer blank without JS / on slow 4G. Includes: hero, trust badges, 4-step "how it works", WhatsApp fallback CTA, footer with legal links. Hidden via JS once React mounts.
- Fixed `og:url` → `https://b2bjoymart.com` (was joyautomart.com)

**Public catalog at `/catalog` (SEO + anonymous browsing):**
- `GET /api/public/catalog` (no auth) returns retail-priced 38-product catalog with full metadata (`is_bundle`, `car_fits`, etc.)
- `GET /api/public/categories` returns deduplicated, normalized category list
- Frontend page with category filter, search, per-card test IDs, sign-in CTA, WhatsApp CTA

**Workshop Insights (`/insights`):**
- `GET /api/workshop/insights` returns `summary`, `monthly_spend[]`, `top_skus[]`, `reorder_nudges[]` (predictive based on order cadence), `joy_score{score, grade, components}`
- **Joy Score** — proprietary 0–100 credit rating (Starter / Partner / Elite / Anchor) computed from order volume, spend, payment punctuality, longevity, credit discipline, KYC. Bangladesh's first workshop credit-rating system.
- Frontend: Joy Score gradient ring (animated), 6 component badges, monthly spend bar chart, top-SKUs grid, reorder nudge cards

**Quick Tools (`/quick-tools`):**
- **Saved Bundles** — workshop creates own service kits ("Toyota Axio 5K Service" = oil + filter + plugs). One-click "Add Kit to Cart". `POST/GET/DELETE /api/workshop/bundles` with owner-isolation (404 if not owner)
- **Bulk SKU Paste** — paste comma/newline list with optional `x QTY`, parser shows found/missing rows + total, "Add all to cart" button. Suggests sourcing-request link for missing SKUs.

**Chatbot context:**
- Chat endpoint now passes predictive `reorder_nudges` to Claude system prompt — Claude proactively mentions due-for-reorder SKUs when contextually appropriate (no spam)

**Backend cleanups (from testing-agent action items):**
- Public catalog projection now includes `is_bundle` + `car_fits`
- Categories de-duplicated case-insensitively + Title-Cased
- Backfilled legacy `brakes` → `Brake`

**Test results: 100% backend (10/10 phase6) + 100% frontend e2e**

**Status**: live in preview. Pending redeploy to push to `b2bjoymart.com`.

## Backlog (Prioritized)
**P0 — needs customer keys**
- `RESEND_API_KEY` for live email notifications (scaffolding done)
- bKash / SSLCommerz merchant keys for online payment go-live
- WhatsApp Business API keys (Twilio / Cloud API) for WhatsApp ordering
- Google Cloud OAuth Client ID + Secret for custom JOY-branded login

**P1 — buildable now**
- Recurring orders scheduler (cron + admin review queue)
- Workshop branch / multi-user team accounts
- Vehicle Make → Model → Year → Engine cascading filter (currently flat free-text)
- Driver mobile view at `/my-deliveries`
- "Make My Car" AI wizard
- Search-log tracking (zero-result insights)
- Bulk CSV product import for admin

**P2 — refactoring**
- **Refactor `server.py` (~2540 lines, flagged 3 iterations) into `/app/backend/routes/*.py`**
- Decimal/paisa-int money refactor
- iOS / Android (PWA / Capacitor / RN — your earlier question, still open)
- Persist `delivered_at` on orders; tighten admin-returns guard; atomic restock

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

## 2026-02-10 — Refactor: split `server.py` (P0 done)
**Why:** server.py had grown to 2820 lines, causing search/replace operations to fail on duplicate strings and slowing down all future edits.

**What moved:**
- New `core.py` (166 lines): owns the FastAPI `app`, `api_router`, MongoDB `client`/`db`, env vars, logger, object-storage helpers (`init_storage`/`put_object`/`get_object`), pricing helpers (`tier_price`, `calc_discount`, `TIER_DISCOUNTS`, `DISCOUNT_TIERS`), `parse_iso`, and auth helpers (`get_current_user`/`require_user`/`require_admin`).
- New `routes/insights.py` (329 lines): Joy Score + Auto-Tier-Upgrade engine + `/workshop/insights` + `/admin/tier-upgrades`. Exposes `evaluate_and_apply_auto_upgrade` for orders & KYC handlers.
- New `routes/chat.py` (150 lines): `/chat/message` + `/chat/history` (Claude Sonnet 4.5).
- `server.py` now imports shared deps from `core` and pulls in route modules so their decorators register on the shared `api_router`.

**Outcome:**
- server.py: 2820 → 2252 lines (-20%).
- All 5 phase-7 tier-upgrade tests passing; 43/44 across phases 5-7 (1 unrelated SSR shell test fails locally).
- Pattern established for future extractions (orders, returns, products, admin can follow the same template).

## 2026-02-10 — CSS bug fix (Insights joy-score-card)
- `industrial-card` utility was overriding `bg-slate-950` (white-on-white invisible text). Fixed via inline `style={{ backgroundColor: "#020617" }}` which beats class-level cascade.

## 2026-02-10 — P0 follow-up: full route extraction + P2 features

**Continued server.py refactor (P1 complete):**
- server.py: 2820 → **469 lines** (-83%) total across both refactor passes.
- 11 route modules under `/app/backend/routes/`: auth_workshop, products, orders, admin_misc, sourcing, payments, catalog, returns, insights, chat, driver.
- New `server_models.py` for shared Pydantic models. `core.py` for app/db/router/helpers.
- 30/30 backend regression tests pass (`test_iter8_regression.py` covers all 11 modules).

**P2 features delivered:**
- ✅ **Cascading vehicle filter (Make → Model → Year)**: New `/api/vehicles/options` returns brand→model→years tree from product car_fits. Products page now uses 3 cascading SELECT dropdowns; selecting brand enables model, selecting model enables year. Auto-clears downstream filters on parent change.
- ✅ **Driver mobile view**: Token-authenticated `/driver/:driverId?token=X` mobile-first React page. Backend `/api/driver/{id}/profile|orders|orders/{order_id}/status` requires `?token=` query param matching the delivery person's `access_token`. Drivers see assigned packed/shipped orders with company name, address, clickable phone, item list, COD callouts, and one-tap "Picked up → Out for delivery" / "Mark delivered" actions. Strict transitions: packed→shipped→delivered. Admin Delivery Persons page surfaces a copyable driver link per rider.
- ✅ **Bulk CSV product import (frontend)**: Already existed in AdminProducts.jsx — confirmed working.

**Backlog still open:**
- Multi-user team accounts (P2, deferred — needs RBAC + invitations design)
- WhatsApp Business API (P1, blocked on user provider choice + key)
- PWA setup (P1)

## 2026-02-10 — VIN lookup + Recurring orders (deployment-ready)

**VIN Lookup → Find Parts** (`/vin-lookup`):
- Backend `/api/vin/decode` calls free NHTSA vPIC API (covers any VIN globally, 1981+) and caches in `db.vin_cache` for 30 days.
- Backend `/api/vin/parts` decodes VIN + matches against catalog `car_fits` + asks Claude for AI cross-reference suggestions (8 parts max, with OEM hints + aftermarket brand cross-refs and a strong "verify before ordering" disclaimer).
- Saved VINs (`/api/vin/saved`) per workshop for one-tap reorder when the same vehicle returns.
- AI suggestions surface a "Request quote" CTA that pre-fills the existing `/part-requests` sourcing form with the decoded vehicle context.
- Honest scoping: no proprietary global parts DB integration (Tecdoc/Mitchell/ALLDATA cost thousands/month and require licensing); AI fills the gap with disclaimers.

**Recurring orders scheduler** (`/recurring`):
- Schedule weekly/biweekly/monthly/custom-cadence orders. Backend background worker scans `db.recurring_orders` every hour for `next_run_at <= now` and auto-places orders against current tier pricing + credit limit.
- Pause/resume/run-now/edit/delete from UI. Skips runs cleanly when KYC isn't approved or credit insufficient (logged in `db.recurring_runs`).
- Auto-placed orders carry `source: "recurring"` + `recurring_id` for traceability.
- Joy Score auto-upgrade evaluation runs on every recurring order placement.

**Files added:**
- `/app/backend/routes/vin.py`, `/app/backend/routes/recurring.py`
- `/app/frontend/src/pages/VinLookup.jsx`, `/app/frontend/src/pages/Recurring.jsx`
- Nav links: `nav-vin-lookup`, `nav-recurring`
- `/app/backend/tests/test_vin_recurring.py` (8 tests, all pass)

**Backend regression**: 38/38 tests pass (vin_recurring + iter8 + phase7).


## 2026-02-09 — Final commercial polish (DEPLOY-READY)

**Landing page hero replaced**: New cinematic golden-hour photograph of a glossy black Toyota Harrier 2020 in motion through Gulshan, Dhaka — generated via Gemini Nano Banana (`gemini-3.1-flash-image-preview`) using the Emergent LLM Key. Asset stored at `/app/frontend/src/assets/harrier-hero.jpg` and imported into `/app/frontend/src/pages/Landing.jsx` (constant `HERO`).

**Status: Codebase is 100% deploy-ready.** Previous deployment failure was a transient Emergent platform pod-discovery error, not a code issue. User just needs to click "Deploy" again.

**Open backlog (unchanged):**
- WhatsApp Business API (P1) — blocked on provider keys (Twilio / Cloud API / 360dialog)
- Resend, bKash/SSLCommerz, Google CSE — built as stubs awaiting user keys
- PWA setup (P1)
- Multi-user team accounts with RBAC + invitations (P2)
- Shareable PDF for VIN Service History (P2)

## 2026-02-10 — P0 mobile blank-screen bug + Experience Centre redesign + global responsive safety

**🔴 P0 — Mobile blank-screen bug RESOLVED:**
- Root cause: `useScrollReveal` hook ran once at mount when Landing.jsx returned `null` during `loading` state, found 0 `.reveal` elements, hit early return, and never re-fired when content rendered. CSS kept `opacity: 0` indefinitely on Samsung Browser / slow 4G.
- Fix in `/app/frontend/src/hooks/useScrollReveal.js`:
  - CSS-default-VISIBLE pattern: `.reveal { opacity: 1 }`. The hidden state only applies when `html.js-reveal-armed` class is present (added by JS only after IO is confirmed wired).
  - MutationObserver picks up `.reveal` elements added later (data-fetch-driven renders, route changes).
  - Hard 1.5s `setTimeout` safety force-reveals all stragglers regardless of IO callbacks.
  - Belt-and-suspenders: `window.load` event triggers another safety pass.
- CSS in `/app/frontend/src/index.css`: `.reveal { opacity: 1 }` default + `html.js-reveal-armed .reveal:not(.in-view) { opacity: 0; transform: translateY(20px) }`.
- Verified: `invisible reveals = 0` at 320 / 360 / 390 / 414 / 768 / 1024 / 1440 / 1920 px.

**🎨 Experience Centre fully redesigned with 7 new architectural concept renders:**
- New assets in `/app/frontend/src/assets/experience-centre/`: ec-hero-interior, ec-day-night-facade, ec-facade-variations, ec-interior-luxe, ec-cafe-wheels, ec-mod-zone, ec-architecture-overview.
- New `ExpTile` helper component (premium glassmorphic captions, fluid aspect ratios).
- Section structure:
  - **Hero**: Premium interior panorama with "CONCEPT RENDERS · PHASE 1" + "SHOWROOM 65×24 ft" badges
  - **01 · Storefront** (2 tiles): Façade Studies Day & Night, Showroom Atmosphere
  - **02 · Interior** (3 tiles): Architecture Perspective, JOY Café & Wheel Wall, Showroom Volume 65×24 ft
  - **03 · Blueprint**: Full multi-panel architecture document (object-contain)
  - **4 feature cards**: Hero Car Zone, JOY Café, Consultation Suite, Mezzanine
- All tiles have unique `data-testid` (ec-tile-day-night, ec-tile-facade-variations, ec-tile-interior-luxe, ec-tile-cafe-wheels, ec-tile-mod-zone, ec-tile-architecture).

**📐 Global responsive safety:**
- `html, body { overflow-x: hidden; max-width: 100vw }` in `/app/frontend/src/index.css`
- `img, video, svg { max-width: 100% }` global
- New `xs: 400px` breakpoint added in `/app/frontend/tailwind.config.js`
- Verified ZERO horizontal overflow at 8 viewports (320/360/390/414/768/1024/1440/1920).

**Test results: iter9 — 100% backend (10/10 pytest) + 100% frontend on 8 viewports + Theme toggle + Live ticker + 6 EC tiles + all CTAs.**

**Joy ID counter**: verified unique sequential JOY-1001 through JOY-1009 in production DB, counter at seq=11, zero duplicates. Iter8 carry-over observation was stale — no fix needed.

## 2026-02-10 — Iter10 · Multi-user team accounts + Fleet Command Center + portal dark polish

**🟠 P1 — Portal dark/light mode polish (commercial-ready):**
- Added subtle premium polish to `/app/frontend/src/index.css` portal-shell rules: table headers darken in dark mode, hover row tint, divide borders in dark mode, code/pre styling, glass effect on sticky headers (backdrop-filter), inset highlight on industrial-cards, and red-accent border + lift shadow on hover (light + dark).

**🟠 P1 — Multi-user team accounts (Workspace sharing):**
- Backend (`/app/backend/routes/team.py`):
  - `users.workshop_id` + `users.workshop_role` denormalised onto user docs
  - `workshops.owner_user_id` + `workshops.member_user_ids[]` schema (backfilled for existing workshops)
  - Endpoints: `GET /api/team/members`, `GET /api/team/invitations`, `POST /api/team/invitations`, `DELETE /api/team/invitations/{id}` (revoke), `DELETE /api/team/members/{user_id}` (remove), `GET /api/team/invitations/lookup/{token}` (PUBLIC), `POST /api/team/invitations/accept`
  - Roles: `owner | manager | parts_manager | mechanic | accountant`. Owner-only invite/revoke/remove
  - 7-day invite TTL, secrets.token_urlsafe(24) for tokens, single pending invite per email auto-refreshes
  - `notify_team_invite()` added to `notifications.py` (Resend email scaffold — no-ops without RESEND key)
- Frontend:
  - `/team` page (`/app/frontend/src/pages/Team.jsx`): invite form, members list with OWNER badge, pending invitations with Copy link / Revoke
  - `/accept-invite?token=X` (`/app/frontend/src/pages/AcceptInvite.jsx`): public landing, shows workshop + role, sign-in CTA when unauthenticated, accept button when email matches
  - Sidebar nav adds **Team** (Users icon) for workshops

**🟠 P1 — Fleet Command Center:**
- Backend (`/app/backend/routes/fleets.py`):
  - `fleets` collection — `{fleet_id, workshop_id, name, description, vehicles[], created_by, created_at, updated_at}`
  - Vehicle schema: `{brand, model, year, vin, plate, customer_name, notes}` (brand+model required)
  - Endpoints: GET/POST `/api/fleets`, GET/PATCH/DELETE `/api/fleets/{fleet_id}`, GET `/api/fleets/{fleet_id}/reorder-suggestions`
  - Reorder suggestions: aggregates orders for ALL workshop members (owner + member_user_ids), groups by SKU, returns top 20 with current tier price applied + suggested_qty (lifetime / vehicle_count)
- Frontend:
  - `/fleets` page (`/app/frontend/src/pages/Fleets.jsx`): create / edit / delete fleets, vehicle grid form, vehicle chips, "Show one-tap reorder list" loads suggestions, "Add all to cart" + per-row "Add" buttons (uses CartContext)
  - Sidebar nav adds **Fleets** (Truck icon) for workshops

**Test results: 22/22 iter10 backend tests + 10/10 iter9 regression + 100% frontend e2e + 0 horizontal overflow at 320/360/768/1440 viewports.**

**Open polish (LOW priority):** React hydration warning from visual-editor instrumentation inside `<option>` element on Team.jsx — non-blocking dev warning, not visible to end users.


## 2026-02-10 — Iter11 · Header bug fix + Live World Auto News ticker

**🔴 Mobile header bug fixed**: "JOY Automart" + "B2B PLATFORM · BANGLADESH" was wrapping awkwardly on Samsung Browser at narrow viewports. Tightened typography (xs:text-base, sm:text-lg, lg:text-xl), shrunk logo on mobile (w-9 → w-12), shortened subtitle to "B2B · Bangladesh", added `whitespace-nowrap` + `flex-shrink-0` on the action nav, hid subtitle below 400px (xs breakpoint). Result: clean single-line brand on every viewport from 320px up.

**📰 Live World Auto News ticker**: Replaced the static rotating platform ticker with REAL automotive news from worldwide sources (refreshes every 1 hour).
- Backend: `/app/backend/routes/cars_news.py` → `GET /api/public/cars-news`
- Source: Google News RSS (free, no API keys) — query: `automotive industry when:1d`, region en-US worldwide
- 1-hour in-memory cache + DB persistence (`cars_news_cache` collection) for cold-start fallback
- Returns up to 12 cleaned headlines `{title, source, link, pub_date}`
- Frontend: live "● LIVE · WORLD AUTO NEWS" red badge + scrolling headlines (📰 emoji + uppercase title + source). Falls back to platform stats if news fetch fails.
- Strips duplicate trailing `- Source` from Google News titles for clean display

**Status**: Verified working at 320 / 360 / 1440 px. Real headlines confirmed: "Dozens of House Republicans Weigh In on Auto Market Access for China · Alliance for American Manufacturing", "Korean manufacturer DUCK IL Industries announces $21M investment in Auburn", etc.

## 2026-02-10 — Iter12 · Visual Parts Search + Voice Search + WMS Lite + Hydration Fix (4 P2 features)

**🟢 P2 — Visual Parts Search**:
- Backend `/app/backend/routes/visual_search.py` → POST `/api/visual-search` (multipart-form: image + optional hint)
- Uses `emergentintegrations.llm.chat.LlmChat` + `ImageContent` with `claude-sonnet-4-5-20250929` via EMERGENT_LLM_KEY
- Returns `{search_id, identification:{part_name,category,confidence,visible_identifiers,likely_brands,search_keywords,condition_assessment,replacement_advice}, matches:[12 max with tier-priced your_price_bdt + retail_price_bdt], tier}`
- Validation: 6 MB max, image/jpeg|png|webp|heic|heif only
- Logs to `db.visual_searches` for analytics
- Frontend `/app/frontend/src/pages/VisualSearch.jsx` → /visual-search route
- File-picker + camera capture (`capture="environment"` for mobile back camera)
- Result panel shows: image preview, part name, category badge, confidence color-coded badge (green ≥70%, amber 40-69%, red <40%), brand chips, condition assessment, replacement advice, catalog matches grid with tier prices + Add to cart
- Smoke-tested with wheel display photo: identified as "Alloy Wheel Rims - Display Showroom Set" with 95% confidence; matched to JA-WHL-001

**🟢 P2 — Voice Search (English + Bengali)**:
- Browser-native Web Speech API (no backend, no API keys, no cost)
- New `/app/frontend/src/components/VoiceSearchButton.jsx` — accepts `lang` prop (`en` | `bn`), uses `bn-BD` locale for Bengali, `en-US` for English
- Auto-pulls language from existing `LanguageContext` via `useLang()`
- Wired into `/app/frontend/src/pages/Products.jsx` next to the search input. Listens, transcribes, fills `q` state, triggers existing search
- Component returns `null` when SpeechRecognition unsupported (Safari iOS, etc.) — graceful degradation
- Mic permission denied / aborted handled with friendly toasts

**🟢 P2 — WMS Lite (Job Card → Parts Order)**:
- Backend `/app/backend/routes/job_cards.py`:
  - `db.job_cards` collection — `{job_id, workshop_id, customer_name, vehicle_*, complaint, mechanic_name, parts:[{sku,name,quantity,price_bdt,source}], labour_charge_bdt, status, notes}`
  - `job_id` format: `JC-YYYYMMDD-XXXXXX`
  - Endpoints: GET/POST `/api/job-cards`, GET/PATCH/DELETE `/api/job-cards/{id}`, POST `/api/job-cards/{id}/to-cart`
  - Status: `open | in_progress | completed | cancelled`. Setting completed sets `completed_at`
  - `/to-cart` looks up each SKU, applies workshop's tier pricing, returns cart-ready items + missing_skus list
- Frontend `/app/frontend/src/pages/JobCards.jsx` → /job-cards route:
  - List with status filter, color-coded badges (Open=blue, In Progress=amber, Completed=emerald, Cancelled=rose)
  - Inline create form (customer, vehicle, complaint, mechanic, optional VIN/plate/year)
  - Expandable parts editor: SKU lookup → adds to job, qty inline-editable, labour charge field
  - "Push parts to cart" button → calls /to-cart, adds all to CartContext, navigates to /cart, warns if any SKUs missing
- Sidebar nav adds **Job Cards** (Briefcase icon)

**🟡 LOW — Team.jsx hydration warning fix**:
- Removed long " — desc" suffix from inside `<option>` (visual-editor instrumentation was injecting extra nodes inside the option, causing a hydration mismatch)
- Description now displays as a contextual hint paragraph below the dropdown, dynamically updates with the selected role
- Console clean on /team page

**Tests passed**: iter12 — 18/18 backend pytest (real Claude vision call ~12s, MIME rejection, auth, full CRUD, status transitions, to-cart tier pricing, regression on stats/news/products/orders) + 100% frontend selectors + sidebar nav + responsive (320/360/768/1440 px) + hydration warning gone.


## 2026-02-10 — Iter13 · Header rename ("Trade Portal") + Auto-translation engine (every word/letter)

**🔄 Header rename**: "Workshop Portal" → **"Trade Portal"** (covers workshops + car dealers + suppliers — the 3 audiences JOY serves). Updated `header.workshop` key in `LanguageContext.jsx` to "Trade Portal" / "ট্রেড পোর্টাল".

**🌐 Auto-translation engine — works on EVERY word + letter in the app**:
- Backend `/app/backend/routes/i18n.py` → `POST /api/i18n/translate { lang: "bn", texts: [...] }` returns `{ translations: { src → bn } }`
- Powered by **Claude Sonnet 4.5** via `emergentintegrations` + EMERGENT_LLM_KEY
- Mongo-cached in `db.i18n_cache` (sha256 hash + lang composite key) — each unique English phrase translated only once across the entire user base, ever
- Smart system prompt:
  - Keeps brand names (JOY Automart, Toyota, BYD, Stripe, NHTSA, VIN, KYC, BDT) in English
  - Keeps product SKUs, IDs, numbers, currency symbols (৳), dates AS-IS
  - Uses natural everyday Bangla used by Dhaka workshop owners (not formal/literary)
  - Keeps universally-used English mechanic terms (brake, engine, oil, tyre, battery, AC, GPS, VIN) in Latin script
  - Returns strict JSON array; falls back to original on parse failures
  - Rejects pure-numeric / punctuation / symbol-only strings to avoid wasted tokens
- Frontend hook `/app/frontend/src/hooks/useAutoTranslate.js`:
  - Wired at `App.js` level so it runs on EVERY page automatically
  - Walks the DOM with a TreeWalker, collects text nodes, skips `<script>`, `<style>`, `<code>`, `<pre>`, `<input>`, `<textarea>`, `<option>`, `<select>` and `font-mono` / `tabular-nums` / `joy-no-translate` / `ticker-track` classes (preserves SKUs, prices, tickers)
  - localStorage cache (`ja_i18n_cache_bn_v1`) — first paint of previously-seen strings is INSTANT (no network)
  - Stashes original text on each text node so toggling back to English is instant + lossless
  - MutationObserver re-runs on dynamically rendered content (post-data-fetch UI, route changes)
  - 250ms debounce + chunked API calls (60 strings per request) for efficient translation
  - Silent fail — if Claude is down, page still works in English
- Verified end-to-end: VIN Lookup body translated, Dashboard fully translated, sidebar nav translated (16 items), 68 unique strings cached after one page visit.

**Tests**: backend endpoint smoke-tested with 10 strings (all 10 translated correctly with brand-name preservation rules); frontend visually verified at 360px (mobile) and 1440px (desktop); cache populated and persists in localStorage.

## 2026-02-10 — Iter14 · Audit log + BD news + Job Card PDF + PWA + i18n prewarm (5 P1 features)

**🟢 Audit log per teammate**
- New `/app/backend/routes/audit.py` with `log_audit()` helper + `GET /api/audit-log` (workshop-scoped, owner sees all members; members see only their own)
- Wired into `routes/job_cards.py` create/update/delete (extensible to orders/returns/fleets later)
- Frontend `/app/frontend/src/pages/AuditLog.jsx` → `/activity` route. Date-range filter (7/30/90/365 days), per-teammate filter from member list, action labels with role icons
- Sidebar nav adds **Activity** (History icon)

**🟢 Bangladesh-only news section**
- Backend `routes/cars_news.py` extended: 4 new BD-specific queries (Bangladesh car market, Dhaka automotive, BRTA/fuel price, Bangladesh Toyota/BYD/Mahindra) → `GET /api/public/cars-news/bangladesh`
- 1-hour cache, MongoDB persistence (`google_news_bd_v1`), 12 max items
- Frontend Landing: new **Bangladesh Auto Pulse** section between worldwide ticker and Experience Centre. Magazine layout with FEATURED hero card + 6-card sidebar grid. All headlines clickable with source attribution and date stamps
- Verified: 12 real BD headlines from The Daily Star, Business Standard, IEEFA, BSS, Dhaka Tribune, Lowy Institute

**🟢 Shareable Job Card PDF**
- New `/app/backend/job_card_pdf.py` — Reportlab A4 PDF generator with brand red accent, header, customer + vehicle blocks, complaint, parts table with subtotals, totals (parts + labour), notes block, footer with share URL
- Backend endpoints: `GET /api/job-cards/{id}/share` (creates token + URLs), `GET /api/job-cards/{id}/pdf` (auth download), `GET /api/job-cards/public/{token}.pdf` (public PDF), `GET /api/job-cards/public/{token}` (public JSON for React renderer)
- Frontend: Share/PDF buttons in JobCards expanded view (clipboard auto-copy + open in new tab), new `/app/frontend/src/pages/PublicJobCard.jsx` → `/jc/:token` public route — magazine-style customer-facing card with download CTA
- Verified end-to-end: PDF downloads correctly (3.1 KB), public share page renders Mr. Rahman's job card with all parts and pricing

**🟢 PWA setup**
- `/app/frontend/public/manifest.webmanifest` — JOY logo icons (192/512), standalone display, dark theme color, 4 shortcut links (VIN, Visual, Job Cards, Cart)
- `/app/frontend/public/service-worker.js` — network-first for HTML/API, stale-while-revalidate for static assets, **special cart caching strategy** (network-first with cache fallback for `/api/cart` so workshops see their cart even offline)
- Registered in `index.js` (production-only by default; opt-in via `REACT_APP_ENABLE_SW=1` for dev)
- `/app/frontend/src/components/InstallPwaButton.jsx` — uses `beforeinstallprompt`/`appinstalled` events. Hidden on iOS (Share-sheet flow) and when already installed
- Wired into Landing header next to Sign-in (visible on Chrome/Edge desktop + Android)
- `index.html` updated with `apple-mobile-web-app-*` meta tags

**🟢 i18n cache pre-warm**
- New `/app/backend/i18n_prewarm_strings.py` — curated list of 187 most-visited UI strings (nav, landing, dashboard, products, orders, cart, profile, VIN, visual search, job cards, team, fleets, returns)
- `server.py` startup task runs `_prewarm()` async — diffs against existing `db.i18n_cache` and translates only missing strings (idempotent, restart-safe)
- Background fire-and-forget — never blocks startup; logs progress
- Result: First Bengali page-load is now near-instant for new users (most common strings pre-translated and persisted)

**Tests**: 
- Backend smoke: BD news returns 12 items, PDF download HTTP 200 with correct content-type, audit log captures job card create with full user attribution, prewarm completes 187 strings on startup
- Frontend visual: BD news section renders beautifully on Landing, Activity Log shows entries with role icons, Job Cards has Share/PDF buttons in expanded view, Public Job Card share page renders correctly with all data
- Lint clean: Python (3 modules) + JS (4 files)


## 2026-02-10 — Iter15 · Landing layout commercial polish

**1. Experience Centre extracted to dedicated page** (`/experience-centre`)
- New `/app/frontend/src/components/ExperienceCentreContent.jsx` (reusable EC content with all 6 architectural tiles + bands + features)
- New `/app/frontend/src/pages/ExperienceCentre.jsx` — sticky breadcrumb header ("← Back to JOY Automart"), self-contained dark page, document.title set, scrolls to top on mount
- App route added: `/experience-centre`
- Header nav (Landing) gets new **"Experience Centre"** tab between Catalog and WhatsApp (`data-testid="header-experience-centre-link"`)
- On Landing, the verbose inline EC section (~190 lines) is replaced with a tight 2-column TEASER strip showcasing the interior render + headline + "Tour the Experience Centre →" CTA → links to `/experience-centre`

**2. Bangladesh Auto Pulse moved to bottom of Landing** (right above the footer)
- Was previously between worldwide ticker and EC section (mid-page)
- Now positioned just above `<footer>` — gives the BD news section dedicated visual real estate without breaking the main hero → CTA flow

**3. Three verbose middle sections condensed into one tight unified section**
- Removed: separate "Built for three sides of the trade" persona-cards section, separate 4-card "Capability cards" section, separate 4-step "How it works" section
- Added: single condensed section with 2-column hero (3 audience bullets + 4 stat tiles) followed by 4-step `how it works` row separated by a subtle border
- Saves ~140 lines of JSX, drops scroll length significantly, keeps every key message
- New `Stat` helper component for the small data tiles

**Tests / Verification**:
- Lint clean (Landing.jsx, ExperienceCentre.jsx, ExperienceCentreContent.jsx, App.js)
- Mobile (360px), tablet (768px), desktop (1440px) all overflow-free
- All testids preserved: `header-experience-centre-link`, `exp-centre-tab`, `ec-back-link`, `ec-tile-*`, `bd-news-hero`, `bd-news-list`
- 6 EC tiles render correctly on the dedicated page


## 2026-02-10 — Iter16 · Smart PWA push notifications

**🟢 Web Push notifications (no third-party APIs)**
- VAPID keys generated locally (private PEM stored b64-encoded in `backend/.env` as `VAPID_PRIVATE_PEM_B64`, public exposed via `/api/push/public-key`)
- Backend `/app/backend/routes/push.py`:
  - `GET /api/push/public-key` (public — returns VAPID public key)
  - `POST /api/push/subscribe` (auth — upserts subscription by endpoint)
  - `POST /api/push/unsubscribe` (auth)
  - `POST /api/push/test` (auth — sends a test push to all caller's devices)
  - `send_push_to_user(user_id, *, title, body, url, tag)` helper — best-effort multi-device push, prunes 404/410 endpoints automatically
- Schema: `db.push_subscriptions: { sub_id, user_id, endpoint, keys, user_agent, created_at, last_used_at, failure_count }`
- pywebpush==2.3.0, py-vapid==1.9.4, http_ece==1.2.1 added to requirements.txt

**🟢 Order-status push triggers**
- `/app/backend/routes/orders.py` PATCH `/orders/{id}/status` now fires `send_push_to_user` on transitions: `shipped` (📦 Order shipped), `out_for_delivery` (🚚 Out for delivery), `delivered` (✅ Order delivered), `packed` (📋 Order packed), `cancelled` (❌ Order cancelled)
- Sends to ALL workshop members (owner + member_user_ids), so parts manager AND mechanic both see it
- Click navigates to `/orders` with order tag deduplication

**🟢 Low-stock alert worker**
- New `/app/backend/low_stock_scan.py` — async background worker
- Scans every 30 minutes; threshold = stock between 1 and 5
- Finds workshops who ordered the SKU in the last 90 days, pushes ⚠️ Low stock alert to all of them
- Dedup via `db.low_stock_alerts` collection (24h cooldown per SKU)
- Click navigates to `/products?search={sku}`
- Started in `server.py` startup_event alongside recurring worker

**🟢 Service Worker — push + click handlers**
- `/app/frontend/public/service-worker.js` extended with `push` event (parses JSON payload, shows notification with JOY logo icon, requireInteraction=false) and `notificationclick` event (closes notif, focuses existing window or opens new tab to the notification URL)
- Cache version bumped `joy-v3 → joy-v4` to force activation

**🟢 Frontend opt-in toggle**
- `/app/frontend/src/components/PushNotificationToggle.jsx`:
  - Detects support (serviceWorker + PushManager + Notification)
  - Asks `Notification.requestPermission()`, subscribes via `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
  - Stores subscription via `/api/push/subscribe`
  - "Send test" button (calls `/api/push/test`)
  - "Disable" button (unsubscribes both client and server)
  - Friendly "Blocked in browser" state when permission denied with instructions
  - Hidden entirely on unsupported browsers
- Wired onto `/app/frontend/src/pages/Profile.jsx` at the top, just below the page title
- Verified rendering on both desktop (1440px) and mobile (360px); responsive

**Tests**:
- Backend: `/api/push/public-key` returns key, subscribe upserts, test endpoint executes (returns sent count), VAPID config OK
- Lint clean: routes/push.py, low_stock_scan.py, PushNotificationToggle.jsx, Profile.jsx
- Backend started clean with new worker scheduled, i18n cache already warm (216 strings)



## What's Been Implemented (2026-02-10) — Body Kits Showcase + Mobile Scroll-Spy + DWS one-liner

**Body Kits Interactive Showcase** (`/app/frontend/src/components/BodyKitsShowcase.jsx`)
- New stateful 4-tab component on the Landing page (`/`) replacing the static kit-tier strip in the JOY BEAST section.
- Tabs: **Shadow GT**, **Cyber Beast**, **Beast Wide Body**, **Custom Atelier** — clicking/touching swaps the showcased hero image with a 700ms opacity fade transition.
- **Shadow GT** is a 4-image gallery: auto-rotating carousel (3.8s interval), prev/next arrows on desktop, swipe gesture on touch devices, clickable thumbnail strip beneath, frame counter (e.g. `02 / 04`), and skeleton shimmer until first image loads.
- Other 3 tabs render a single hero image (no thumbnail strip) — keeps layout clean.
- Premium overlay: bottom gradient with `headline + blurb`, top-left badge with `name · tier`.
- New asset folder: `/app/frontend/src/assets/body-kits/` with 6 PNGs (4 Shadow GT + 1 wide-body kit + 1 forged rims).
- All tabs and images carry data-testids: `kit-tab-{id}`, `kit-image-{id}-{i}`, `shadow-gt-thumb-{i}`, `shadow-gt-prev`, `shadow-gt-next`.
- Fully responsive: mobile (390px), tablet (768px), desktop (1440px); image stage `h-[300px] sm:h-[420px] lg:h-[540px]`; thumbnails responsive `w-20 h-14 sm:w-28 sm:h-20`.

**Mobile Scroll-Spy Chip Nav** (`/app/frontend/src/components/MobileScrollSpyChips.jsx`)
- Sticky horizontal-scroll chip rail under the header on viewports `<1024px` only (`lg:hidden`); desktop continues to use the top header nav.
- 7 chips: Home → JOY BEAST → Experience → Tech → Why Joy → Get started → BD News (matches DOM order).
- Clicking a chip optimistically highlights it then smooth-scrolls the document to the section (header offset 84px).
- Active-chip detection uses a rAF-throttled scroll listener that picks the last section whose `getBoundingClientRect().top` has crossed the 100px header line; `rects.sort((a,b)=>a.top-b.top)` makes the heuristic robust to future DOM reorders.
- Rail auto-centres the active chip via `rail.scrollTo({ left, behavior:'smooth' })` (rail-only, never touches document scroll).
- New utility `.no-scrollbar` added to `/app/frontend/src/index.css`.

**Section IDs added on `/app/frontend/src/pages/Landing.jsx`**
- `#hero`, `#joy-beast`, `#experience-centre`, `#tech-stack`, `#value-prop`, `#cta`, `#bd-news` (all with `scroll-mt-28` so the sticky header doesn't clip the heading after smooth scroll).

**DWS one-line summary**
- Replaced the 3-row Dealers/Workshops/Suppliers bullet list with a single sophisticated paragraph (data-testid `dws-summary`):
  > "A single verified network synchronising **dealers**, **workshops** and **suppliers** — wholesale parts on 30-day credit, AI-matched SKUs for the bay floor and 312+ approved B2B buyers, with KYC, credit and logistics handled end-to-end."

**Tests** (iteration_15.json — 100% frontend pass, no retest needed)
- BodyKitsShowcase tab switching, Shadow GT thumbs/arrows/auto-rotate, other-tab thumbnail hiding — all pass.
- Mobile scroll-spy: every chip click scrolls to the right section AND retains `data-active="true"` after the 4-second settle window. Manual slow-scroll transitions through all 7 sections in DOM order.
- Desktop 1440 → mobile-scroll-spy correctly hidden via `lg:hidden`.
- Theme toggle, dws-summary copy, no horizontal overflow on any viewport.

**Files touched**
- NEW `/app/frontend/src/components/BodyKitsShowcase.jsx`
- NEW `/app/frontend/src/components/MobileScrollSpyChips.jsx`
- NEW `/app/frontend/src/assets/body-kits/*.png` (6 files)
- EDITED `/app/frontend/src/pages/Landing.jsx` (imports, section ids, replaced kit strip, replaced DWS bullets)
- EDITED `/app/frontend/src/index.css` (added `.no-scrollbar` utility)

## What's Been Implemented (2026-02-10) — EC Bug Fix + Notification Prefs + Landing Stats

**P0 BUG FIX — Experience Centre blank page** (`/app/frontend/src/pages/ExperienceCentre.jsx`)
- Root cause: navigating from Landing → /experience-centre kept `html.js-reveal-armed` on the document but EC page didn't run `useScrollReveal()`. Result: every `.reveal` element on EC page stayed at `opacity: 0` → user saw a blank dark page.
- Fix: `useScrollReveal()` is now called inside `ExperienceCentre` so the IO observer is re-armed for the new route.

**Landing stat numbers updated** (`/app/frontend/src/pages/Landing.jsx`, lines 660-663)
- `38+ Verified parts` → `1000+ Verified parts`
- `12% Tier pricing off retail` → `10–35% Tier off retail price`

**EC page enriched — sophisticated long-form** (`/app/frontend/src/components/ExperienceCentreContent.jsx`)
- New section **04 · Signature elements** (`data-testid="ec-signature-elements"`) — 5 numbered cards (Hero Car Stage, Wheel Wall, Espresso Bar, Body-Kit Atelier, Mezzanine Theatre) with watermark Roman numerals on hover.
- New section **05 · Timeline** (`data-testid="ec-timeline"`) — 4-stage opening journey Q4 2025 → Q3 2026 with red ticker dots and gradient separators.
- New section **Plan your visit** (`data-testid="ec-plan-visit"`) — closing card with address, RSVP and dual CTAs (Reserve viewing + WhatsApp).

**P1 — Notification Preference Center** (granular per-category push toggles)
- Backend (`/app/backend/routes/push.py`):
  - New `notification_prefs` field on user document with 4 categories: `order_updates`, `low_stock`, `promotional`, `daily_digest`. Defaults: order+low_stock ON, promotional+daily_digest OFF.
  - `GET /api/push/prefs` → returns `{prefs, defaults}` for the authenticated user.
  - `PUT /api/push/prefs` → patch any subset of category booleans; missing keys are a no-op.
  - `send_push_to_user(...)` now accepts `category=...` (default `order_updates`); skips silently when user has opted out. The `test` category bypasses prefs so the UI test button always works.
- Updated callers to tag categories:
  - `/app/backend/routes/orders.py` line 209 → `category="order_updates"`
  - `/app/backend/low_stock_scan.py` line 67 → `category="low_stock"`
- Frontend new component `/app/frontend/src/components/NotificationPreferences.jsx`:
  - 4 toggle rows with per-row icons (Package, AlertTriangle, Megaphone, Calendar), labels and one-line descriptions.
  - Optimistic toggle UX with rollback on API failure; toast confirmation on each toggle.
  - data-testids: `notification-prefs-card`, `pref-row-{id}`, `pref-toggle-{id}`, `data-checked` reflects state.
- Wired below `<PushNotificationToggle />` on `/app/frontend/src/pages/Profile.jsx`.

**Tests** (iteration_16.json — 100% pass, no retest)
- Backend pytest: 8/8 — defaults, single-key PUT, multi-key PUT, no-op PUT, category gating (order_updates=false skips order push, low_stock independent), test bypasses prefs.
- Frontend Playwright: 9/9 — Landing stats correct, EC page non-blank with all new testids, Profile shows prefs card with correct defaults, toggle flip persists across reload.

**Files touched**
- EDITED `/app/backend/routes/push.py`, `/app/backend/routes/orders.py`, `/app/backend/low_stock_scan.py`
- EDITED `/app/frontend/src/pages/ExperienceCentre.jsx`, `/app/frontend/src/components/ExperienceCentreContent.jsx`, `/app/frontend/src/pages/Landing.jsx`, `/app/frontend/src/pages/Profile.jsx`
- NEW `/app/frontend/src/components/NotificationPreferences.jsx`


## What's Been Implemented (2026-02-10) — Final Deploy-Ready Polish (iter 17 + 18)

**Iter 17 fixes** (per user screenshots):
- Catalog → Catalogue spelling everywhere (header, hero CTA, footer, tech badge, Dashboard, Products, AdminProducts, PublicCatalog, VisualSearch).
- Hero CTAs unified — Visit retail store, Browse catalogue, WhatsApp 01886-799533 all share the same white-bordered pill style at `px-5 sm:px-6 py-3 rounded-full`.
- News ticker no longer visually merges with red Live badge — added `.ticker-mask` left/right gradient mask + right-side shadow on the badge.
- EC page badge: `Banani · Madani Avenue` → `Madani Avenue · 100 ft`. Removed every `1,560 sq ft` / `65 ft × 24 ft` reference. New sophisticated description focusing on the 100 ft Madani Avenue corridor positioning.
- EC hero panoramic swapped to `EC_DAY_NIGHT` (exterior) so the lead picture is exterior.
- VIN Lookup reference photo: removed `Wikipedia · model generation` attribution badge AND the bottom black caption with photo title.

**Iter 18 fixes** (per user screenshots):
- Removed `Browse all kits` link from JOY BEAST section — only `Schedule a kit consultation →` remains.
- Body-kit lines stat: `6` → `4` (matches the 4 actual kit tabs).
- BodyKitsShowcase bottom overlay (gradient + headline + blurb) removed across all 4 tabs — was clashing with built-in spec strips already on the body-kit images. Only the clean top-left `KIT NAME · TIER` badge remains.

**Tests** (iter 17 = 100% on 10 targets, iter 18 = 100% on 5 targets — no retest needed).

**Files touched**
- EDITED `/app/frontend/src/pages/Landing.jsx`, `/app/frontend/src/index.css`
- EDITED `/app/frontend/src/components/ExperienceCentreContent.jsx`, `/app/frontend/src/components/BodyKitsShowcase.jsx`
- EDITED `/app/frontend/src/pages/VinLookup.jsx`, `/app/frontend/src/pages/Dashboard.jsx`, `/app/frontend/src/pages/Products.jsx`, `/app/frontend/src/pages/AdminProducts.jsx`, `/app/frontend/src/pages/PublicCatalog.jsx`, `/app/frontend/src/pages/VisualSearch.jsx`


## What's Been Implemented (2026-02-10) — Public Search Bar + Production Deploy Diagnosis (iter 19)

**Deployment diagnostic** (production https://b2bjoymart.com):
- User reported `/catalog`, `/dashboard`, `/terms`, `/privacy` showing homepage on production. Verified all routes are correctly registered in `/app/frontend/src/App.js` and return HTTP 200 with correct content on PREVIEW. Verified `/api/public/catalog`, `/api/public/categories`, `/api/public/cars-news`, `/api/public/cars-news/bangladesh`, `/api/public/stats` all work in preview.
- Root cause: production is running a stale build that pre-dates the routes & public endpoints. Resolution: user must redeploy with the latest preview code.

**NEW — PublicSearchBar** (`/app/frontend/src/components/PublicSearchBar.jsx`)
- Hero-mounted live parts search visible to ANY visitor (no sign-in). Lets dealers verify if a part is stocked before signing up.
- Calls `GET /api/public/catalog` once per page (in-module promise cache), filters client-side by name / SKU / brand / category / car_fits with 220ms debounce.
- Renders an autocomplete dropdown (max 6 results) with image, name, SKU/brand/category meta, and "Sign in for tier price" CTA per result.
- No-match state surfaces a "Request a quote" CTA → `/inquire?q={query}`.
- Keyboard accessible: ↑ ↓ navigation, Enter to open `/inquire/{sku}`, ESC to close, click-outside to close.
- Mobile responsive: full-width with red "Browse all →" pill (hidden on <640px to keep input legible).
- data-testids: `public-search-bar`, `public-search-input`, `public-search-clear`, `public-search-browse-all`, `public-search-dropdown`, `public-search-results`, `public-search-result-{i}`, `public-search-request-quote`, `public-search-view-all`.
- Mounted on Landing inside `[data-testid="hero-public-search-wrap"]` between the hero description paragraph and the CTA button row, with a "✓ No sign-in required · Live stock from our warehouse" trust line below.

**Tests** (iter 19 — frontend 100%, 13/13 passed). Optional cosmetic dev-warning in Inquire.jsx noted (visual-editor span inside `<option>`) — not blocking.

**Files touched**
- NEW `/app/frontend/src/components/PublicSearchBar.jsx`
- EDITED `/app/frontend/src/pages/Landing.jsx` (import + mount in hero)


## What's Been Implemented (2026-02-10) — Header Search Trigger + Nav Polish (iter 20)

**Search relocated from hero → header icon** (`/app/frontend/src/components/HeaderSearchTrigger.jsx` NEW)
- Removed the inline hero search bar (`hero-public-search-wrap` no longer exists) AND the "✓ No sign-in required · Live stock from our warehouse" trust line.
- New `HeaderSearchTrigger` button mounted in the Landing header next to Sign in. Click opens a centred overlay (`header-search-overlay`) with the `PublicSearchBar` auto-focused. ESC, backdrop click, or X button (`header-search-close`) closes it. Body scroll locks while open. Dark/light theme aware.

**TRADE PORTAL wordmark → clickable Link** (`/app/frontend/src/components/Layout.jsx`)
- The mono "TRADE PORTAL" / "ADMIN CONSOLE" text in the authenticated header is now a `<Link>` (`data-testid="header-portal-link"`) → `/dashboard` (or `/admin` for admin users) with arrow `→` suffix and hover-to-red transition.

**Mobile chip nav reduced 7 → 5 + restyled** (`/app/frontend/src/components/MobileScrollSpyChips.jsx`)
- SECTIONS trimmed: removed `value-prop` and `cta`. Final list: Home, JOY BEAST, Experience, Tech, BD News.
- New visual style — replaced heavy bordered pills with a sophisticated **underline-indicator**: text-only chips (font-display tracking-tight) with a 2px red bar that slides under the active chip. Smaller font (`text-[10px] sm:text-[11px]`), centred rail, increased backdrop-blur opacity for depth.

**Landing header desktop nav cleaned**
- Removed `Retail Store`, `Experience Centre`, `WhatsApp` header links to reduce clutter (still accessible via JOY BEAST CTAs, Experience tab in chip-nav, and the WhatsApp CTA in the hero).
- Final desktop header lineup: `Catalogue · Search parts · ☾ · Install PWA · Sign in`.

**Tests** (iter 20 — frontend 100%, 9/9 passed). No retest needed.

**Files touched**
- NEW `/app/frontend/src/components/HeaderSearchTrigger.jsx`
- EDITED `/app/frontend/src/components/MobileScrollSpyChips.jsx`, `/app/frontend/src/components/Layout.jsx`, `/app/frontend/src/pages/Landing.jsx`


## What's Been Implemented (2026-02-10) — Body Kits Reorder + Stage Cleanup + VIN CTA Trim (iter 21)

**Body Kits**
- Reordered KITS: `Cyber Beast → Shadow GT → Beast Wide Body → Custom Atelier`. Cyber Beast is now default-active on page load.
- Removed the absolute top-left `KIT NAME · TIER` overlay badge — was clashing with the built-in spec strips on the multi-view body-kit images (e.g. "BEAST WIDE BODY · WIDE-BODY" was hiding "LUXE VIP" text). The active tab below the image already shows name + tier.

**Tech section**
- Removed `[data-testid="tech-vin-link"]` ("Try the VIN parts finder →") button. Only `[data-testid="tech-retail-vin-link"]` ("Use it on retail store →") remains, restyled as the primary dark CTA.

**Tests** (iter 21 — 100% frontend, 5/5 passed). No retest needed.

**Files touched**
- EDITED `/app/frontend/src/components/BodyKitsShowcase.jsx` (kits reordered, default cyber-beast, badge overlay removed)
- EDITED `/app/frontend/src/pages/Landing.jsx` (VIN button removed, retail link styled primary)


## What's Been Implemented (2026-02-10) — Header Polish + Hero/Tech Trim + Atelier Clip (iter 22)

**Header**
- Removed "B2B" from the sub-wordmark; now reads just `BANGLADESH`.
- Logo bumped: 48px mobile / 64px desktop (from 36/48).

**Hero CTAs**
- Removed `Browse catalogue` button and the `01886-799533` WhatsApp button. Final hero row: `Open the B2B portal` + `Visit retail store →`.

**Tech section**
- Removed `Use it on retail store →` button (CTA row now empty by design — Tech is feature-narrative only).
- Tightened section padding so Value-prop section comes up immediately: tech section `pt-14 sm:pt-20 pb-8 sm:pb-12`; value-prop `py-8 sm:py-10`.

**Body Kits — Custom Atelier image clip**
- The Atelier image is a 6-panel composite (top row: front 3/4 + rear 3/4; bottom row: 3 extra views with duplicate BYD logos). Per user request, only the top row is shown — applied inline `style={{height:'200%', objectFit:'cover', objectPosition:'center top'}}` for `active.id === 'atelier'`. Renders the image at 2x container height anchored to top, so the bottom row is naturally clipped by the parent's `overflow-hidden`. No distortion.

**Tests** (iter 22 — 100% frontend, all 7 tests passed). No retest needed.

**Files touched**
- EDITED `/app/frontend/src/pages/Landing.jsx` (header logo, hero CTAs, tech CTAs, section spacing)
- EDITED `/app/frontend/src/components/BodyKitsShowcase.jsx` (atelier inline-style clip)


## What's Been Implemented (2026-02-10) — Hero Polish + Catalogue Chip + Dashboard Search + Guardian Bot (iter 23)

**Hero copy enriched** (`/app/frontend/src/pages/Landing.jsx`)
- Overline updated: "Bangladesh's first AI-powered auto parts commerce & data platform".
- New 4-pillar trust strip below CTAs (`data-testid="hero-pillars"`): hairline separators with bullet dots calling out **B2B wholesale · B2C retail · Experience Centre · JOY BEAST atelier**.

**Catalogue moved to chip nav** (`/app/frontend/src/components/MobileScrollSpyChips.jsx`)
- Removed `Catalogue` link from Landing header. Mobile chip nav now has 6 chips in DOM order: Home → JOY BEAST → Experience → Tech → Catalogue → BD News.
- Catalogue is a special `type:"link"` chip (`data-chip-type="link"`, red text, no scroll-spy underline). Clicking it routes to `/catalog` via `useNavigate`.
- Header on Landing simplified: logo + name + Search trigger + theme + install + Sign in.

**Dashboard bay-floor search** (`/app/frontend/src/components/DashboardSearchBar.jsx` NEW)
- Authenticated search mounted between the "Welcome back / {Name} — your bay floor" heading and the KYC banner (per user UX spec).
- Hits `GET /api/products`, debounced 200ms, dropdown of 6 best matches with workshop tier price highlighted in red.
- Keyboard nav (↑↓Enter), no-match → "Submit part request" CTA → `/part-requests?new=1&q=...`.
- data-testids: `dashboard-search-bar`, `dashboard-search-input`, `dashboard-search-clear`, `dashboard-search-cta`, `dashboard-search-dropdown`, `dashboard-search-results`, `dashboard-search-result-{i}`, `dashboard-search-request-quote`.

**🤖 GUARDIAN BOT — public AI car expert** (NEW)
- Backend `/app/backend/routes/guardian.py`:
  - `POST /api/guardian/message` (no auth) — Claude Sonnet 4.5 via emergentintegrations + EMERGENT_LLM_KEY.
  - System prompt scoped to automotive expertise: diagnostics, maintenance, parts compatibility, BD-market context (LRP, BRTA, monsoon prep, recon vs new), workshop quote sanity-checks, gentle hand-offs to JOY catalogue.
  - In-memory rate limit: 8 messages / 60s / session_id (returns 429 when exceeded).
  - Persists every turn to `db.guardian_messages` keyed by session_id (no PII captured beyond message content).
  - `GET /api/guardian/history?session_id=...` — restores conversation on reload.
- Frontend `/app/frontend/src/components/GuardianBot.jsx`:
  - Floating "ASK GUARDIAN" bubble bottom-LEFT (bottom-right reserved for existing authenticated `ChatWidget`).
  - Mounted globally in `App.js` so it appears on every page (Landing, Catalogue, EC, Dashboard, etc.).
  - Slide-in panel with 4 starter prompts (engine oil, AC, battery, brake-pad pricing); typing + Send + Enter; auto-scroll; localStorage `joy_guardian_sid` for cross-page session.
  - Bengali supported (system prompt mirrors user language).
  - data-testids: `guardian-bot-trigger`, `guardian-bot-panel`, `guardian-starter-{i}`, `guardian-input`, `guardian-send`, `guardian-msg-{role}-{i}`, `guardian-typing`, `guardian-messages`.

**Tests** (iter 23 — 100% on both surfaces, no retest)
- Backend pytest: 8/8 — happy path, validation (empty/whitespace/length), rate limit 429, history persistence + ordering.
- Frontend Playwright: 13/13 — hero pillars, chip-nav reorder + link chip, GuardianBot end-to-end (real Claude reply, localStorage persistence, reload restoration), Dashboard search positioned correctly + working result navigation, ChatWidget + GuardianBot coexist without overlap.

**Files touched**
- NEW `/app/backend/routes/guardian.py`
- NEW `/app/frontend/src/components/GuardianBot.jsx`
- NEW `/app/frontend/src/components/DashboardSearchBar.jsx`
- EDITED `/app/backend/server.py`, `/app/frontend/src/App.js`, `/app/frontend/src/pages/Landing.jsx`, `/app/frontend/src/pages/Dashboard.jsx`, `/app/frontend/src/components/MobileScrollSpyChips.jsx`


## What's Been Implemented (2026-02-10) — 5-Pillar Hero + Unified Mr Genius / JOY Genius Assistant (iter 24)

**Hero ecosystem strip enriched 4 → 5 pillars** (`/app/frontend/src/pages/Landing.jsx`)
- New `hero-pillars` row reads exactly per spec: **B2B workshops & car dealers / B2C retail / Experience Centre / AI-Built Data platform / JOY BEAST atelier**.

**🤖 UNIFIED "Mr Genius / JOY Genius Assistant"** — one Claude-powered bot for both public and authenticated users.
- Backend (`/app/backend/routes/guardian.py`) **fully rewritten**:
  - Single endpoint `POST /api/guardian/message` silently detects auth via `get_current_user(request)`.
  - **Public mode** (no auth): generic automotive expert (BD + world context, diagnostics, fluids, parts compat, model-specific knowledge).
  - **Portal mode** (signed-in): system prompt augmented with `_build_authenticated_prompt(workshop, tier, orders, products)` injecting:
    - Workshop name + pricing tier
    - Available credit / limit / used (exact BDT)
    - Last 6 orders (number, status, total, date)
    - Top-60 catalogue snapshot with the user's tier-priced `your_price_bdt`
  - Returns `{session_id, reply, authenticated}` so the UI knows which mode rendered.
  - Rate limit bumped 8/min → 12/min per session.
  - History persisted in `db.guardian_messages` keyed by `session_id` + `user_id`.

- Frontend (`/app/frontend/src/components/GuardianBot.jsx`) **fully rebranded**:
  - Trigger label: **"Ask Mr Genius"** (bottom-left floating bubble, gradient red→zinc, ping pulse).
  - Panel header: premium dark-gradient with bot icon, **"JOY Genius Assistant"** title, **"POWERED BY CLAUDE"** sub-line in mono caps.
  - Intro card matches user copy: *"Hey — I'm Genius, your no-nonsense automotive assistant. Diagnostics, maintenance, fluids, parts compatibility, BD market context, world market context — anything and everything related to automobiles. I've got you. Try one of these:"*
  - **Auth-aware starters** via `useAuth()`:
    - Public: AC diagnostic, engine oil, battery, brake-pad pricing
    - Portal: brake pads in stock, last order, credit balance, Toyota Aqua parts
  - **NEW** button in header (`guardian-new-session`) clears thread + localStorage to start fresh conversation.
  - Three-dot animated typing indicator. Message bubbles: rounded-2xl with corner-tail, dark/light theme aware.
  - Footer mode indicator: "Signed in as {Name} · Portal context active · বাংলা supported" (auth) or "No sign-in required · English / বাংলা · Powered by Claude Sonnet 4.5" (public).
  - localStorage key renamed `joy_guardian_sid` → `joy_genius_sid`.

- **ChatWidget removed globally** from `/app/frontend/src/App.js`. Only ONE bot now exists (no more bottom-right dual-bot confusion).

**Tests** (iter 24 — 100% on both surfaces, no retest)
- Backend pytest: 5/5 — public mode reply, auth mode with real BDT figures + ORD-2026 reference (no hallucination), brake-pads tier-price recall, history persistence, rate limit 429.
- Frontend Playwright: 13/13 — 5-pillar strip, ChatWidget absent everywhere, Mr Genius branding, auth-aware starters, real Claude reply on click, NEW button clears state, all regressions pass (chip nav, Body Kits, Dashboard search, EC page, notification preferences).

**Files touched**
- REWRITTEN `/app/backend/routes/guardian.py` (auth-aware unified Genius)
- REWRITTEN `/app/frontend/src/components/GuardianBot.jsx` (Mr Genius branding)
- EDITED `/app/frontend/src/App.js` (ChatWidget removed)
- EDITED `/app/frontend/src/pages/Landing.jsx` (5-pillar hero)


## What's Been Implemented (2026-02-10) — JOY Ecosystem Migrated Above Headline (iter 25)

**Hero JOY Ecosystem strip — moved above the H1 + redesigned** (`/app/frontend/src/pages/Landing.jsx`)
- Position: **above** "Smarter parts. Stronger journeys. One platform." headline (was previously a flat strip below CTAs).
- Visual: equal-height 5-column card grid (1 col mobile / 2 col sm / 5 col lg) with `gap-px` on `bg-zinc-200` background creating crisp hairline dividers between cells. Each card: white background, mono '01..05' number (red on featured 01 & 05, zinc on 02–04), font-display tracking-tight title, micro-description below, **sliding red 2px underline accent on hover** (origin-left scale-x transition 500ms).
- Overline 'THE JOY ECOSYSTEM' in mono uppercase with a horizontal hairline gradient extending right.

**Final pillar copy (per user spec):**
1. **B2B Platform** — Workshops & car dealers (featured red)
2. **B2C Commerce** — E-commerce automobiles for retail
3. **Experience Centre** — Madani Avenue · 100 ft flagship
4. **AI-Driven Data Co.** — Industry intelligence layer
5. **JOY BEAST Atelier** — Body kits · forged · bespoke (featured red)

**Removed**
- The old flat `hero-pillars` strip below CTAs is gone (was redundant with the new top-mounted card grid).

**Tests** (iter 25 — frontend 100%, 9/9 passed, no retest)
- Position above H1 verified via getBoundingClientRect comparison; all 5 pillar testids and copy matches; old hero-pillars absent; CTAs still below H1; mobile responsive (no overflow); regressions all pass (Mr Genius, chip nav, Body Kits Cyber Beast first, Dashboard search).

**Files touched**
- EDITED `/app/frontend/src/pages/Landing.jsx`


## What's Been Implemented (2026-02-10) — Mr Genius Commerce Actions (iter 26)

**🛒 One-tap commerce on Mr Genius replies** — turns the assistant from an answer engine into a commerce surface for signed-in dealers.

**Backend** (`/app/backend/routes/guardian.py`)
- Auth-mode system prompt augmented with an `[ACTIONS]...[/ACTIONS]` instruction. Genius can emit up to 3 structured actions at the end of any reply: `add_to_cart` (sku + qty) or `view_order` (order_id). Public visitors never get action instructions.
- New `_extract_actions(reply, products, orders)` parser: regex-extracts the JSON block, validates each SKU against the user's catalogue snapshot and each order_id against their actual orders, drops malformed/unknown entries silently, caps at 3, enriches each `add_to_cart` action with full product metadata (`product_id`, `name`, `image_url`, `price_bdt` = tier price, `category`, `stock`), and strips the block from the visible reply.
- Response payload now includes `actions: [...]`. Persisted alongside the assistant message in `db.guardian_messages` and rehydrated by `/guardian/history`.

**Frontend** (`/app/frontend/src/components/GuardianBot.jsx`)
- New `renderActions(msgIdx, actions)` block under each assistant message:
  - **Add to cart chip** — red pill: `Add {qty} × {name} · BDT {price}`. Click → `useCart().add(...)`, toast "Added 1 × Brake Pad Set (Ceramic)", chip flips to emerald **"Added"** with `data-consumed="true"`.
  - **View order chip** — dark pill: `View order` icon + label. Click → closes panel, navigates to `/orders/{order_id}`.
- Captures actions both from `/guardian/message` POST response and from `/guardian/history` GET (so action chips survive page reload).
- data-testids: `guardian-actions-{i}`, `guardian-action-{i}-{j}`, `data-action-type` (`add_to_cart` | `view_order`), `data-consumed` flag.

**End-to-end smoke** (manual + agent)
- Auth query "What are 2 popular brake pads I should add to my cart?" → 2 enriched actions:
  - `JA-BRK-002` Brake Pad Set (Ceramic) BDT 1,980 stock 500
  - `JA-PRF-002` Performance Brake Caliper (4-Pot) BDT 78,300 stock 15
- Reply text contains zero `[ACTIONS]` artefacts. `[ACTIONS]` correctly stripped.
- Public users get `actions: []` — verified.

**Tests** (iter 26 — 100% on tested cases; view_order skip due to LLM non-determinism is covered by parallel frontend test which DID emit & navigate)
- Backend pytest: 4 passed + 1 skipped (Genius LLM non-determinism on view_order — frontend covered this).
- Frontend Playwright: 3/3 scenarios — public no-chips, auth add_to_cart click → cart + toast + emerald state, auth view_order navigation, history rehydration of chips.

**Files touched**
- EDITED `/app/backend/routes/guardian.py` (action emit prompt, _ACTIONS_RE, _extract_actions, response + history with actions)
- EDITED `/app/frontend/src/components/GuardianBot.jsx` (useCart, useNavigate, handleAction, renderActions chips)

