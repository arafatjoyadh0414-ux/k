"""Phase 6: public catalog/categories, workshop insights (joy_score), saved bundles."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
WS_HDR = {"Authorization": "Bearer test-token-workshop-1", "Content-Type": "application/json"}
ADMIN_HDR = {"Authorization": "Bearer test-token-admin-1", "Content-Type": "application/json"}


# ====== Public catalog ======
class TestPublicCatalog:
    def test_catalog_no_auth_returns_38_plus(self):
        r = requests.get(f"{BASE_URL}/api/public/catalog")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 38
        first = data[0]
        for k in ["price_bdt", "sku", "name", "category", "image_url", "stock", "is_kit"]:
            assert k in first, f"missing key {k} in catalog item"

    def test_catalog_anonymous_no_auth_header(self):
        # explicitly assert no Authorization header is required
        r = requests.get(f"{BASE_URL}/api/public/catalog", headers={})
        assert r.status_code == 200

    def test_categories_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/public/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all(isinstance(c, str) for c in data)


# ====== Workshop insights / Joy Score ======
class TestWorkshopInsights:
    def test_insights_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/workshop/insights")
        assert r.status_code == 401

    def test_insights_response_shape(self):
        r = requests.get(f"{BASE_URL}/api/workshop/insights", headers=WS_HDR)
        assert r.status_code == 200
        d = r.json()
        # summary
        s = d["summary"]
        for k in ["total_orders", "total_spend_bdt", "discount_saved_bdt",
                  "credit_limit", "credit_used", "credit_utilization_pct",
                  "tier", "active_months"]:
            assert k in s, f"missing summary key {k}"
        # arrays
        assert isinstance(d["monthly_spend"], list)
        assert isinstance(d["top_skus"], list)
        assert isinstance(d["reorder_nudges"], list)
        # joy score
        js = d["joy_score"]
        assert 0 <= js["score"] <= 100
        assert js["grade"] in ("Starter", "Partner", "Elite", "Anchor")
        for c in ["volume", "spend", "payment_punctuality", "longevity",
                  "credit_discipline", "kyc"]:
            assert c in js["components"]
            assert 0 <= js["components"][c] <= 100


# ====== Saved bundles CRUD ======
class TestSavedBundles:
    def _first_pid(self):
        r = requests.get(f"{BASE_URL}/api/public/catalog")
        return r.json()[0]["product_id"]

    def test_create_bundle_requires_name(self):
        r = requests.post(f"{BASE_URL}/api/workshop/bundles", headers=WS_HDR, json={"items": []})
        assert r.status_code == 422

    def test_create_bundle_requires_items(self):
        r = requests.post(f"{BASE_URL}/api/workshop/bundles", headers=WS_HDR, json={"name": "TEST_K"})
        assert r.status_code == 422

    def test_full_crud_owner_isolation(self):
        pid = self._first_pid()
        # Create
        r = requests.post(
            f"{BASE_URL}/api/workshop/bundles",
            headers=WS_HDR,
            json={"name": "TEST_K_phase6", "items": [{"product_id": pid, "quantity": 3}]},
        )
        assert r.status_code in (200, 201)
        b = r.json()
        bid = b["saved_bundle_id"]
        try:
            # GET — list with items_resolved + total
            r = requests.get(f"{BASE_URL}/api/workshop/bundles", headers=WS_HDR)
            assert r.status_code == 200
            mine = [x for x in r.json() if x["saved_bundle_id"] == bid]
            assert len(mine) == 1
            it = mine[0]
            assert "items_resolved" in it and len(it["items_resolved"]) == 1
            ir = it["items_resolved"][0]
            for k in ["name", "sku", "image_url", "your_price_bdt", "line_total"]:
                assert k in ir
            assert ir["line_total"] == ir["your_price_bdt"] * 3
            assert it["total_bdt"] == ir["line_total"]

            # DELETE by another user (admin) should NOT delete (owner isolation)
            r = requests.delete(f"{BASE_URL}/api/workshop/bundles/{bid}", headers=ADMIN_HDR)
            assert r.status_code in (403, 404)
            # bundle still present
            r2 = requests.get(f"{BASE_URL}/api/workshop/bundles", headers=WS_HDR)
            assert any(x["saved_bundle_id"] == bid for x in r2.json())
        finally:
            # DELETE by owner
            r = requests.delete(f"{BASE_URL}/api/workshop/bundles/{bid}", headers=WS_HDR)
            assert r.status_code == 200
            # 404 on second delete
            r = requests.delete(f"{BASE_URL}/api/workshop/bundles/{bid}", headers=WS_HDR)
            assert r.status_code == 404


# ====== Chat smoke (Phase 8 already verified — only smoke) ======
class TestChatSmoke:
    def test_chat_message_returns_200(self):
        r = requests.post(
            f"{BASE_URL}/api/chat/message",
            headers=WS_HDR,
            json={"message": "anything I should reorder?"},
            timeout=60,
        )
        assert r.status_code == 200
        d = r.json()
        assert "reply" in d and isinstance(d["reply"], str) and len(d["reply"]) > 0


# ====== Pre-render shell ======
class TestPrerenderShell:
    def test_index_html_contains_joy_automart(self):
        r = requests.get(BASE_URL + "/")
        assert r.status_code == 200
        body = r.text
        assert "JOY Automart" in body
        assert "Order on WhatsApp instead" in body
        assert 'id="prerender-shell"' in body
        assert '<meta property="og:url" content="https://b2bjoymart.com"' in body
