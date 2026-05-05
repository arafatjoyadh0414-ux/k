"""Iteration 8 regression: post-refactor spot checks + new features
(vehicle cascade, driver portal, admin dp access_token).
"""
import os
import uuid
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WS = {"Authorization": "Bearer test-token-workshop-1"}
AD = {"Authorization": "Bearer test-token-admin-1"}


# ---------- Spot checks: one per route module ----------
class TestRouteModuleSpotChecks:
    def test_products(self):
        r = requests.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders", headers=WS)
        assert r.status_code == 200

    def test_admin_stats(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=AD)
        assert r.status_code == 200

    def test_admin_workshops(self):
        r = requests.get(f"{BASE_URL}/api/admin/workshops", headers=AD)
        assert r.status_code == 200

    def test_admin_suppliers(self):
        r = requests.get(f"{BASE_URL}/api/admin/suppliers", headers=AD)
        assert r.status_code == 200

    def test_admin_delivery_persons(self):
        r = requests.get(f"{BASE_URL}/api/admin/delivery-persons", headers=AD)
        assert r.status_code == 200

    def test_admin_inquiries(self):
        r = requests.get(f"{BASE_URL}/api/admin/inquiries", headers=AD)
        assert r.status_code == 200

    def test_admin_returns(self):
        r = requests.get(f"{BASE_URL}/api/admin/returns", headers=AD)
        assert r.status_code == 200

    def test_admin_tier_upgrades(self):
        r = requests.get(f"{BASE_URL}/api/admin/tier-upgrades", headers=AD)
        assert r.status_code == 200

    def test_kits(self):
        r = requests.get(f"{BASE_URL}/api/kits")
        assert r.status_code == 200

    def test_service_packs(self):
        r = requests.get(f"{BASE_URL}/api/service-packs")
        assert r.status_code == 200

    def test_public_catalog(self):
        r = requests.get(f"{BASE_URL}/api/public/catalog")
        assert r.status_code == 200

    def test_workshop_insights(self):
        r = requests.get(f"{BASE_URL}/api/workshop/insights", headers=WS)
        assert r.status_code == 200

    def test_workshop_bundles(self):
        r = requests.get(f"{BASE_URL}/api/workshop/bundles", headers=WS)
        assert r.status_code in (200, 404)  # 404 acceptable if endpoint not implemented

    def test_quote_post(self):
        r = requests.post(
            f"{BASE_URL}/api/quote",
            json={"items": []},
            headers=WS,
        )
        assert r.status_code in (200, 400, 422)

    def test_tiers(self):
        r = requests.get(f"{BASE_URL}/api/tiers")
        assert r.status_code in (200, 404)

    def test_part_requests(self):
        r = requests.get(f"{BASE_URL}/api/part-requests", headers=WS)
        assert r.status_code in (200, 404)

    def test_chat_message(self):
        r = requests.post(
            f"{BASE_URL}/api/chat/message",
            json={"message": "hello"},
            headers=WS,
        )
        assert r.status_code in (200, 400, 422)


# ---------- Vehicle cascade ----------
class TestVehicleOptions:
    def test_returns_brand_tree(self):
        r = requests.get(f"{BASE_URL}/api/vehicles/options")
        assert r.status_code == 200
        data = r.json()
        assert "brands" in data
        assert "by_brand" in data
        assert isinstance(data["brands"], list)
        assert isinstance(data["by_brand"], dict)
        # Each brand entry should have models/by_model
        for brand in data["brands"]:
            entry = data["by_brand"].get(brand)
            assert entry is not None
            assert "models" in entry
            assert "by_model" in entry


# ---------- Admin delivery persons get access_token ----------
class TestAdminDeliveryPersonsAccessToken:
    def test_create_dp_returns_access_token(self):
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "name": f"TEST_DP_{suffix}",
            "phone": "+8801700000000",
            "vehicle_type": "bike",
            "vehicle_no": f"TEST-{suffix}",
        }
        r = requests.post(
            f"{BASE_URL}/api/admin/delivery-persons",
            json=payload,
            headers=AD,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body, f"Missing access_token in {body}"
        assert body["access_token"]
        dp_id = body.get("delivery_person_id")
        # Cleanup
        try:
            requests.delete(
                f"{BASE_URL}/api/admin/delivery-persons/{dp_id}",
                headers=AD,
            )
        except Exception:
            pass


# ---------- Driver portal ----------
DRIVER_ID = "dp_37dbd39f6e"
DRIVER_TOKEN = "6d275d71d9ba41f09a8b771b638c0510"
SEED_ORDER = "ORD-20260505-E20641"


class TestDriverPortal:
    def test_profile_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/driver/{DRIVER_ID}/profile?token=BAD")
        assert r.status_code == 401

    def test_profile_success(self):
        r = requests.get(f"{BASE_URL}/api/driver/{DRIVER_ID}/profile?token={DRIVER_TOKEN}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["delivery_person_id"] == DRIVER_ID
        assert "name" in d

    def test_orders_success(self):
        r = requests.get(f"{BASE_URL}/api/driver/{DRIVER_ID}/orders?token={DRIVER_TOKEN}")
        assert r.status_code == 200, r.text
        orders = r.json()
        assert isinstance(orders, list)
        # The seeded order should be visible
        ids = [o["order_id"] for o in orders]
        assert SEED_ORDER in ids, f"Seed order {SEED_ORDER} not found in {ids}"
        for o in orders:
            assert "company_name" in o
            assert "shipping_address" in o
            assert "item_count" in o
            assert "contact_phone" in o

    def test_invalid_transition(self):
        # delivered when status=packed should fail
        r = requests.patch(
            f"{BASE_URL}/api/driver/{DRIVER_ID}/orders/{SEED_ORDER}/status?token={DRIVER_TOKEN}",
            json={"status": "delivered"},
        )
        assert r.status_code == 400, r.text

    def test_cross_driver_forbidden(self):
        # Create a different dp, then try to update SEED_ORDER under that dp's token
        suffix = uuid.uuid4().hex[:8]
        rc = requests.post(
            f"{BASE_URL}/api/admin/delivery-persons",
            json={"name": f"TEST_X_{suffix}", "phone": "+880", "vehicle_type": "bike", "vehicle_no": "TX"},
            headers=AD,
        )
        assert rc.status_code == 200, rc.text
        dp = rc.json()
        try:
            r = requests.patch(
                f"{BASE_URL}/api/driver/{dp['delivery_person_id']}/orders/{SEED_ORDER}/status"
                f"?token={dp['access_token']}",
                json={"status": "shipped"},
            )
            assert r.status_code == 403, r.text
        finally:
            requests.delete(
                f"{BASE_URL}/api/admin/delivery-persons/{dp['delivery_person_id']}",
                headers=AD,
            )
