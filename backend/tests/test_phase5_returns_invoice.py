"""Phase 5 tests: Invoice PDF + Returns/RMA + Notifications gating."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")


def _iso(dt):
    return dt.astimezone(timezone.utc).isoformat()


# ---------------- Fixtures: seed delivered order + product ----------------
@pytest.fixture
def product(mongo):
    """Seed a product with known stock for restock verification."""
    pid = f"TEST_PROD_{uuid.uuid4().hex[:8]}"
    mongo.products.insert_one({
        "product_id": pid, "sku": f"TSKU-{pid[-6:]}",
        "name": "TEST Brake Pad", "category": "brakes",
        "price_bdt": 500.0, "cost_bdt": 300.0, "stock": 10,
        "image_url": "", "is_active": True,
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    yield pid
    mongo.products.delete_one({"product_id": pid})


def _make_order(mongo, workshop_session, product_id, delivered_days_ago=2,
                payment_method="credit", qty=3, price=500.0, status="delivered"):
    order_id = f"TEST_ORD_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    delivered_ts = now - timedelta(days=delivered_days_ago)
    order = {
        "order_id": order_id,
        "user_id": workshop_session["user_id"],
        "workshop_id": workshop_session["workshop_id"],
        "status": status,
        "items": [{
            "product_id": product_id, "sku": "TSKU",
            "name": "TEST Brake Pad", "image_url": "",
            "quantity": qty, "price_bdt": price,
            "cost_bdt": 300.0, "line_total_bdt": price * qty,
        }],
        "subtotal_bdt": price * qty,
        "discount_pct": 0, "discount_amount_bdt": 0,
        "delivery_fee_bdt": 0.0,
        "total_bdt": price * qty,
        "cost_total_bdt": 300.0 * qty,
        "profit_bdt": (price - 300.0) * qty,
        "payment_method": payment_method,
        "payment_status": "unpaid",
        "status_history": [
            {"status": "placed", "at": _iso(now - timedelta(days=delivered_days_ago + 2)), "note": ""},
            {"status": "delivered", "at": _iso(delivered_ts), "note": ""},
        ] if status == "delivered" else [],
        "created_at": _iso(now - timedelta(days=delivered_days_ago + 2)),
    }
    mongo.orders.insert_one(order)
    return order_id


@pytest.fixture
def delivered_order(mongo, workshop_session, product):
    oid = _make_order(mongo, workshop_session, product, delivered_days_ago=2)
    yield oid, product
    mongo.orders.delete_one({"order_id": oid})
    mongo.returns.delete_many({"order_id": oid})


@pytest.fixture
def old_delivered_order(mongo, workshop_session, product):
    oid = _make_order(mongo, workshop_session, product, delivered_days_ago=15)
    yield oid, product
    mongo.orders.delete_one({"order_id": oid})
    mongo.returns.delete_many({"order_id": oid})


@pytest.fixture
def pending_order(mongo, workshop_session, product):
    """Order that is NOT delivered (status=placed)."""
    oid = _make_order(mongo, workshop_session, product, status="placed")
    yield oid, product
    mongo.orders.delete_one({"order_id": oid})


# ============ Invoice PDF ============
class TestInvoicePDF:
    def test_invoice_anon_401(self, delivered_order):
        oid, _ = delivered_order
        r = requests.get(f"{BASE_URL}/api/orders/{oid}/invoice.pdf")
        assert r.status_code == 401

    def test_invoice_not_found_404(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/orders/NONEXIST-ORDER/invoice.pdf",
                         headers=workshop_headers)
        assert r.status_code == 404

    def test_invoice_owner_200_pdf(self, delivered_order, workshop_headers):
        oid, _ = delivered_order
        r = requests.get(f"{BASE_URL}/api/orders/{oid}/invoice.pdf",
                         headers=workshop_headers)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").lower().startswith("application/pdf")
        # Content-Disposition attachment
        cd = r.headers.get("content-disposition", "").lower()
        assert "attachment" in cd
        assert oid.lower() in cd or "invoice-" in cd
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 1024

    def test_invoice_admin_can_access(self, delivered_order, admin_headers):
        oid, _ = delivered_order
        r = requests.get(f"{BASE_URL}/api/orders/{oid}/invoice.pdf",
                         headers=admin_headers)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_invoice_other_workshop_403(self, delivered_order, mongo):
        """A different workshop should get 403."""
        oid, _ = delivered_order
        # Create a separate workshop user
        suffix = uuid.uuid4().hex[:8]
        uid = f"TEST_ws2_{suffix}"
        tok = f"TEST_tok_ws2_{suffix}"
        now = _iso(datetime.now(timezone.utc))
        mongo.users.insert_one({"user_id": uid, "email": f"t_{suffix}@t.com",
                                "name": "X", "role": "workshop", "created_at": now})
        mongo.workshops.insert_one({"workshop_id": f"TEST_ws2_id_{suffix}",
                                    "user_id": uid, "company_name": "Other",
                                    "kyc_status": "approved", "credit_limit": 0,
                                    "credit_used": 0, "created_at": now})
        mongo.user_sessions.insert_one({
            "user_id": uid, "session_token": tok,
            "expires_at": _iso(datetime.now(timezone.utc) + timedelta(days=7)),
            "created_at": now,
        })
        try:
            r = requests.get(f"{BASE_URL}/api/orders/{oid}/invoice.pdf",
                             headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 403, r.text
        finally:
            mongo.users.delete_one({"user_id": uid})
            mongo.workshops.delete_one({"user_id": uid})
            mongo.user_sessions.delete_one({"session_token": tok})


# ============ Returns POST validation ============
class TestReturnsCreate:
    def test_anon_401(self, delivered_order):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns",
                          json={"order_id": oid, "items": [{"product_id": pid, "quantity": 1}]})
        assert r.status_code == 401

    def test_happy_path_creates_return(self, delivered_order, workshop_headers, mongo):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "reason": "Defective",
                                "items": [{"product_id": pid, "quantity": 2, "reason": "broken"}]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        rid = body["return_id"]
        assert rid.startswith("RMA-")
        doc = mongo.returns.find_one({"return_id": rid})
        assert doc is not None
        assert doc["status"] == "requested"
        assert doc["refund_total_bdt"] == 500.0 * 2
        mongo.returns.delete_one({"return_id": rid})

    def test_reject_outside_7_day_window(self, old_delivered_order, workshop_headers):
        oid, pid = old_delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "items": [{"product_id": pid, "quantity": 1}]})
        assert r.status_code == 400
        assert "window" in r.text.lower() or "7" in r.text

    def test_reject_not_delivered(self, pending_order, workshop_headers):
        oid, pid = pending_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "items": [{"product_id": pid, "quantity": 1}]})
        assert r.status_code == 400
        assert "deliver" in r.text.lower()

    def test_reject_unknown_order(self, workshop_headers):
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": "NONEXIST", "items": [{"product_id": "p", "quantity": 1}]})
        assert r.status_code == 404

    def test_reject_item_not_in_order(self, delivered_order, workshop_headers):
        oid, _ = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid,
                                "items": [{"product_id": "NOT_IN_ORDER", "quantity": 1}]})
        assert r.status_code == 400
        assert "not in order" in r.text.lower()

    def test_reject_qty_zero(self, delivered_order, workshop_headers):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid,
                                "items": [{"product_id": pid, "quantity": 0}]})
        assert r.status_code == 400

    def test_reject_qty_exceeds_ordered(self, delivered_order, workshop_headers):
        oid, pid = delivered_order  # ordered qty is 3
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid,
                                "items": [{"product_id": pid, "quantity": 99}]})
        assert r.status_code == 400
        assert "exceed" in r.text.lower()

    def test_reject_empty_items(self, delivered_order, workshop_headers):
        oid, _ = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "items": []})
        assert r.status_code == 400

    def test_reject_other_workshop_order(self, delivered_order, mongo):
        oid, pid = delivered_order
        suffix = uuid.uuid4().hex[:8]
        uid = f"TEST_ws3_{suffix}"
        tok = f"TEST_tok_ws3_{suffix}"
        now = _iso(datetime.now(timezone.utc))
        mongo.users.insert_one({"user_id": uid, "email": f"x_{suffix}@t.com",
                                "name": "X", "role": "workshop", "created_at": now})
        mongo.workshops.insert_one({"workshop_id": f"TEST_ws3_id_{suffix}", "user_id": uid,
                                    "company_name": "Other", "kyc_status": "approved",
                                    "credit_limit": 0, "credit_used": 0, "created_at": now})
        mongo.user_sessions.insert_one({"user_id": uid, "session_token": tok,
                                        "expires_at": _iso(datetime.now(timezone.utc) + timedelta(days=7)),
                                        "created_at": now})
        try:
            r = requests.post(f"{BASE_URL}/api/returns",
                              headers={"Authorization": f"Bearer {tok}"},
                              json={"order_id": oid,
                                    "items": [{"product_id": pid, "quantity": 1}]})
            assert r.status_code == 403
        finally:
            mongo.users.delete_one({"user_id": uid})
            mongo.workshops.delete_one({"user_id": uid})
            mongo.user_sessions.delete_one({"session_token": tok})


# ============ Returns listing & detail ============
class TestReturnsListing:
    @pytest.fixture
    def a_return(self, delivered_order, workshop_headers, mongo):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid,
                                "items": [{"product_id": pid, "quantity": 1}]})
        assert r.status_code == 200
        rid = r.json()["return_id"]
        yield rid, oid, pid
        mongo.returns.delete_one({"return_id": rid})

    def test_list_workshop_sees_own(self, a_return, workshop_headers):
        rid, _, _ = a_return
        r = requests.get(f"{BASE_URL}/api/returns", headers=workshop_headers)
        assert r.status_code == 200
        ids = [x["return_id"] for x in r.json()]
        assert rid in ids

    def test_list_admin_sees_all(self, a_return, admin_headers):
        rid, _, _ = a_return
        r = requests.get(f"{BASE_URL}/api/admin/returns", headers=admin_headers)
        assert r.status_code == 200
        ids = [x["return_id"] for x in r.json()]
        assert rid in ids

    def test_status_filter(self, a_return, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/returns?status=requested",
                         headers=workshop_headers)
        assert r.status_code == 200
        for x in r.json():
            assert x["status"] == "requested"
        r2 = requests.get(f"{BASE_URL}/api/returns?status=approved",
                          headers=workshop_headers)
        rid = a_return[0]
        assert all(x["return_id"] != rid for x in r2.json())

    def test_get_return_403_for_other(self, a_return, mongo):
        rid, _, _ = a_return
        suffix = uuid.uuid4().hex[:8]
        uid = f"TEST_ws4_{suffix}"
        tok = f"TEST_tok_ws4_{suffix}"
        now = _iso(datetime.now(timezone.utc))
        mongo.users.insert_one({"user_id": uid, "email": f"y_{suffix}@t.com",
                                "name": "X", "role": "workshop", "created_at": now})
        mongo.workshops.insert_one({"workshop_id": f"TEST_ws4_id_{suffix}", "user_id": uid,
                                    "company_name": "Other", "kyc_status": "approved",
                                    "credit_limit": 0, "credit_used": 0, "created_at": now})
        mongo.user_sessions.insert_one({"user_id": uid, "session_token": tok,
                                        "expires_at": _iso(datetime.now(timezone.utc) + timedelta(days=7)),
                                        "created_at": now})
        try:
            r = requests.get(f"{BASE_URL}/api/returns/{rid}",
                             headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 403
        finally:
            mongo.users.delete_one({"user_id": uid})
            mongo.workshops.delete_one({"user_id": uid})
            mongo.user_sessions.delete_one({"session_token": tok})

    def test_get_return_unknown_404(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/returns/RMA-NOPE-000000", headers=workshop_headers)
        assert r.status_code == 404

    def test_admin_returns_requires_admin(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/admin/returns", headers=workshop_headers)
        assert r.status_code == 403

    def test_admin_returns_anon_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/returns")
        assert r.status_code == 401


# ============ Admin decide: approve restocks + credit refund ============
class TestAdminDecide:
    def test_approve_restocks_and_refunds_credit(self, delivered_order,
                                                 workshop_headers, admin_headers, mongo,
                                                 workshop_session):
        oid, pid = delivered_order
        # Set credit_used so we can verify decrement
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_used": 5000.0, "credit_limit": 100000.0}}
        )
        # Record initial stock
        initial_stock = mongo.products.find_one({"product_id": pid})["stock"]

        # Create return for qty=2 @500 => refund_total=1000
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid,
                                "items": [{"product_id": pid, "quantity": 2}]})
        assert r.status_code == 200
        rid = r.json()["return_id"]

        try:
            # Approve with credit-back
            r = requests.patch(f"{BASE_URL}/api/admin/returns/{rid}",
                               headers=admin_headers,
                               json={"decision": "approved",
                                     "refund_method": "credit-back",
                                     "admin_note": "OK"})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["status"] == "approved"
            assert body["refund_method"] == "credit-back"

            # Stock restocked +2
            new_stock = mongo.products.find_one({"product_id": pid})["stock"]
            assert new_stock == initial_stock + 2

            # Workshop credit_used decreased by 1000
            ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
            assert abs(ws["credit_used"] - 4000.0) < 0.01
        finally:
            mongo.returns.delete_one({"return_id": rid})
            mongo.workshops.update_one(
                {"workshop_id": workshop_session["workshop_id"]},
                {"$set": {"credit_used": 0.0, "credit_limit": 50000.0}}
            )

    def test_approve_non_credit_order_no_credit_change(self, mongo, workshop_session,
                                                      product, workshop_headers, admin_headers):
        # COD order
        oid = _make_order(mongo, workshop_session, product, payment_method="cod")
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_used": 999.0}}
        )
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid,
                                "items": [{"product_id": product, "quantity": 1}]})
        assert r.status_code == 200
        rid = r.json()["return_id"]
        try:
            r = requests.patch(f"{BASE_URL}/api/admin/returns/{rid}",
                               headers=admin_headers,
                               json={"decision": "approved", "refund_method": "credit-back"})
            assert r.status_code == 200
            ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
            # credit_used untouched since payment_method != credit
            assert abs(ws["credit_used"] - 999.0) < 0.01
        finally:
            mongo.orders.delete_one({"order_id": oid})
            mongo.returns.delete_one({"return_id": rid})
            mongo.workshops.update_one(
                {"workshop_id": workshop_session["workshop_id"]},
                {"$set": {"credit_used": 0.0}}
            )

    def test_reject_invalid_decision_value(self, delivered_order, workshop_headers, admin_headers, mongo):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "items": [{"product_id": pid, "quantity": 1}]})
        rid = r.json()["return_id"]
        try:
            r = requests.patch(f"{BASE_URL}/api/admin/returns/{rid}",
                               headers=admin_headers,
                               json={"decision": "garbage"})
            assert r.status_code == 400
        finally:
            mongo.returns.delete_one({"return_id": rid})

    def test_reject_invalid_refund_method(self, delivered_order, workshop_headers, admin_headers, mongo):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "items": [{"product_id": pid, "quantity": 1}]})
        rid = r.json()["return_id"]
        try:
            r = requests.patch(f"{BASE_URL}/api/admin/returns/{rid}",
                               headers=admin_headers,
                               json={"decision": "approved", "refund_method": "bitcoin"})
            assert r.status_code == 400
        finally:
            mongo.returns.delete_one({"return_id": rid})

    def test_cannot_decide_already_completed(self, delivered_order, workshop_headers,
                                             admin_headers, mongo):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "items": [{"product_id": pid, "quantity": 1}]})
        rid = r.json()["return_id"]
        try:
            # Move to completed directly
            r = requests.patch(f"{BASE_URL}/api/admin/returns/{rid}",
                               headers=admin_headers, json={"decision": "completed"})
            assert r.status_code == 200
            # Second decide -> 400
            r = requests.patch(f"{BASE_URL}/api/admin/returns/{rid}",
                               headers=admin_headers, json={"decision": "approved"})
            assert r.status_code == 400
        finally:
            mongo.returns.delete_one({"return_id": rid})

    def test_admin_patch_workshop_forbidden(self, delivered_order, workshop_headers, mongo):
        oid, pid = delivered_order
        r = requests.post(f"{BASE_URL}/api/returns", headers=workshop_headers,
                          json={"order_id": oid, "items": [{"product_id": pid, "quantity": 1}]})
        rid = r.json()["return_id"]
        try:
            r = requests.patch(f"{BASE_URL}/api/admin/returns/{rid}",
                               headers=workshop_headers,
                               json={"decision": "approved"})
            assert r.status_code == 403
        finally:
            mongo.returns.delete_one({"return_id": rid})


# ============ Notifications gated (no-op) ============
class TestNotificationsGated:
    def test_kyc_patch_does_not_block(self, workshop_pending_session, admin_headers, mongo):
        """KYC approval should succeed even though RESEND_API_KEY is empty (no-op)."""
        ws_id = workshop_pending_session["workshop_id"]
        r = requests.patch(f"{BASE_URL}/api/admin/workshops/{ws_id}/kyc",
                           headers=admin_headers,
                           json={"decision": "approved", "remark": "ok",
                                 "credit_limit": 10000})
        # Should succeed (200) quickly - notification is gated
        assert r.status_code == 200, r.text
        assert r.json().get("kyc_status") == "approved"
