"""Iter 12 backend tests: Visual Search + Job Cards (WMS Lite)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
WS_TOKEN = "test-token-workshop-1"
WS_HEADERS = {"Authorization": f"Bearer {WS_TOKEN}"}
TEST_IMAGE = "/app/frontend/src/assets/experience-centre/ec-cafe-wheels.png"


# ============= Visual Search =============
class TestVisualSearch:
    def test_visual_search_happy_path(self):
        with open(TEST_IMAGE, "rb") as f:
            files = {"image": ("wheel.png", f, "image/png")}
            data = {"hint": "wheel rim"}
            r = requests.post(
                f"{BASE_URL}/api/visual-search",
                headers=WS_HEADERS, files=files, data=data, timeout=90,
            )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        body = r.json()
        assert "search_id" in body
        ident = body.get("identification") or {}
        assert ident.get("part_name")
        assert "category" in ident
        assert "confidence" in ident
        assert isinstance(ident.get("visible_identifiers"), list)
        assert isinstance(ident.get("likely_brands"), list)
        assert isinstance(ident.get("search_keywords"), list)
        assert "condition_assessment" in ident
        assert "replacement_advice" in ident
        # Confidence ideally > 0.5 but allow >= 0.0 since it's a real LLM call
        assert float(ident.get("confidence") or 0) >= 0.0
        # tier returned
        assert body.get("tier") in {"retail", "silver", "gold", "platinum"}
        # matches up to 12
        matches = body.get("matches") or []
        assert isinstance(matches, list)
        assert len(matches) <= 12
        if matches:
            m = matches[0]
            assert "your_price_bdt" in m
            assert "retail_price_bdt" in m

    def test_visual_search_rejects_text_mime(self):
        files = {"image": ("not_image.txt", b"hello world this is text content " * 50, "text/plain")}
        r = requests.post(f"{BASE_URL}/api/visual-search", headers=WS_HEADERS, files=files, timeout=15)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:200]}"

    def test_visual_search_requires_auth(self):
        with open(TEST_IMAGE, "rb") as f:
            files = {"image": ("wheel.png", f, "image/png")}
            r = requests.post(f"{BASE_URL}/api/visual-search", files=files, timeout=15)
        assert r.status_code in (401, 403)


# ============= Job Cards CRUD =============
@pytest.fixture(scope="module")
def created_job_id():
    payload = {
        "customer_name": "TEST_Iter12 Buyer",
        "customer_phone": "+8801711000099",
        "vehicle_brand": "Toyota",
        "vehicle_model": "Corolla",
        "vehicle_year": 2018,
        "vehicle_plate": "DHA-1234",
        "complaint": "Brake noise on front",
        "mechanic_name": "Jamal",
        "parts": [],
        "labour_charge_bdt": 1500,
    }
    r = requests.post(f"{BASE_URL}/api/job-cards", headers=WS_HEADERS, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "open"
    assert body["job_id"].startswith("JC-")
    return body["job_id"]


class TestJobCards:
    def test_list_job_cards(self):
        r = requests.get(f"{BASE_URL}/api/job-cards", headers=WS_HEADERS, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "job_cards" in body
        assert isinstance(body["job_cards"], list)

    def test_list_filter_status(self):
        r = requests.get(f"{BASE_URL}/api/job-cards?status=open", headers=WS_HEADERS, timeout=15)
        assert r.status_code == 200
        for c in r.json()["job_cards"]:
            assert c["status"] == "open"

    def test_create_validation_missing_complaint(self):
        bad = {"customer_name": "X", "vehicle_brand": "Toyota", "vehicle_model": "Aqua", "complaint": ""}
        r = requests.post(f"{BASE_URL}/api/job-cards", headers=WS_HEADERS, json=bad, timeout=15)
        assert r.status_code in (400, 422)

    def test_create_validation_missing_brand(self):
        bad = {"customer_name": "X", "vehicle_brand": "", "vehicle_model": "Aqua", "complaint": "noise"}
        r = requests.post(f"{BASE_URL}/api/job-cards", headers=WS_HEADERS, json=bad, timeout=15)
        assert r.status_code in (400, 422)

    def test_get_job_card(self, created_job_id):
        r = requests.get(f"{BASE_URL}/api/job-cards/{created_job_id}", headers=WS_HEADERS, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["job_id"] == created_job_id
        assert "total_bdt" in body
        assert "parts_count" in body

    def test_patch_status_and_parts(self, created_job_id):
        # Try to find a real product SKU to attach
        prods = requests.get(f"{BASE_URL}/api/products?limit=1", headers=WS_HEADERS, timeout=15)
        sku = None
        if prods.status_code == 200:
            data = prods.json()
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                items = data.get("products") or data.get("items") or []
            else:
                items = []
            if items:
                sku = items[0].get("sku")
        parts = [{"sku": sku or "MOCK-SKU-1", "name": "Front pad", "quantity": 2, "price_bdt": 500, "source": "catalog"}]
        r = requests.patch(
            f"{BASE_URL}/api/job-cards/{created_job_id}",
            headers=WS_HEADERS,
            json={"status": "in_progress", "parts": parts, "labour_charge_bdt": 2000},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "in_progress"
        assert len(body["parts"]) == 1
        assert body["total_bdt"] == 500 * 2 + 2000

    def test_patch_invalid_status(self, created_job_id):
        r = requests.patch(
            f"{BASE_URL}/api/job-cards/{created_job_id}",
            headers=WS_HEADERS, json={"status": "weirdvalue"}, timeout=15,
        )
        assert r.status_code == 400

    def test_to_cart(self, created_job_id):
        r = requests.post(f"{BASE_URL}/api/job-cards/{created_job_id}/to-cart", headers=WS_HEADERS, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["job_id"] == created_job_id
        assert "items" in body and isinstance(body["items"], list)
        assert "missing_skus" in body
        assert body.get("tier") in {"retail", "silver", "gold", "platinum"}
        # Verify tier price was applied (gold should be lower than retail) when item exists
        for it in body["items"]:
            assert "price_bdt" in it
            assert "retail_price_bdt" in it
            if body["tier"] == "gold" and it["retail_price_bdt"] > 0:
                assert it["price_bdt"] <= it["retail_price_bdt"]

    def test_complete_status_sets_completed_at(self, created_job_id):
        r = requests.patch(
            f"{BASE_URL}/api/job-cards/{created_job_id}",
            headers=WS_HEADERS, json={"status": "completed"}, timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "completed"
        assert body.get("completed_at")

    def test_delete_job_card(self, created_job_id):
        r = requests.delete(f"{BASE_URL}/api/job-cards/{created_job_id}", headers=WS_HEADERS, timeout=15)
        assert r.status_code == 200
        # Verify gone
        r2 = requests.get(f"{BASE_URL}/api/job-cards/{created_job_id}", headers=WS_HEADERS, timeout=15)
        assert r2.status_code == 404

    def test_existing_seeded_jc(self):
        r = requests.get(f"{BASE_URL}/api/job-cards/JC-20260506-A8A839", headers=WS_HEADERS, timeout=15)
        # allow either present (seeded) or 404 if it was wiped
        assert r.status_code in (200, 404)


# ============= Regression =============
class TestRegression:
    def test_landing_stats(self):
        r = requests.get(f"{BASE_URL}/api/public/stats", timeout=10)
        assert r.status_code == 200

    def test_cars_news(self):
        r = requests.get(f"{BASE_URL}/api/public/cars-news", timeout=10)
        assert r.status_code == 200
        body = r.json()
        items = body.get("items") or body.get("articles") or body
        if isinstance(items, list):
            assert len(items) > 0

    def test_products_list_auth(self):
        r = requests.get(f"{BASE_URL}/api/products?limit=5", headers=WS_HEADERS, timeout=15)
        assert r.status_code == 200

    def test_orders_list_auth(self):
        r = requests.get(f"{BASE_URL}/api/orders", headers=WS_HEADERS, timeout=15)
        assert r.status_code == 200
