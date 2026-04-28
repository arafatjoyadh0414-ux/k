"""
Phase 2 backend tests: kits catalog, expanded categories, and Stripe online checkout.
Reuses fixtures from conftest.py (workshop_session, workshop_pending_session, admin_session).
"""
import os
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

EXPECTED_NEW_CATEGORIES = {
    "Body Kits", "Modifications", "Performance",
    "Accessories", "Lighting", "Tyres & Wheels", "Tools", "Audio",
}


# ============= Kits =============
class TestKits:
    def test_list_kits_returns_5_ordered_by_tier(self):
        r = requests.get(f"{BASE_URL}/api/kits", timeout=15)
        assert r.status_code == 200, r.text
        kits = r.json()
        assert isinstance(kits, list)
        assert len(kits) == 5, f"Expected 5 kits, got {len(kits)}"
        tiers = [k.get("kit_tier") for k in kits]
        assert tiers == ["entry", "mass", "special", "premium", "flagship"], tiers
        # Each must expose required kit fields
        for k in kits:
            assert k.get("name")
            assert isinstance(k.get("kit_features"), list) and len(k["kit_features"]) >= 1
            assert isinstance(k.get("gallery"), list) and len(k["gallery"]) >= 1
            assert k.get("image_url")
            assert k.get("is_kit") is True
            assert "_id" not in k


# ============= Products / Categories =============
class TestProductsExpandedCatalog:
    def test_products_count_and_categories(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        # Phase 1 had 12, Phase 2 adds 14 SKUs + 5 kits = 31 total
        assert len(products) >= 31, f"Expected >=31 products, got {len(products)}"
        cats = {p.get("category") for p in products}
        missing = EXPECTED_NEW_CATEGORIES - cats
        assert not missing, f"Missing new categories: {missing}"

    def test_products_filter_body_kits_returns_5(self):
        r = requests.get(f"{BASE_URL}/api/products", params={"category": "Body Kits"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 5, f"Body Kits filter returned {len(items)}"
        for p in items:
            assert p["category"] == "Body Kits"

    def test_products_search_stealth(self):
        r = requests.get(f"{BASE_URL}/api/products", params={"q": "stealth"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert any("Stealth V2" in p.get("name", "") for p in items), [p.get("name") for p in items]


# ============= Stripe Checkout =============
def _first_normal_product():
    r = requests.get(f"{BASE_URL}/api/products", timeout=15)
    for p in r.json():
        if not p.get("is_kit") and p.get("moq", 1) <= 4:
            return p
    return r.json()[0]


class TestStripeCheckout:
    def test_create_checkout_unauth_401(self):
        prod = _first_normal_product()
        payload = {
            "items": [{"product_id": prod["product_id"], "quantity": prod.get("moq", 1)}],
            "shipping_address": "Test 123",
            "notes": "",
            "origin_url": "https://example.com",
        }
        r = requests.post(f"{BASE_URL}/api/checkout/create", json=payload, timeout=15)
        assert r.status_code == 401

    def test_create_checkout_kyc_pending_403(self):
        # Create a fresh pending workshop locally - the shared workshop_pending fixture
        # is approved by other tests in test_api.py within the same session.
        import uuid as _uuid
        from datetime import datetime as _dt, timezone as _tz, timedelta as _td
        client = MongoClient(MONGO_URL); db = client[DB_NAME]
        suffix = _uuid.uuid4().hex[:8]
        uid = f"TEST_p2pending_{suffix}"
        wid = f"TEST_p2pending_ws_{suffix}"
        tok = f"TEST_p2pending_tok_{suffix}"
        now = _dt.now(_tz.utc).isoformat()
        db.users.insert_one({"user_id": uid, "email": f"TEST_p2p_{suffix}@x.com",
                             "name": "P2P", "picture": "", "role": "workshop", "created_at": now})
        db.workshops.insert_one({"workshop_id": wid, "user_id": uid,
                                 "company_name": "", "contact_phone": "", "address": "", "city": "",
                                 "trade_license_no": "", "kyc_status": "not_submitted",
                                 "kyc_remark": "", "credit_limit": 0.0, "credit_used": 0.0,
                                 "documents": [], "created_at": now})
        db.user_sessions.insert_one({"user_id": uid, "session_token": tok,
                                     "expires_at": (_dt.now(_tz.utc) + _td(days=1)).isoformat(),
                                     "created_at": now})
        try:
            prod = _first_normal_product()
            payload = {
                "items": [{"product_id": prod["product_id"], "quantity": prod.get("moq", 1)}],
                "shipping_address": "Test 123", "notes": "",
                "origin_url": "https://example.com",
            }
            r = requests.post(f"{BASE_URL}/api/checkout/create", json=payload,
                              headers={"Authorization": f"Bearer {tok}",
                                       "Content-Type": "application/json"}, timeout=15)
            assert r.status_code == 403, r.text
        finally:
            db.users.delete_one({"user_id": uid})
            db.workshops.delete_one({"workshop_id": wid})
            db.user_sessions.delete_one({"session_token": tok})
            client.close()

    def test_create_checkout_invalid_product_400(self, workshop_headers):
        payload = {
            "items": [{"product_id": "prd_doesnotexist", "quantity": 1}],
            "shipping_address": "Test 123", "notes": "",
            "origin_url": "https://example.com",
        }
        r = requests.post(f"{BASE_URL}/api/checkout/create", json=payload,
                          headers=workshop_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_create_checkout_success_persists_state(self, workshop_session, workshop_headers):
        prod = _first_normal_product()
        qty = prod.get("moq", 1)
        payload = {
            "items": [{"product_id": prod["product_id"], "quantity": qty}],
            "shipping_address": "House 1, Road 2, Dhaka",
            "notes": "Phase2 test",
            "origin_url": "https://example.com",
        }
        # Snapshot credit_used BEFORE
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        ws_before = db.workshops.find_one({"user_id": workshop_session["user_id"]})
        credit_used_before = ws_before.get("credit_used", 0.0)

        r = requests.post(f"{BASE_URL}/api/checkout/create", json=payload,
                          headers=workshop_headers, timeout=30)
        if r.status_code != 200:
            # Stripe sandbox might be unreachable / rate-limited from this pod.
            # We still assert the failure mode is informative (5xx upstream is acceptable
            # only with a clear error; otherwise this is a real bug).
            assert r.status_code in (502, 503, 504), f"Unexpected: {r.status_code} {r.text}"
            client.close()
            import pytest as _p
            _p.skip(f"Stripe sandbox unavailable: {r.status_code} {r.text[:120]}")
        data = r.json()
        assert "url" in data and data["url"].startswith("http")
        assert "session_id" in data and data["session_id"]
        assert "order_id" in data and data["order_id"].startswith("ORD-")

        # DB assertions
        order = db.orders.find_one({"order_id": data["order_id"]})
        assert order is not None
        assert order["status"] == "pending_payment"
        assert order["payment_method"] == "online"
        assert order["payment_status"] == "unpaid"
        assert order["user_id"] == workshop_session["user_id"]

        txn = db.payment_transactions.find_one({"session_id": data["session_id"]})
        assert txn is not None
        assert txn["payment_status"] == "initiated"
        assert txn["status"] == "pending"
        assert txn["order_id"] == data["order_id"]
        assert txn["currency"] == "usd"
        assert txn["amount_bdt"] == prod["price_bdt"] * qty
        # USD conversion (USD_TO_BDT=120)
        expected_usd = max(1.0, round((prod["price_bdt"] * qty) / 120.0, 2))
        assert abs(txn["amount_usd"] - expected_usd) < 0.01

        # credit_used MUST NOT change for online payment
        ws_after = db.workshops.find_one({"user_id": workshop_session["user_id"]})
        assert ws_after.get("credit_used", 0.0) == credit_used_before

        # Cleanup transient docs
        db.orders.delete_one({"order_id": data["order_id"]})
        db.payment_transactions.delete_one({"session_id": data["session_id"]})
        client.close()

    def test_status_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/checkout/status/cs_test_doesnotexist", timeout=15)
        assert r.status_code == 401

    def test_status_ownership_enforced(self, workshop_session, workshop_headers, admin_headers):
        # Seed a fake transaction owned by workshop user
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        sid = "cs_test_TEST_ownership_fake"
        db.payment_transactions.insert_one({
            "transaction_id": "txn_test_own",
            "session_id": sid,
            "order_id": "ORD-TEST-OWNERSHIP",
            "user_id": workshop_session["user_id"],
            "amount_bdt": 100, "amount_usd": 1.0, "currency": "usd",
            "metadata": {}, "payment_status": "initiated", "status": "pending",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        try:
            # Different user (admin) -> 403
            r = requests.get(f"{BASE_URL}/api/checkout/status/{sid}",
                             headers=admin_headers, timeout=15)
            assert r.status_code == 403, r.text
        finally:
            db.payment_transactions.delete_one({"session_id": sid})
            client.close()

    def test_status_unknown_session_404(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/checkout/status/cs_test_definitely_missing_xyz",
                         headers=workshop_headers, timeout=15)
        assert r.status_code == 404


# ============= Webhook =============
class TestStripeWebhook:
    def test_webhook_invalid_signature_returns_4xx_not_5xx(self):
        r = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            data=b'{"type":"checkout.session.completed"}',
            headers={"Stripe-Signature": "t=0,v1=invalid", "Content-Type": "application/json"},
            timeout=15,
        )
        assert 400 <= r.status_code < 500, f"Webhook should be 4xx for bad sig, got {r.status_code}: {r.text}"


# ============= Idempotent seed =============
class TestSeedIdempotency:
    def test_no_duplicate_skus(self):
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        try:
            pipeline = [
                {"$group": {"_id": "$sku", "count": {"$sum": 1}}},
                {"$match": {"count": {"$gt": 1}}},
            ]
            dups = list(db.products.aggregate(pipeline))
            assert dups == [], f"Duplicate SKUs found: {dups}"
        finally:
            client.close()


# ============= Regression: existing flows still work =============
class TestRegression:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_auth_required_for_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders", timeout=10)
        assert r.status_code == 401

    def test_cod_order_still_works(self, workshop_session, workshop_headers):
        prod = _first_normal_product()
        payload = {
            "items": [{"product_id": prod["product_id"], "quantity": prod.get("moq", 1)}],
            "payment_method": "cod",
            "shipping_address": "Dhaka",
            "notes": "phase2 regression",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload,
                          headers=workshop_headers, timeout=15)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["payment_method"] == "cod"
        assert order["status"] == "placed"
        # cleanup
        client = MongoClient(MONGO_URL)
        client[DB_NAME].orders.delete_one({"order_id": order["order_id"]})
        client.close()

    def test_credit_order_does_not_break(self, workshop_session, workshop_headers):
        prod = _first_normal_product()
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        ws_before = db.workshops.find_one({"user_id": workshop_session["user_id"]})
        used_before = ws_before.get("credit_used", 0.0)

        payload = {
            "items": [{"product_id": prod["product_id"], "quantity": prod.get("moq", 1)}],
            "payment_method": "credit",
            "shipping_address": "Dhaka", "notes": "credit regression",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload,
                          headers=workshop_headers, timeout=15)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["payment_method"] == "credit"
        ws_after = db.workshops.find_one({"user_id": workshop_session["user_id"]})
        assert ws_after["credit_used"] == used_before + order["total_bdt"]
        # rollback
        db.orders.delete_one({"order_id": order["order_id"]})
        db.workshops.update_one({"user_id": workshop_session["user_id"]},
                                {"$set": {"credit_used": used_before}})
        client.close()

    def test_admin_endpoints_still_work(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "total_orders" in body or "orders" in body or "products" in body or isinstance(body, dict)
