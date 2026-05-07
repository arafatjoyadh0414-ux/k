"""Iter 26 — Mr Genius commerce actions (add_to_cart / view_order)
Tests:
- Public unauth message → actions=[]
- Auth message asking for products → actions enriched, [ACTIONS] stripped
- Auth message asking for last order → view_order action (if user has orders)
- /guardian/history rehydrates assistant 'actions'
- Action cap at 3
- Malformed JSON in [ACTIONS] tail → tolerant
"""

import os
import re
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
AUTH_HEADERS = {"Authorization": "Bearer test-token-workshop-1", "Content-Type": "application/json"}
PUB_HEADERS = {"Content-Type": "application/json"}


def _wait_msg(payload, headers, timeout=60):
    r = requests.post(f"{BASE_URL}/api/guardian/message", json=payload, headers=headers, timeout=timeout)
    return r


# --- 1. unauth user gets no actions
def test_unauth_no_actions():
    sid = f"itest_unauth_{uuid.uuid4().hex[:8]}"
    r = _wait_msg({"session_id": sid, "message": "What are 2 popular brake pads I should add to my cart?"}, PUB_HEADERS)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("authenticated") in (False, None)
    assert data.get("actions", []) == [], f"Expected empty actions for public, got {data.get('actions')}"
    assert "[ACTIONS]" not in data.get("reply", "")
    assert "[/ACTIONS]" not in data.get("reply", "")


# --- 2. auth user — explicit "add to cart" prompt → at least one add_to_cart action enriched & SKU exists
def test_auth_add_to_cart_actions_enriched():
    sid = f"itest_auth_a2c_{uuid.uuid4().hex[:8]}"
    # fetch live catalogue once for SKU cross-check
    plist = requests.get(f"{BASE_URL}/api/products", timeout=30)
    assert plist.status_code == 200
    raw = plist.json()
    products = raw.get("products", raw) if isinstance(raw, dict) else raw
    catalogue_skus = {p.get("sku") for p in products if p.get("sku")}

    # Genius is non-deterministic — retry up to 3 times
    actions = []
    last_data = None
    for _ in range(3):
        r = _wait_msg(
            {"session_id": sid, "message": "Recommend exactly 2 popular brake pads I should add to my cart right now. Use the action buttons."},
            AUTH_HEADERS,
            timeout=90,
        )
        assert r.status_code == 200, r.text
        last_data = r.json()
        assert last_data.get("authenticated") is True
        actions = last_data.get("actions", [])
        if actions:
            break
        time.sleep(1)
        sid = f"itest_auth_a2c_{uuid.uuid4().hex[:8]}"

    reply = last_data.get("reply", "")
    assert "[ACTIONS]" not in reply, "ACTIONS tag leaked into visible reply"
    assert "[/ACTIONS]" not in reply

    if not actions:
        pytest.skip("Genius did not emit actions in 3 attempts (non-deterministic). Reply ok, tag stripped.")

    assert len(actions) <= 3, f"Action cap exceeded: {len(actions)}"
    a2c = [a for a in actions if a.get("type") == "add_to_cart"]
    assert a2c, f"Expected at least one add_to_cart in {actions}"
    for a in a2c:
        assert a.get("sku"), f"add_to_cart missing sku: {a}"
        assert a.get("product_id"), f"add_to_cart missing product_id: {a}"
        assert a.get("name"), f"add_to_cart missing name: {a}"
        assert isinstance(a.get("price_bdt"), (int, float)) and a["price_bdt"] >= 0
        assert a["sku"] in catalogue_skus, f"SKU {a['sku']} not in catalogue"


# --- 3. auth user — view_order action (only if user has orders)
def test_auth_view_order_action():
    # cross-check user orders
    orders_r = requests.get(f"{BASE_URL}/api/orders", headers=AUTH_HEADERS, timeout=30)
    assert orders_r.status_code == 200, orders_r.text
    orders_raw = orders_r.json()
    orders = orders_raw.get("orders", orders_raw) if isinstance(orders_raw, dict) else orders_raw
    if not orders:
        pytest.skip("Test user has no orders — view_order test not applicable.")
    valid_ids = {o.get("order_id") for o in orders if o.get("order_id")}

    sid = f"itest_view_{uuid.uuid4().hex[:8]}"
    found_view = None
    for _ in range(3):
        r = _wait_msg(
            {"session_id": sid, "message": "Where is my last order? Show it to me with the View Order action button."},
            AUTH_HEADERS,
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for a in data.get("actions", []):
            if a.get("type") == "view_order":
                found_view = a
                break
        if found_view:
            break
        sid = f"itest_view_{uuid.uuid4().hex[:8]}"

    if not found_view:
        pytest.skip("Genius did not emit view_order action across retries (non-deterministic).")
    assert found_view.get("order_id") in valid_ids, f"view_order id {found_view.get('order_id')} not in user orders"


# --- 4. /guardian/history returns actions field
def test_history_includes_actions_field():
    sid = f"itest_hist_{uuid.uuid4().hex[:8]}"
    r = _wait_msg({"session_id": sid, "message": "Recommend a brake pad to add to my cart."}, AUTH_HEADERS, timeout=90)
    assert r.status_code == 200
    time.sleep(0.5)
    h = requests.get(f"{BASE_URL}/api/guardian/history", params={"session_id": sid}, timeout=30)
    assert h.status_code == 200, h.text
    msgs = h.json().get("messages", [])
    asst = [m for m in msgs if m.get("role") == "assistant"]
    assert asst, "No assistant message persisted"
    # 'actions' key must be present on every assistant msg (even if [])
    for m in asst:
        assert "actions" in m, f"Assistant message missing 'actions' key: {m}"
        assert isinstance(m["actions"], list)
        for a in m["actions"]:
            if a.get("type") == "add_to_cart":
                assert a.get("sku") and a.get("name")


# --- 5. malformed actions tolerance — direct unit-test on extractor
def test_extract_actions_malformed_tolerant():
    """Regression for parser robustness — call internal extractor directly."""
    import sys
    sys.path.insert(0, "/app/backend")
    from routes.guardian import _extract_actions  # type: ignore

    products = [{"sku": "JA-X", "product_id": "p1", "name": "X", "your_price_bdt": 100, "stock": 5, "category": "c", "image_url": ""}]
    orders = [{"order_id": "o1"}]

    # Malformed JSON inside valid brackets (typical Genius slip-up)
    bad = 'Some reply.\n\n[ACTIONS]\n[{"type": broken, sku:}]\n[/ACTIONS]'
    a, cleaned = _extract_actions(bad, products, orders)
    assert a == []
    assert "[ACTIONS]" not in cleaned

    # 5 actions → cap at 3
    five = """Reply text.

[ACTIONS]
[
 {"type":"add_to_cart","sku":"JA-X","qty":1},
 {"type":"add_to_cart","sku":"JA-X","qty":2},
 {"type":"add_to_cart","sku":"JA-X","qty":3},
 {"type":"add_to_cart","sku":"JA-X","qty":4},
 {"type":"add_to_cart","sku":"JA-X","qty":5}
]
[/ACTIONS]"""
    a, cleaned = _extract_actions(five, products, orders)
    assert len(a) == 3, f"Expected cap at 3, got {len(a)}"
    assert "[ACTIONS]" not in cleaned
    assert all(x["type"] == "add_to_cart" for x in a)

    # Unknown SKU dropped
    unknown = """Reply.

[ACTIONS]
[{"type":"add_to_cart","sku":"JA-DOES-NOT-EXIST","qty":1}]
[/ACTIONS]"""
    a, _ = _extract_actions(unknown, products, orders)
    assert a == []

    # Invalid order_id dropped
    badord = """Reply.

[ACTIONS]
[{"type":"view_order","order_id":"nope"}]
[/ACTIONS]"""
    a, _ = _extract_actions(badord, products, orders)
    assert a == []

    # Valid mixed
    good = """Reply.

[ACTIONS]
[{"type":"add_to_cart","sku":"JA-X","qty":2},{"type":"view_order","order_id":"o1"}]
[/ACTIONS]"""
    a, cleaned = _extract_actions(good, products, orders)
    assert len(a) == 2
    assert a[0]["type"] == "add_to_cart" and a[0]["product_id"] == "p1" and a[0]["qty"] == 2
    assert a[1]["type"] == "view_order" and a[1]["order_id"] == "o1"
    assert "[ACTIONS]" not in cleaned
