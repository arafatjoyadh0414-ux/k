"""Smoke tests for VIN lookup + recurring orders scheduler.

Run against a live local backend:
  REACT_APP_BACKEND_URL=http://localhost:8001 pytest tests/test_vin_recurring.py -v
"""

import os
import time
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
WS = {"Authorization": "Bearer test-token-workshop-1"}
AD = {"Authorization": "Bearer test-token-admin-1"}


# ============= VIN =============
class TestVinDecode:
    def test_invalid_vin_400(self):
        r = requests.get(f"{BASE}/api/vin/decode?vin=ABC")
        assert r.status_code == 400

    def test_valid_vin_200(self):
        r = requests.get(f"{BASE}/api/vin/decode?vin=1HGCM82633A123456")
        assert r.status_code == 200
        b = r.json()
        assert b["make"] == "Honda"
        assert b["model"] == "Accord"
        assert b["year"] == 2003
        assert b["vin"] == "1HGCM82633A123456"

    def test_cache_hit_on_second_call(self):
        vin = "1HGCM82633A123456"
        # First call (cached if test_valid_vin_200 ran)
        r1 = requests.get(f"{BASE}/api/vin/decode?vin={vin}")
        # Second call MUST be cached
        r2 = requests.get(f"{BASE}/api/vin/decode?vin={vin}")
        assert r2.status_code == 200
        assert r2.json().get("cached") is True


class TestVinParts:
    def test_parts_returns_shape(self):
        r = requests.get(f"{BASE}/api/vin/parts?vin=JTJBM7FX2D5044123&include_ai=false", headers=WS)
        assert r.status_code == 200
        b = r.json()
        assert "vehicle" in b
        assert "matched_products" in b
        assert "in_stock_count" in b
        assert "ai_suggestions" in b
        assert isinstance(b["matched_products"], list)


class TestSavedVins:
    def test_save_list_delete(self):
        # Save
        r = requests.post(f"{BASE}/api/vin/saved", json={"vin": "1HGCM82633A123456", "label": "Test save"}, headers=WS)
        assert r.status_code == 200
        sid = r.json()["saved_id"]
        # List
        r2 = requests.get(f"{BASE}/api/vin/saved", headers=WS)
        assert r2.status_code == 200
        ids = [s["saved_id"] for s in r2.json()]
        assert sid in ids
        # Delete
        r3 = requests.delete(f"{BASE}/api/vin/saved/{sid}", headers=WS)
        assert r3.status_code == 200


# ============= Recurring =============
class TestRecurring:
    def _get_product_id(self):
        r = requests.get(f"{BASE}/api/products?q=oil", headers=WS)
        return r.json()[0]["product_id"]

    def test_create_list_run_delete(self):
        pid = self._get_product_id()
        # Create
        r = requests.post(
            f"{BASE}/api/recurring",
            json={
                "name": "TEST_pytest_schedule",
                "items": [{"product_id": pid, "quantity": 4}],
                "cadence": "weekly",
                "payment_method": "cod",
                "shipping_address": "Pytest addr",
                "notes": "",
            },
            headers=WS,
        )
        assert r.status_code == 200, r.text
        rid = r.json()["recurring_id"]
        try:
            # List
            r2 = requests.get(f"{BASE}/api/recurring", headers=WS)
            assert r2.status_code == 200
            assert any(s["recurring_id"] == rid for s in r2.json())

            # Pause
            r3 = requests.patch(f"{BASE}/api/recurring/{rid}", json={"is_active": False}, headers=WS)
            assert r3.status_code == 200
            assert r3.json()["is_active"] is False

            # Resume
            r4 = requests.patch(f"{BASE}/api/recurring/{rid}", json={"is_active": True}, headers=WS)
            assert r4.status_code == 200

            # Run-now → should place an order
            r5 = requests.post(f"{BASE}/api/recurring/{rid}/run-now", headers=WS)
            assert r5.status_code == 200, r5.text
            body = r5.json()
            assert body["status"] == "ok"
            assert body["order_id"].startswith("ORD-")
            assert body["total_bdt"] > 0

            # Verify the placed order exists
            r6 = requests.get(f"{BASE}/api/orders/{body['order_id']}", headers=WS)
            assert r6.status_code == 200
            assert r6.json()["source"] == "recurring"
            assert r6.json()["recurring_id"] == rid
        finally:
            # Cleanup
            requests.delete(f"{BASE}/api/recurring/{rid}", headers=WS)

    def test_create_invalid_cadence(self):
        pid = self._get_product_id()
        r = requests.post(
            f"{BASE}/api/recurring",
            json={
                "items": [{"product_id": pid, "quantity": 1}],
                "cadence": "custom",
                "cadence_days": 0,  # invalid
                "payment_method": "cod",
                "shipping_address": "x",
            },
            headers=WS,
        )
        assert r.status_code == 400

    def test_unauthorized(self):
        r = requests.get(f"{BASE}/api/recurring")
        assert r.status_code == 401
