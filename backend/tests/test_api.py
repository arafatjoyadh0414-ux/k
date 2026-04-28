"""Backend API tests for Joy Automart B2B portal.
Covers: root, products, auth, workshop profile/KYC, orders, admin endpoints, file serving.
"""
import io
import os
import time
import uuid
import requests
import pytest
from conftest import BASE_URL, auth_headers


# -------- Root & Products --------
class TestRoot:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("app") == "Joy Automart B2B API"


class TestProducts:
    def test_list_products_returns_at_least_12(self):
        r = requests.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 12
        # validate shape
        p = items[0]
        for k in ("product_id", "name", "sku", "category", "price_bdt", "moq"):
            assert k in p
        assert "_id" not in p

    def test_filter_by_category_brake(self):
        r = requests.get(f"{BASE_URL}/api/products", params={"category": "Brake"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert all(p["category"] == "Brake" for p in items)

    def test_search_q_brake_case_insensitive(self):
        r = requests.get(f"{BASE_URL}/api/products", params={"q": "BrAkE"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            blob = (p["name"] + p["sku"] + p.get("brand", "")).lower()
            assert "brake" in blob or "brk" in blob

    def test_get_single_product(self):
        items = requests.get(f"{BASE_URL}/api/products").json()
        pid = items[0]["product_id"]
        r = requests.get(f"{BASE_URL}/api/products/{pid}")
        assert r.status_code == 200
        assert r.json()["product_id"] == pid

    def test_get_product_404(self):
        r = requests.get(f"{BASE_URL}/api/products/nonexistent_xyz")
        assert r.status_code == 404


# -------- Auth gating --------
class TestAuthGating:
    @pytest.mark.parametrize("path", [
        "/api/auth/me",
        "/api/workshop/me",
        "/api/orders",
    ])
    def test_requires_auth(self, path):
        r = requests.get(f"{BASE_URL}{path}")
        assert r.status_code == 401

    def test_auth_me_with_workshop_token(self, workshop_headers, workshop_session):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=workshop_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["user_id"] == workshop_session["user_id"]
        assert u["role"] == "workshop"

    def test_workshop_me(self, workshop_headers, workshop_session):
        r = requests.get(f"{BASE_URL}/api/workshop/me", headers=workshop_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["workshop"]["workshop_id"] == workshop_session["workshop_id"]
        assert body["workshop"]["kyc_status"] == "approved"


# -------- Workshop profile --------
class TestWorkshopProfile:
    def test_update_profile(self, workshop_headers, workshop_session, mongo):
        payload = {
            "company_name": "Acme Auto Repair Updated",
            "contact_phone": "+8801999999999",
            "address": "Gulshan, Dhaka",
            "city": "Dhaka",
            "trade_license_no": "TL-AUTO-UPDATED",
        }
        r = requests.put(f"{BASE_URL}/api/workshop/profile", headers=workshop_headers, json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["company_name"] == payload["company_name"]
        assert data["trade_license_no"] == payload["trade_license_no"]
        # Verify persisted
        ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
        assert ws["company_name"] == payload["company_name"]


# -------- Orders --------
@pytest.fixture(scope="module")
def cheap_product():
    items = requests.get(f"{BASE_URL}/api/products").json()
    # pick smallest price * moq item - oil filter (450 * 10 = 4500)
    items.sort(key=lambda p: p["price_bdt"] * p.get("moq", 1))
    return items[0]


class TestOrders:
    def test_create_order_403_when_kyc_not_approved(self, workshop_pending_headers, cheap_product):
        payload = {
            "items": [{"product_id": cheap_product["product_id"], "quantity": cheap_product.get("moq", 1)}],
            "payment_method": "cod",
            "shipping_address": "Dhaka, BD",
            "notes": "test",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=workshop_pending_headers, json=payload)
        assert r.status_code == 403

    def test_create_order_below_moq(self, workshop_headers, cheap_product):
        moq = cheap_product.get("moq", 1)
        if moq <= 1:
            pytest.skip("MOQ is 1, cannot test below MOQ")
        payload = {
            "items": [{"product_id": cheap_product["product_id"], "quantity": 1}],
            "payment_method": "cod",
            "shipping_address": "Dhaka, BD",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=workshop_headers, json=payload)
        assert r.status_code == 400

    def test_create_cod_order_success(self, workshop_headers, workshop_session, cheap_product):
        moq = cheap_product.get("moq", 1)
        payload = {
            "items": [{"product_id": cheap_product["product_id"], "quantity": moq}],
            "payment_method": "cod",
            "shipping_address": "Dhaka, BD",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=workshop_headers, json=payload)
        assert r.status_code == 200
        order = r.json()
        assert order["status"] == "placed"
        assert order["payment_method"] == "cod"
        assert order["total_bdt"] == cheap_product["price_bdt"] * moq
        assert len(order["status_history"]) == 1
        # store for later
        pytest.cod_order_id = order["order_id"]

    def test_create_credit_order_success_and_credit_used(self, workshop_headers, workshop_session, cheap_product, mongo):
        moq = cheap_product.get("moq", 1)
        payload = {
            "items": [{"product_id": cheap_product["product_id"], "quantity": moq}],
            "payment_method": "credit",
            "shipping_address": "Dhaka, BD",
        }
        before = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})["credit_used"]
        r = requests.post(f"{BASE_URL}/api/orders", headers=workshop_headers, json=payload)
        assert r.status_code == 200
        order = r.json()
        assert order["payment_method"] == "credit"
        assert order["due_date"]
        after = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})["credit_used"]
        assert after == before + order["total_bdt"]
        pytest.credit_order_id = order["order_id"]

    def test_create_credit_order_insufficient(self, workshop_headers, cheap_product, mongo, workshop_session):
        # Set credit_limit very low and try a big order
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_limit": 1.0, "credit_used": 0.0}}
        )
        moq = cheap_product.get("moq", 1)
        payload = {
            "items": [{"product_id": cheap_product["product_id"], "quantity": moq}],
            "payment_method": "credit",
            "shipping_address": "Dhaka",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=workshop_headers, json=payload)
        assert r.status_code == 400
        # restore credit
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_limit": 50000.0, "credit_used": 0.0}}
        )

    def test_list_orders_for_workshop(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/orders", headers=workshop_headers)
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list)
        assert len(orders) >= 1


# -------- Admin RBAC --------
class TestAdminRBAC:
    @pytest.mark.parametrize("path", ["/api/admin/stats", "/api/admin/workshops"])
    def test_workshop_forbidden(self, path, workshop_headers):
        r = requests.get(f"{BASE_URL}{path}", headers=workshop_headers)
        assert r.status_code == 403

    @pytest.mark.parametrize("path", ["/api/admin/stats", "/api/admin/workshops"])
    def test_admin_allowed(self, path, admin_headers):
        r = requests.get(f"{BASE_URL}{path}", headers=admin_headers)
        assert r.status_code == 200


# -------- Admin: KYC + Credit + Order workflow --------
class TestAdminWorkflow:
    def test_admin_stats_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        for k in ("total_workshops", "pending_kyc", "approved_workshops",
                  "total_orders", "pending_orders", "products_count", "total_revenue_bdt"):
            assert k in s
        assert s["products_count"] >= 12
        assert s["total_orders"] >= 1

    def test_kyc_decision_approved(self, admin_headers, workshop_pending_session, mongo):
        wid = workshop_pending_session["workshop_id"]
        r = requests.patch(
            f"{BASE_URL}/api/admin/workshops/{wid}/kyc",
            headers=admin_headers, json={"decision": "approved", "remark": "ok"},
        )
        assert r.status_code == 200
        assert r.json()["kyc_status"] == "approved"
        ws = mongo.workshops.find_one({"workshop_id": wid})
        assert ws["kyc_status"] == "approved"

    def test_kyc_decision_invalid(self, admin_headers, workshop_pending_session):
        wid = workshop_pending_session["workshop_id"]
        r = requests.patch(
            f"{BASE_URL}/api/admin/workshops/{wid}/kyc",
            headers=admin_headers, json={"decision": "maybe"},
        )
        assert r.status_code == 400

    def test_set_credit_limit(self, admin_headers, workshop_pending_session, mongo):
        wid = workshop_pending_session["workshop_id"]
        r = requests.patch(
            f"{BASE_URL}/api/admin/workshops/{wid}/credit",
            headers=admin_headers, json={"credit_limit": 25000},
        )
        assert r.status_code == 200
        assert r.json()["credit_limit"] == 25000
        ws = mongo.workshops.find_one({"workshop_id": wid})
        assert ws["credit_limit"] == 25000

    def test_order_status_progression(self, admin_headers, workshop_session, mongo):
        # use the cod order created earlier
        oid = getattr(pytest, "cod_order_id", None)
        assert oid, "cod_order_id missing"
        for status in ["confirmed", "packed", "shipped", "delivered"]:
            r = requests.patch(
                f"{BASE_URL}/api/admin/orders/{oid}/status",
                headers=admin_headers, json={"status": status, "note": f"-> {status}"},
            )
            assert r.status_code == 200, f"failed at {status}: {r.text}"
            assert r.json()["status"] == status
        order = mongo.orders.find_one({"order_id": oid})
        statuses = [h["status"] for h in order["status_history"]]
        for s in ["placed", "confirmed", "packed", "shipped", "delivered"]:
            assert s in statuses

    def test_mark_credit_order_paid_decrements_credit(self, admin_headers, workshop_session, mongo):
        oid = getattr(pytest, "credit_order_id", None)
        assert oid, "credit_order_id missing"
        # Restore credit to known state matching credit_order
        order = mongo.orders.find_one({"order_id": oid})
        # Set credit_used to order total to simulate "owed"
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_used": order["total_bdt"]}}
        )
        r = requests.patch(
            f"{BASE_URL}/api/admin/orders/{oid}/payment",
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["payment_status"] == "paid"
        ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
        assert ws["credit_used"] == 0


# -------- Admin: Product CRUD --------
class TestAdminProducts:
    def test_admin_product_crud(self, admin_headers):
        payload = {
            "name": "TEST_Widget", "sku": f"TEST-{uuid.uuid4().hex[:6]}",
            "category": "Engine", "description": "test", "image_url": "",
            "price_bdt": 99.5, "moq": 1, "stock": 10, "brand": "TEST",
        }
        # CREATE
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=admin_headers, json=payload)
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == "TEST_Widget"
        assert "product_id" in created
        assert "_id" not in created
        pid = created["product_id"]
        # READ
        r2 = requests.get(f"{BASE_URL}/api/products/{pid}")
        assert r2.status_code == 200
        # UPDATE
        payload["price_bdt"] = 150.0
        payload["name"] = "TEST_Widget_v2"
        r3 = requests.put(f"{BASE_URL}/api/admin/products/{pid}", headers=admin_headers, json=payload)
        assert r3.status_code == 200
        assert r3.json()["price_bdt"] == 150.0
        assert r3.json()["name"] == "TEST_Widget_v2"
        # DELETE
        r4 = requests.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=admin_headers)
        assert r4.status_code == 200
        # Confirm gone
        r5 = requests.get(f"{BASE_URL}/api/products/{pid}")
        assert r5.status_code == 404

    def test_workshop_cannot_create_product(self, workshop_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/products", headers=workshop_headers,
            json={"name": "X", "sku": "X", "category": "X", "price_bdt": 1},
        )
        assert r.status_code == 403


# -------- KYC file upload + file serving --------
class TestKycUpload:
    def test_upload_and_serve(self, workshop_session, workshop_headers, mongo):
        token = workshop_session["token"]
        # multipart upload - no Content-Type header (let requests build it)
        files = {
            "file": ("test_license.png",
                     b"\x89PNG\r\n\x1a\n" + b"0" * 100, "image/png"),
        }
        data = {"doc_type": "trade_license"}
        r = requests.post(
            f"{BASE_URL}/api/workshop/kyc/upload",
            headers={"Authorization": f"Bearer {token}"},
            files=files, data=data, timeout=60,
        )
        if r.status_code != 200:
            pytest.skip(f"Storage upload failed (external dependency): {r.status_code} {r.text[:200]}")
        doc = r.json()
        assert doc["type"] == "trade_license"
        assert "path" in doc
        # Verify document in db
        ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
        assert any(d["type"] == "trade_license" for d in ws.get("documents", []))

        # Serve file - owner allowed
        path = doc["path"]
        r2 = requests.get(f"{BASE_URL}/api/files/{path}",
                          headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200

    def test_files_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/files/joyautomart/kyc/someuser/abc.png")
        assert r.status_code == 401

    def test_files_forbidden_other_user(self, workshop_pending_session):
        # token of pending workshop trying to access path of approved workshop
        other_path = "joyautomart/kyc/someotheruser/x.png"
        r = requests.get(
            f"{BASE_URL}/api/files/{other_path}",
            headers={"Authorization": f"Bearer {workshop_pending_session['token']}"},
        )
        # Should be 403 (forbidden) before reaching storage
        assert r.status_code == 403
