"""Phase 3 backend tests: volume discount, inquiries, bulk CSV import."""
import io
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from conftest import auth_headers, BASE_URL  # noqa: F401


# ============= Helpers =============
@pytest.fixture(scope="module")
def products(base_url):
    r = requests.get(f"{base_url}/api/products", timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 5
    return items


def _items_for_subtotal(products, target):
    """Build cart items list whose subtotal == target_bdt (or as close as possible).
    Use the cheapest priceable product so we can hit exact thresholds via quantity."""
    # Find a product with price that divides target cleanly. Fall back to closest.
    # Use Engine Oil Filter if present (price 450). Then add trims.
    by_price = sorted(products, key=lambda p: p["price_bdt"])
    # Strategy: pick price=1 if exists; otherwise use products to assemble target via greedy.
    # Simpler: take the 450 BDT filter and adjust. But thresholds are 49999/50000 etc.
    # Use brake pad set (2200 BDT, moq=4) is poor. Instead just use price 450 and qty.
    # 49999 / 450 not integer. We need exact. Take a product, override quantity, but real DB price is fixed.
    # Solution: insert a TEST product with price=1.0 via direct DB so we can hit exact values.
    raise NotImplementedError


@pytest.fixture(scope="module")
def unit_product(mongo):
    """Insert a TEST product with price 1.0 BDT and moq=1 to hit precise subtotals."""
    pid = f"TEST_prd_{uuid.uuid4().hex[:8]}"
    sku = f"TEST-UNIT-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "product_id": pid,
        "name": "TEST Unit Product",
        "sku": sku,
        "category": "TEST",
        "description": "",
        "image_url": "",
        "price_bdt": 1.0,
        "moq": 1,
        "stock": 1000000,
        "brand": "TEST",
        "is_kit": False,
        "kit_tier": "",
        "kit_features": [],
        "gallery": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mongo.products.insert_one(doc)
    yield {"product_id": pid, "sku": sku, "price_bdt": 1.0}
    mongo.products.delete_one({"product_id": pid})


@pytest.fixture
def big_credit_workshop(mongo):
    """Workshop with very high credit limit so credit-method orders don't fail."""
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_bigws_user_{suffix}"
    workshop_id = f"TEST_bigws_{suffix}"
    token = f"TEST_token_bigws_{suffix}"
    now = datetime.now(timezone.utc).isoformat()
    mongo.users.insert_one({
        "user_id": user_id, "email": f"TEST_bigws_{suffix}@example.com",
        "name": "Big Credit", "picture": "", "role": "workshop", "created_at": now,
    })
    mongo.workshops.insert_one({
        "workshop_id": workshop_id, "user_id": user_id,
        "company_name": "BigCo", "contact_phone": "+88017", "address": "Dhaka",
        "city": "Dhaka", "trade_license_no": "TL-BIG",
        "kyc_status": "approved", "kyc_remark": "",
        "credit_limit": 1_000_000.0, "credit_used": 0.0,
        "documents": [], "created_at": now,
    })
    mongo.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now,
    })
    yield {"user_id": user_id, "workshop_id": workshop_id, "token": token}
    mongo.users.delete_one({"user_id": user_id})
    mongo.workshops.delete_one({"workshop_id": workshop_id})
    mongo.user_sessions.delete_one({"session_token": token})
    mongo.orders.delete_many({"user_id": user_id})


@pytest.fixture
def limit50k_workshop(mongo):
    """Workshop with credit_limit=50000 (to test post-discount credit check)."""
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_lws_user_{suffix}"
    workshop_id = f"TEST_lws_{suffix}"
    token = f"TEST_token_lws_{suffix}"
    now = datetime.now(timezone.utc).isoformat()
    mongo.users.insert_one({
        "user_id": user_id, "email": f"TEST_lws_{suffix}@example.com",
        "name": "Lim50k", "picture": "", "role": "workshop", "created_at": now,
    })
    mongo.workshops.insert_one({
        "workshop_id": workshop_id, "user_id": user_id,
        "company_name": "Lim50k Co", "contact_phone": "+88017", "address": "Dhaka",
        "city": "Dhaka", "trade_license_no": "TL-LIM",
        "kyc_status": "approved", "kyc_remark": "",
        "credit_limit": 50_000.0, "credit_used": 0.0,
        "documents": [], "created_at": now,
    })
    mongo.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now,
    })
    yield {"user_id": user_id, "workshop_id": workshop_id, "token": token}
    mongo.users.delete_one({"user_id": user_id})
    mongo.workshops.delete_one({"workshop_id": workshop_id})
    mongo.user_sessions.delete_one({"session_token": token})
    mongo.orders.delete_many({"user_id": user_id})


# ============= /api/quote =============
class TestQuote:
    def test_quote_requires_auth(self, base_url, unit_product):
        r = requests.post(f"{base_url}/api/quote",
                          json={"items": [{"product_id": unit_product["product_id"], "quantity": 100}]},
                          timeout=15)
        assert r.status_code == 401, r.text

    @pytest.mark.parametrize("qty,expected_pct,expected_amount", [
        (49999, 0.0, 0.0),       # below first tier
        (50000, 0.05, 2500.0),   # exactly 50k -> 5%
        (99999, 0.05, 4999.95),  # just below 100k -> 5%
        (100000, 0.07, 7000.0),  # exactly 100k -> 7%
        (299999, 0.07, 20999.93),# just below 300k -> 7%
        (300000, 0.10, 30000.0), # exactly 300k -> 10%
    ])
    def test_quote_tier_thresholds(self, base_url, workshop_session, unit_product,
                                    qty, expected_pct, expected_amount):
        r = requests.post(
            f"{base_url}/api/quote",
            json={"items": [{"product_id": unit_product["product_id"], "quantity": qty}]},
            headers=auth_headers(workshop_session["token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["subtotal_bdt"] == float(qty)
        assert data["discount_pct"] == expected_pct
        assert abs(data["discount_amount_bdt"] - expected_amount) < 0.01
        assert abs(data["total_bdt"] - (qty - expected_amount)) < 0.01
        # tiers list
        assert isinstance(data["tiers"], list) and len(data["tiers"]) == 3

    def test_quote_label_set_when_tier_applies(self, base_url, workshop_session, unit_product):
        r = requests.post(
            f"{base_url}/api/quote",
            json={"items": [{"product_id": unit_product["product_id"], "quantity": 50000}]},
            headers=auth_headers(workshop_session["token"]),
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert "50,000" in data["discount_label"]

    def test_quote_label_empty_below_threshold(self, base_url, workshop_session, unit_product):
        r = requests.post(
            f"{base_url}/api/quote",
            json={"items": [{"product_id": unit_product["product_id"], "quantity": 100}]},
            headers=auth_headers(workshop_session["token"]),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["discount_label"] == ""


# ============= /api/orders with discount =============
class TestOrdersDiscount:
    def test_order_applies_discount_and_credit_used_post_discount(
        self, base_url, big_credit_workshop, unit_product, mongo
    ):
        # subtotal=120000 -> 7% discount -> total=111600
        r = requests.post(
            f"{base_url}/api/orders",
            json={
                "items": [{"product_id": unit_product["product_id"], "quantity": 120000}],
                "payment_method": "credit",
                "shipping_address": "Test addr",
                "notes": "",
            },
            headers=auth_headers(big_credit_workshop["token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["subtotal_bdt"] == 120000.0
        assert order["discount_pct"] == 0.07
        assert order["discount_amount_bdt"] == 8400.0
        assert order["total_bdt"] == 111600.0
        assert "100,000" in order["discount_label"]
        # credit_used must be incremented by post-discount total
        ws = mongo.workshops.find_one({"workshop_id": big_credit_workshop["workshop_id"]})
        assert ws["credit_used"] == 111600.0

    def test_order_below_threshold_no_discount(
        self, base_url, big_credit_workshop, unit_product
    ):
        r = requests.post(
            f"{base_url}/api/orders",
            json={
                "items": [{"product_id": unit_product["product_id"], "quantity": 1000}],
                "payment_method": "cod",
                "shipping_address": "Addr",
            },
            headers=auth_headers(big_credit_workshop["token"]),
            timeout=15,
        )
        assert r.status_code == 200
        o = r.json()
        assert o["discount_pct"] == 0.0
        assert o["discount_amount_bdt"] == 0.0
        assert o["total_bdt"] == 1000.0
        assert o["discount_label"] == ""

    def test_credit_check_uses_post_discount(
        self, base_url, limit50k_workshop, unit_product, mongo
    ):
        """Workshop with limit=50000 should be ABLE to place 50001 subtotal order
        because 5% discount makes post-discount total = 47500.95 <= 50000."""
        r = requests.post(
            f"{base_url}/api/orders",
            json={
                "items": [{"product_id": unit_product["product_id"], "quantity": 50001}],
                "payment_method": "credit",
                "shipping_address": "Addr",
            },
            headers=auth_headers(limit50k_workshop["token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["subtotal_bdt"] == 50001.0
        assert o["discount_pct"] == 0.05
        assert abs(o["total_bdt"] - 47500.95) < 0.01
        ws = mongo.workshops.find_one({"workshop_id": limit50k_workshop["workshop_id"]})
        assert abs(ws["credit_used"] - 47500.95) < 0.01

    def test_credit_check_rejects_when_post_discount_exceeds_limit(
        self, base_url, limit50k_workshop, unit_product
    ):
        # subtotal=100000 -> 7% disc -> total=93000 > 50000 limit
        r = requests.post(
            f"{base_url}/api/orders",
            json={
                "items": [{"product_id": unit_product["product_id"], "quantity": 100000}],
                "payment_method": "credit",
                "shipping_address": "Addr",
            },
            headers=auth_headers(limit50k_workshop["token"]),
            timeout=15,
        )
        assert r.status_code == 400
        assert "credit" in r.text.lower() or "insufficient" in r.text.lower()


# ============= /api/inquiries (public) =============
class TestInquiriesPublic:
    def test_inquiry_public_no_auth_required(self, base_url, mongo):
        r = requests.post(
            f"{base_url}/api/inquiries",
            json={
                "name": "TEST John Doe", "phone": "+8801712345678",
                "email": "john@test.com", "city": "Dhaka",
                "car_make_model": "Toyota Axio 2015", "kit_sku": "JA-KIT-SHADOW",
                "message": "Interested",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "inquiry_id" in data
        assert data["inquiry_id"].startswith("INQ-")
        assert data["ok"] is True
        # cleanup
        mongo.inquiries.delete_one({"inquiry_id": data["inquiry_id"]})

    def test_inquiry_resolves_kit_name(self, base_url, mongo):
        r = requests.post(
            f"{base_url}/api/inquiries",
            json={
                "name": "TEST Kit Name", "phone": "017",
                "car_make_model": "Honda", "kit_sku": "JA-KIT-SHADOW",
            },
            timeout=15,
        )
        assert r.status_code == 200
        inq = mongo.inquiries.find_one({"inquiry_id": r.json()["inquiry_id"]})
        assert inq["kit_name"] == "Shadow GT Body Kit"
        mongo.inquiries.delete_one({"inquiry_id": r.json()["inquiry_id"]})

    @pytest.mark.parametrize("missing", ["name", "phone", "car_make_model"])
    def test_inquiry_rejects_missing_required(self, base_url, missing):
        body = {
            "name": "A", "phone": "017", "car_make_model": "Honda", "kit_sku": "JA-KIT-SHADOW",
        }
        body[missing] = "   "  # empty after strip
        r = requests.post(f"{base_url}/api/inquiries", json=body, timeout=15)
        assert r.status_code == 400, f"missing={missing} status={r.status_code}"


# ============= /api/admin/inquiries =============
class TestAdminInquiries:
    def test_list_requires_admin(self, base_url, workshop_session):
        r = requests.get(
            f"{base_url}/api/admin/inquiries",
            headers=auth_headers(workshop_session["token"]),
            timeout=15,
        )
        assert r.status_code == 403

    def test_list_unauthenticated_returns_401(self, base_url):
        r = requests.get(f"{base_url}/api/admin/inquiries", timeout=15)
        assert r.status_code == 401

    def test_list_sorted_desc_and_status_filter(self, base_url, admin_session, mongo):
        # Seed 2 inquiries
        ids = []
        for i, status in enumerate(["new", "contacted"]):
            iid = f"INQ-TEST-{uuid.uuid4().hex[:6].upper()}"
            mongo.inquiries.insert_one({
                "inquiry_id": iid, "name": "TEST", "phone": "017",
                "email": "", "city": "", "car_make_model": "X",
                "kit_sku": "JA-KIT-SHADOW", "kit_name": "X",
                "message": "", "status": status,
                "created_at": (datetime.now(timezone.utc) + timedelta(seconds=i)).isoformat(),
            })
            ids.append(iid)
        try:
            r = requests.get(
                f"{base_url}/api/admin/inquiries",
                headers=auth_headers(admin_session["token"]),
                timeout=15,
            )
            assert r.status_code == 200
            items = r.json()
            assert len(items) >= 2
            # ensure created_at desc
            ts = [it["created_at"] for it in items]
            assert ts == sorted(ts, reverse=True)
            # filter by status=new
            r2 = requests.get(
                f"{base_url}/api/admin/inquiries?status=new",
                headers=auth_headers(admin_session["token"]),
                timeout=15,
            )
            assert r2.status_code == 200
            assert all(it["status"] == "new" for it in r2.json())
        finally:
            mongo.inquiries.delete_many({"inquiry_id": {"$in": ids}})

    def test_patch_requires_admin(self, base_url, workshop_session, mongo):
        iid = f"INQ-TEST-{uuid.uuid4().hex[:6].upper()}"
        mongo.inquiries.insert_one({
            "inquiry_id": iid, "name": "T", "phone": "017", "email": "",
            "city": "", "car_make_model": "X", "kit_sku": "X", "kit_name": "X",
            "message": "", "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = requests.patch(
                f"{base_url}/api/admin/inquiries/{iid}",
                json={"status": "contacted"},
                headers=auth_headers(workshop_session["token"]),
                timeout=15,
            )
            assert r.status_code == 403
        finally:
            mongo.inquiries.delete_one({"inquiry_id": iid})

    def test_patch_valid_status_with_note(self, base_url, admin_session, mongo):
        iid = f"INQ-TEST-{uuid.uuid4().hex[:6].upper()}"
        mongo.inquiries.insert_one({
            "inquiry_id": iid, "name": "T", "phone": "017", "email": "",
            "city": "", "car_make_model": "X", "kit_sku": "X", "kit_name": "X",
            "message": "", "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = requests.patch(
                f"{base_url}/api/admin/inquiries/{iid}",
                json={"status": "scheduled", "admin_note": "Booked for Mon"},
                headers=auth_headers(admin_session["token"]),
                timeout=15,
            )
            assert r.status_code == 200, r.text
            doc = r.json()
            assert doc["status"] == "scheduled"
            assert doc["admin_note"] == "Booked for Mon"
        finally:
            mongo.inquiries.delete_one({"inquiry_id": iid})

    def test_patch_invalid_status_rejected(self, base_url, admin_session, mongo):
        iid = f"INQ-TEST-{uuid.uuid4().hex[:6].upper()}"
        mongo.inquiries.insert_one({
            "inquiry_id": iid, "name": "T", "phone": "017", "email": "",
            "city": "", "car_make_model": "X", "kit_sku": "X", "kit_name": "X",
            "message": "", "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = requests.patch(
                f"{base_url}/api/admin/inquiries/{iid}",
                json={"status": "foobar"},
                headers=auth_headers(admin_session["token"]),
                timeout=15,
            )
            assert r.status_code == 400
        finally:
            mongo.inquiries.delete_one({"inquiry_id": iid})


# ============= /api/admin/products/bulk-csv =============
class TestBulkCSV:
    def test_requires_admin(self, base_url, workshop_session):
        files = {"file": ("p.csv", b"name,sku,category,price_bdt\n", "text/csv")}
        r = requests.post(
            f"{base_url}/api/admin/products/bulk-csv",
            headers={"Authorization": f"Bearer {workshop_session['token']}"},
            files=files, timeout=15,
        )
        assert r.status_code == 403

    def test_missing_required_headers_rejected(self, base_url, admin_session):
        files = {"file": ("p.csv", b"name,sku,category\nA,B,C\n", "text/csv")}
        r = requests.post(
            f"{base_url}/api/admin/products/bulk-csv",
            headers={"Authorization": f"Bearer {admin_session['token']}"},
            files=files, timeout=15,
        )
        assert r.status_code == 400
        assert "header" in r.text.lower() or "missing" in r.text.lower()

    def test_non_utf8_rejected(self, base_url, admin_session):
        # invalid UTF-8 bytes
        bad = b"name,sku,category,price_bdt\n\xff\xfe\xfd,X,Y,1\n"
        files = {"file": ("p.csv", bad, "text/csv")}
        r = requests.post(
            f"{base_url}/api/admin/products/bulk-csv",
            headers={"Authorization": f"Bearer {admin_session['token']}"},
            files=files, timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_insert_and_update_skus(self, base_url, admin_session, mongo):
        sku_new = f"TEST-CSV-NEW-{uuid.uuid4().hex[:6].upper()}"
        sku_existing = f"TEST-CSV-UPD-{uuid.uuid4().hex[:6].upper()}"
        # pre-seed an existing SKU
        mongo.products.insert_one({
            "product_id": f"prd_{uuid.uuid4().hex[:10]}",
            "name": "Old Name", "sku": sku_existing, "category": "Old",
            "description": "", "image_url": "", "price_bdt": 100.0,
            "moq": 1, "stock": 10, "brand": "",
            "is_kit": False, "kit_tier": "", "kit_features": [], "gallery": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        csv_text = (
            "name,sku,category,price_bdt,description,image_url,moq,stock,brand\n"
            f"New Product,{sku_new},Brake,250.5,desc,http://img,2,50,JoyOEM\n"
            f"Updated Name,{sku_existing},Engine,999,upd,http://img2,3,77,NewBrand\n"
        ).encode("utf-8")
        files = {"file": ("p.csv", csv_text, "text/csv")}
        try:
            r = requests.post(
                f"{base_url}/api/admin/products/bulk-csv",
                headers={"Authorization": f"Bearer {admin_session['token']}"},
                files=files, timeout=20,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["inserted"] == 1
            assert data["updated"] == 1
            assert data["total_errors"] == 0
            assert data["errors"] == []

            # verify DB persistence
            new_doc = mongo.products.find_one({"sku": sku_new})
            assert new_doc and new_doc["name"] == "New Product"
            assert new_doc["price_bdt"] == 250.5
            assert new_doc["moq"] == 2
            assert new_doc["brand"] == "JoyOEM"

            upd_doc = mongo.products.find_one({"sku": sku_existing})
            assert upd_doc["name"] == "Updated Name"
            assert upd_doc["price_bdt"] == 999.0
            assert upd_doc["category"] == "Engine"
        finally:
            mongo.products.delete_many({"sku": {"$in": [sku_new, sku_existing]}})

    def test_row_errors_reported_but_others_inserted(self, base_url, admin_session, mongo):
        sku_ok = f"TEST-CSV-OK-{uuid.uuid4().hex[:6].upper()}"
        csv_text = (
            "name,sku,category,price_bdt\n"
            f",MISSING-NAME,Brake,100\n"           # missing name
            f"Bad Price,BADPRICE-{uuid.uuid4().hex[:4]},Brake,not_a_number\n"  # bad price
            f"Good Row,{sku_ok},Brake,500\n"
        ).encode("utf-8")
        files = {"file": ("p.csv", csv_text, "text/csv")}
        try:
            r = requests.post(
                f"{base_url}/api/admin/products/bulk-csv",
                headers={"Authorization": f"Bearer {admin_session['token']}"},
                files=files, timeout=20,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["inserted"] == 1
            assert data["total_errors"] == 2
            assert mongo.products.find_one({"sku": sku_ok}) is not None
        finally:
            mongo.products.delete_one({"sku": sku_ok})


# ============= /api/admin/stats =============
class TestAdminStats:
    def test_stats_includes_new_inquiries(self, base_url, admin_session, mongo):
        # seed one new inquiry
        iid = f"INQ-TEST-{uuid.uuid4().hex[:6].upper()}"
        mongo.inquiries.insert_one({
            "inquiry_id": iid, "name": "T", "phone": "017", "email": "",
            "city": "", "car_make_model": "X", "kit_sku": "X", "kit_name": "X",
            "message": "", "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = requests.get(
                f"{base_url}/api/admin/stats",
                headers=auth_headers(admin_session["token"]),
                timeout=15,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert "new_inquiries" in data
            assert isinstance(data["new_inquiries"], int)
            assert data["new_inquiries"] >= 1
        finally:
            mongo.inquiries.delete_one({"inquiry_id": iid})
