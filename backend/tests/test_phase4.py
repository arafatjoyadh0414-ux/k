"""Phase 4 backend tests: Service Packs + Delivery Persons + Order delivery assignment."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")

EXPECTED_PACK_SKUS = {
    "JA-PACK-BASIC", "JA-PACK-PREMIUM", "JA-PACK-BRAKE", "JA-PACK-SUSP", "JA-PACK-LIGHT"
}


# ---------- Service Packs ----------
class TestServicePacks:
    def test_list_anon_returns_5_packs_retail(self):
        r = requests.get(f"{BASE_URL}/api/service-packs", timeout=20)
        assert r.status_code == 200, r.text
        packs = r.json()
        assert isinstance(packs, list)
        skus = {p["sku"] for p in packs}
        assert EXPECTED_PACK_SKUS.issubset(skus), f"Missing packs. Got {skus}"
        # Anonymous => retail tier
        for p in packs:
            if p["sku"] in EXPECTED_PACK_SKUS:
                assert "retail_price_bdt" in p
                assert "your_price_bdt" in p
                assert "your_tier" in p
                assert p["your_tier"] == "retail"
                assert abs(p["your_price_bdt"] - p["retail_price_bdt"]) < 0.01
                assert "bundle_items_resolved" in p
                assert isinstance(p["bundle_items_resolved"], list)
                assert len(p["bundle_items_resolved"]) > 0
                for child in p["bundle_items_resolved"]:
                    assert "name" in child
                    assert "sku" in child
                    assert "quantity" in child

    def test_list_workshop_silver_default_tier(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/service-packs", headers=workshop_headers, timeout=20)
        assert r.status_code == 200
        packs = r.json()
        for p in packs:
            if p["sku"] in EXPECTED_PACK_SKUS:
                # Default tier from conftest is silver (5% off)
                assert p["your_tier"] == "silver"
                expected = round(p["retail_price_bdt"] * 0.95, 2)
                assert abs(p["your_price_bdt"] - expected) < 0.01

    def test_list_workshop_gold_tier(self, mongo, workshop_session):
        # Promote workshop to gold tier
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"pricing_tier": "gold"}}
        )
        try:
            headers = {"Authorization": f"Bearer {workshop_session['token']}"}
            r = requests.get(f"{BASE_URL}/api/service-packs", headers=headers, timeout=20)
            assert r.status_code == 200
            packs = r.json()
            assert len(packs) >= 5
            for p in packs:
                if p["sku"] in EXPECTED_PACK_SKUS:
                    assert p["your_tier"] == "gold"
                    expected = round(p["retail_price_bdt"] * 0.90, 2)
                    assert abs(p["your_price_bdt"] - expected) < 0.01, \
                        f"{p['sku']}: retail={p['retail_price_bdt']} got {p['your_price_bdt']} expected {expected}"
        finally:
            mongo.workshops.update_one(
                {"workshop_id": workshop_session["workshop_id"]},
                {"$set": {"pricing_tier": "silver"}}
            )


# ---------- Delivery Persons CRUD ----------
class TestDeliveryPersonsCRUD:
    def test_create_requires_admin_workshop_403(self, workshop_headers):
        r = requests.post(f"{BASE_URL}/api/admin/delivery-persons",
                          headers=workshop_headers,
                          json={"name": "Rider1", "phone": "+8801711"})
        assert r.status_code == 403

    def test_create_anon_401(self):
        r = requests.post(f"{BASE_URL}/api/admin/delivery-persons",
                          json={"name": "Rider1", "phone": "+8801711"})
        assert r.status_code == 401

    def test_list_anon_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/delivery-persons")
        assert r.status_code == 401

    def test_list_workshop_403(self, workshop_headers):
        r = requests.get(f"{BASE_URL}/api/admin/delivery-persons", headers=workshop_headers)
        assert r.status_code == 403

    def test_create_rejects_empty_name(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/delivery-persons",
                          headers=admin_headers,
                          json={"name": "   ", "phone": "+8801711"})
        assert r.status_code == 400

    def test_create_rejects_empty_phone(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/delivery-persons",
                          headers=admin_headers,
                          json={"name": "Rider", "phone": ""})
        assert r.status_code == 400

    def test_create_then_list_then_update_then_delete(self, admin_headers, mongo):
        # CREATE
        payload = {
            "name": "TEST_Rider_Karim", "phone": "+8801711000001",
            "vehicle_type": "bike", "vehicle_no": "DH-1234",
            "coverage_areas": ["Dhaka", "Gazipur"], "status": "active", "notes": "TEST"
        }
        r = requests.post(f"{BASE_URL}/api/admin/delivery-persons",
                          headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == "TEST_Rider_Karim"
        assert created["phone"] == "+8801711000001"
        assert "delivery_person_id" in created
        did = created["delivery_person_id"]

        try:
            # LIST returns it with active_assignments=0
            r = requests.get(f"{BASE_URL}/api/admin/delivery-persons", headers=admin_headers)
            assert r.status_code == 200
            riders = r.json()
            mine = [x for x in riders if x["delivery_person_id"] == did]
            assert len(mine) == 1
            assert mine[0]["active_assignments"] == 0

            # UPDATE
            updated = {**payload, "name": "TEST_Rider_Karim2", "vehicle_no": "DH-9999"}
            r = requests.put(f"{BASE_URL}/api/admin/delivery-persons/{did}",
                             headers=admin_headers, json=updated)
            assert r.status_code == 200
            doc = r.json()
            assert doc["name"] == "TEST_Rider_Karim2"
            assert doc["vehicle_no"] == "DH-9999"

            # DELETE (no active assignments) -> 200
            r = requests.delete(f"{BASE_URL}/api/admin/delivery-persons/{did}",
                                headers=admin_headers)
            assert r.status_code == 200
            assert r.json().get("ok") is True
            # Verify gone
            r = requests.get(f"{BASE_URL}/api/admin/delivery-persons", headers=admin_headers)
            ids = [x["delivery_person_id"] for x in r.json()]
            assert did not in ids
        finally:
            mongo.delivery_persons.delete_one({"delivery_person_id": did})

    def test_delete_blocked_with_active_assignment(self, admin_headers, mongo, workshop_session):
        # Create rider
        r = requests.post(f"{BASE_URL}/api/admin/delivery-persons",
                          headers=admin_headers,
                          json={"name": "TEST_RiderActive", "phone": "+8801711000002"})
        assert r.status_code == 200
        did = r.json()["delivery_person_id"]
        # Insert a fake order in 'packed' status with this rider
        order_id = f"TEST_ORD_{uuid.uuid4().hex[:8]}"
        mongo.orders.insert_one({
            "order_id": order_id,
            "user_id": workshop_session["user_id"],
            "workshop_id": workshop_session["workshop_id"],
            "status": "packed",
            "delivery_person_id": did,
            "total_bdt": 1000.0,
            "subtotal_bdt": 1000.0,
            "discount_pct": 0,
            "discount_amount_bdt": 0,
            "cost_total_bdt": 700.0,
            "profit_bdt": 300.0,
            "delivery_fee_bdt": 0.0,
            "payment_method": "cod",
            "payment_status": "unpaid",
            "items": [],
            "status_history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            # LIST: active_assignments==1
            r = requests.get(f"{BASE_URL}/api/admin/delivery-persons", headers=admin_headers)
            mine = [x for x in r.json() if x["delivery_person_id"] == did][0]
            assert mine["active_assignments"] == 1

            # DELETE blocked
            r = requests.delete(f"{BASE_URL}/api/admin/delivery-persons/{did}",
                                headers=admin_headers)
            assert r.status_code == 400
            # Move order to delivered to release rider
            mongo.orders.update_one({"order_id": order_id}, {"$set": {"status": "delivered"}})
            r = requests.delete(f"{BASE_URL}/api/admin/delivery-persons/{did}",
                                headers=admin_headers)
            assert r.status_code == 200
        finally:
            mongo.orders.delete_one({"order_id": order_id})
            mongo.delivery_persons.delete_one({"delivery_person_id": did})


# ---------- Order delivery assignment + fee ----------
class TestOrderDeliveryAssignment:
    @pytest.fixture
    def fresh_rider(self, admin_headers, mongo):
        r = requests.post(f"{BASE_URL}/api/admin/delivery-persons",
                          headers=admin_headers,
                          json={"name": "TEST_FeeRider", "phone": "+8801712000111",
                                "vehicle_no": "DH-1111"})
        assert r.status_code == 200
        did = r.json()["delivery_person_id"]
        yield did
        mongo.delivery_persons.delete_one({"delivery_person_id": did})

    @pytest.fixture
    def credit_order(self, mongo, workshop_session):
        # Reset credit_used
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_used": 5000.0, "credit_limit": 100000.0}}
        )
        order_id = f"TEST_ORD_{uuid.uuid4().hex[:8]}"
        mongo.orders.insert_one({
            "order_id": order_id,
            "user_id": workshop_session["user_id"],
            "workshop_id": workshop_session["workshop_id"],
            "status": "placed",
            "subtotal_bdt": 5000.0,
            "discount_pct": 0,
            "discount_amount_bdt": 0,
            "total_bdt": 5000.0,
            "cost_total_bdt": 3000.0,
            "profit_bdt": 2000.0,
            "delivery_fee_bdt": 0.0,
            "payment_method": "credit",
            "payment_status": "unpaid",
            "items": [],
            "status_history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        yield order_id
        mongo.orders.delete_one({"order_id": order_id})
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_used": 0.0, "credit_limit": 50000.0}}
        )

    def test_assign_requires_admin(self, workshop_headers, credit_order):
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{credit_order}/delivery",
                           headers=workshop_headers,
                           json={"delivery_fee_bdt": 100})
        assert r.status_code == 403

    def test_assign_anon_401(self, credit_order):
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{credit_order}/delivery",
                           json={"delivery_fee_bdt": 100})
        assert r.status_code == 401

    def test_assign_unknown_order_404(self, admin_headers):
        r = requests.patch(f"{BASE_URL}/api/admin/orders/NONEXIST/delivery",
                           headers=admin_headers,
                           json={"delivery_fee_bdt": 100})
        assert r.status_code == 404

    def test_assign_invalid_rider_400(self, admin_headers, credit_order):
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{credit_order}/delivery",
                           headers=admin_headers,
                           json={"delivery_person_id": "dp_doesnotexist"})
        assert r.status_code == 400

    def test_assign_rider_copies_info_and_history(self, admin_headers, credit_order, fresh_rider, mongo):
        expected_date = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{credit_order}/delivery",
                           headers=admin_headers,
                           json={"delivery_person_id": fresh_rider,
                                 "expected_delivery_date": expected_date})
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["delivery_person_id"] == fresh_rider
        assert order["delivery_person_name"] == "TEST_FeeRider"
        assert order["delivery_person_phone"] == "+8801712000111"
        assert order["delivery_vehicle_no"] == "DH-1111"
        assert order["expected_delivery_date"] == expected_date
        # status_history appended
        assert len(order.get("status_history", [])) >= 1
        last = order["status_history"][-1]
        assert "TEST_FeeRider" in last["note"]

    def test_fee_updates_total_profit_and_credit(self, admin_headers, credit_order, mongo, workshop_session):
        # initial: total=5000, credit_used=5000 (set by fixture)
        # Assign fee=300
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{credit_order}/delivery",
                           headers=admin_headers,
                           json={"delivery_fee_bdt": 300})
        assert r.status_code == 200
        order = r.json()
        assert abs(order["total_bdt"] - 5300.0) < 0.01
        assert abs(order["delivery_fee_bdt"] - 300.0) < 0.01
        assert abs(order["profit_bdt"] - (5300.0 - 3000.0)) < 0.01
        ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
        assert abs(ws["credit_used"] - 5300.0) < 0.01

        # Re-assign higher fee=500 (delta=+200)
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{credit_order}/delivery",
                           headers=admin_headers,
                           json={"delivery_fee_bdt": 500})
        assert r.status_code == 200
        order = r.json()
        assert abs(order["total_bdt"] - 5500.0) < 0.01
        assert abs(order["delivery_fee_bdt"] - 500.0) < 0.01
        ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
        assert abs(ws["credit_used"] - 5500.0) < 0.01

        # Lower fee=100 (delta=-400)
        r = requests.patch(f"{BASE_URL}/api/admin/orders/{credit_order}/delivery",
                           headers=admin_headers,
                           json={"delivery_fee_bdt": 100})
        assert r.status_code == 200
        order = r.json()
        assert abs(order["total_bdt"] - 5100.0) < 0.01
        ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
        assert abs(ws["credit_used"] - 5100.0) < 0.01

    def test_fee_no_credit_adjust_on_paid_order(self, admin_headers, mongo, workshop_session):
        # Build an order paid by 'cod' (not credit). credit_used should NOT change.
        order_id = f"TEST_ORD_{uuid.uuid4().hex[:8]}"
        mongo.workshops.update_one(
            {"workshop_id": workshop_session["workshop_id"]},
            {"$set": {"credit_used": 1234.0}}
        )
        mongo.orders.insert_one({
            "order_id": order_id,
            "user_id": workshop_session["user_id"],
            "workshop_id": workshop_session["workshop_id"],
            "status": "placed",
            "subtotal_bdt": 2000.0, "total_bdt": 2000.0, "cost_total_bdt": 1000.0,
            "profit_bdt": 1000.0, "delivery_fee_bdt": 0.0,
            "payment_method": "cod", "payment_status": "unpaid",
            "items": [], "status_history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = requests.patch(f"{BASE_URL}/api/admin/orders/{order_id}/delivery",
                               headers=admin_headers, json={"delivery_fee_bdt": 250})
            assert r.status_code == 200
            assert abs(r.json()["total_bdt"] - 2250.0) < 0.01
            ws = mongo.workshops.find_one({"workshop_id": workshop_session["workshop_id"]})
            assert abs(ws["credit_used"] - 1234.0) < 0.01  # unchanged
        finally:
            mongo.orders.delete_one({"order_id": order_id})
            mongo.workshops.update_one(
                {"workshop_id": workshop_session["workshop_id"]},
                {"$set": {"credit_used": 0.0}}
            )
