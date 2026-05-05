"""Phase 7 tests: Joy Score-driven auto tier upgrade and admin audit log.

Covers:
- GET /api/workshop/insights exposes joy_score + next_threshold.
- GET /api/admin/tier-upgrades returns audit rows (admin-only).
- POST /api/orders triggers check_and_apply_tier_upgrade and returns
  `tier_upgraded` in response when thresholds cross.
"""

import os
import uuid
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- workshop/insights ----------
class TestInsightsJoyScore:
    def test_insights_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/workshop/insights")
        assert r.status_code == 401

    def test_insights_returns_joy_score_and_next_threshold(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/workshop/insights", headers=workshop_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "joy_score" in data
        js = data["joy_score"]
        assert "score" in js and "grade" in js and "components" in js
        assert isinstance(js["score"], int)
        assert 0 <= js["score"] <= 100
        assert js["grade"] in ("Starter", "Partner", "Elite", "Anchor")
        for key in ("volume", "spend", "payment_punctuality", "longevity",
                   "credit_discipline", "kyc"):
            assert key in js["components"]

        # next_threshold is present (may be None only if score>=85)
        assert "next_threshold" in data
        nt = data["next_threshold"]
        if js["score"] < 85:
            assert nt is not None
            for key in ("score_needed", "tier", "credit_floor_bdt", "label"):
                assert key in nt
            assert nt["score_needed"] > js["score"]


# ---------- admin/tier-upgrades ----------
class TestAdminTierUpgradesEndpoint:
    def test_admin_list_requires_admin(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tier-upgrades", headers=workshop_headers)
        assert r.status_code in (401, 403)

    def test_admin_list_returns_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tier-upgrades", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)


# ---------- POST /api/orders triggers auto-upgrade ----------
class TestOrderTriggersAutoUpgrade:
    """Pre-seed a workshop near the gold threshold (score_needed=70) so a
    small order nudges score > 70 and returns tier_upgraded in the response."""

    def test_order_bumps_to_gold(self, mongo, admin_headers):
        suffix = uuid.uuid4().hex[:8]
        user_id = f"TEST_tu_user_{suffix}"
        workshop_id = f"TEST_tu_ws_{suffix}"
        token = f"TEST_tu_token_{suffix}"
        now = datetime.now(timezone.utc).isoformat()

        # Seed workshop at silver tier so an upgrade to gold is possible.
        mongo.users.insert_one({
            "user_id": user_id, "email": f"TEST_tu_{suffix}@example.com",
            "name": "Tier Upgrade Test", "picture": "", "role": "workshop",
            "created_at": now,
        })
        mongo.workshops.insert_one({
            "workshop_id": workshop_id, "user_id": user_id,
            "company_name": "Tier Up Garage", "contact_phone": "+880",
            "address": "Dhaka", "city": "Dhaka", "trade_license_no": "TL-TU",
            "kyc_status": "approved", "kyc_remark": "",
            "pricing_tier": "silver",
            "credit_limit": 100000.0, "credit_used": 0.0,
            "documents": [], "created_at": now,
        })
        mongo.user_sessions.insert_one({
            "user_id": user_id, "session_token": token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": now,
        })

        # Pre-seed 20 historical orders so volume component is ~80/100.
        # That alone should drive score above 70 on next evaluation.
        for i in range(20):
            mongo.orders.insert_one({
                "order_id": f"TEST_TU_PRE_{suffix}_{i}",
                "user_id": user_id, "workshop_id": workshop_id,
                "company_name": "Tier Up Garage", "pricing_tier": "silver",
                "items": [], "subtotal_bdt": 5000, "cost_total_bdt": 3000,
                "discount_pct": 0, "discount_amount_bdt": 0, "discount_label": "",
                "total_bdt": 5000, "profit_bdt": 2000,
                "payment_method": "cod", "payment_status": "paid",
                "due_date": None, "shipping_address": "Dhaka", "notes": "",
                "status": "delivered",
                "status_history": [{"status": "placed", "at": now, "note": ""}],
                "created_at": now,
            })

        try:
            # Pick any real product for the order
            prod = mongo.products.find_one({}, {"_id": 0, "product_id": 1, "moq": 1})
            assert prod, "Need a seeded product for order creation"
            payload = {
                "items": [{"product_id": prod["product_id"], "quantity": max(1, prod.get("moq", 1))}],
                "payment_method": "cod",
                "shipping_address": "Dhaka test",
                "notes": "",
            }
            r = requests.post(f"{BASE_URL}/api/orders", json=payload,
                              headers=auth_headers(token))
            assert r.status_code == 200, r.text
            order = r.json()

            # Verify auto-upgrade surfaced in response
            assert "tier_upgraded" in order, (
                f"Expected tier_upgraded in order response, got keys={list(order.keys())}"
            )
            tu = order["tier_upgraded"]
            for k in ("from_tier", "to_tier", "from_credit_bdt",
                      "to_credit_bdt", "score", "grade"):
                assert k in tu
            # Silver -> gold OR platinum
            assert tu["from_tier"] == "silver"
            assert tu["to_tier"] in ("gold", "platinum")
            assert tu["to_credit_bdt"] >= tu["from_credit_bdt"]
            assert tu["score"] >= 70

            # Verify workshop doc in DB was updated
            ws_after = mongo.workshops.find_one({"workshop_id": workshop_id}, {"_id": 0})
            assert ws_after["pricing_tier"] in ("gold", "platinum")
            assert ws_after["credit_limit"] >= 200000

            # Verify audit log was created and visible to admin
            adm = requests.get(f"{BASE_URL}/api/admin/tier-upgrades", headers=admin_headers)
            assert adm.status_code == 200
            rows = adm.json()
            match = [x for x in rows if x.get("workshop_id") == workshop_id]
            assert match, "Upgrade audit row not found in /admin/tier-upgrades"
            row = match[0]
            for k in ("log_id", "workshop_id", "from_tier", "to_tier",
                      "from_credit_bdt", "to_credit_bdt", "score", "grade",
                      "created_at"):
                assert k in row

        finally:
            mongo.users.delete_one({"user_id": user_id})
            mongo.workshops.delete_one({"workshop_id": workshop_id})
            mongo.user_sessions.delete_one({"session_token": token})
            mongo.orders.delete_many({"user_id": user_id})
            mongo.tier_upgrade_log.delete_many({"workshop_id": workshop_id})
