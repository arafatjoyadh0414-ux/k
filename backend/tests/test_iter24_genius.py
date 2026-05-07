"""Iter 24 — Unified JOY Genius Assistant: auth-aware Claude Sonnet 4.5 chatbot.

Tests:
  1. POST /api/guardian/message (no auth) → 200, authenticated=false, car-knowledge reply.
  2. POST /api/guardian/message (Bearer test-token-workshop-1, credit/orders q) →
     200, authenticated=true, reply uses real workshop data (credit + order #).
  3. POST /api/guardian/message (auth, 'Show me brake pads') → SKUs / tier prices.
  4. GET /api/guardian/history?session_id=... → returns persisted messages.
  5. Rate limit: 13th rapid call returns 429 (window = 12/min).
"""

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
WS_TOKEN = "test-token-workshop-1"
CLAUDE_TIMEOUT = 60  # Claude replies can take ~10-25s


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- 1. PUBLIC (unauthenticated) ----------
def test_guardian_public_unauthenticated_reply(api):
    sid = f"iter24_pub_{uuid.uuid4().hex[:8]}"
    r = api.post(
        f"{BASE_URL}/api/guardian/message",
        json={"session_id": sid, "message": "AC warm on Toyota Vitz — where do I start?"},
        timeout=CLAUDE_TIMEOUT,
    )
    assert r.status_code == 200, f"Unexpected status: {r.status_code} / {r.text}"
    data = r.json()
    assert data.get("authenticated") is False, f"Expected authenticated=false, got {data.get('authenticated')}"
    reply = data.get("reply", "")
    assert isinstance(reply, str) and len(reply) > 40, f"Reply too short: {reply}"
    # No hallucinated order/credit chatter in public mode
    low = reply.lower()
    assert "bdt 0 out of bdt 0" not in low
    assert "credit_used" not in low
    # Topical keywords for AC diagnostic
    assert any(k in low for k in ["ac", "refrigerant", "compressor", "condenser", "gas", "cabin"]), \
        f"Reply not on topic: {reply[:300]}"


# ---------- 2. AUTHENTICATED (portal context) ----------
def test_guardian_authenticated_credit_and_orders(api):
    sid = f"iter24_auth_{uuid.uuid4().hex[:8]}"
    # Pull workshop orders first to validate no hallucination
    orders_r = api.get(
        f"{BASE_URL}/api/orders",
        headers={"Authorization": f"Bearer {WS_TOKEN}"},
        timeout=15,
    )
    assert orders_r.status_code == 200, f"/api/orders failed: {orders_r.status_code}"
    orders_list = orders_r.json() if isinstance(orders_r.json(), list) else orders_r.json().get("orders", [])
    order_numbers = {(o.get("order_number") or (o.get("order_id", "")[:8])) for o in orders_list if o}

    # Ask Genius
    r = api.post(
        f"{BASE_URL}/api/guardian/message",
        headers={"Authorization": f"Bearer {WS_TOKEN}"},
        json={
            "session_id": sid,
            "message": "How much credit do I have left and what is my last order?",
        },
        timeout=CLAUDE_TIMEOUT,
    )
    assert r.status_code == 200, f"Auth call failed: {r.status_code} / {r.text[:400]}"
    data = r.json()
    assert data.get("authenticated") is True, f"Expected authenticated=true, got {data}"
    reply = data.get("reply", "")
    assert reply, "Empty reply"
    low = reply.lower()

    # Must mention credit (BDT / limit / available) and orders
    assert "bdt" in low or "৳" in reply, f"Reply missing BDT figure: {reply[:400]}"
    assert any(k in low for k in ["credit", "limit", "available"]), f"No credit vocab: {reply[:400]}"

    # If genius cites an ORD- number, it must exist in the user's real orders
    import re
    cited = re.findall(r"ORD-[A-Z0-9\-]+", reply, flags=re.I)
    if cited and order_numbers:
        for c in cited:
            # allow small formatting diff; test membership of the cited token against our set
            c_norm = c.strip(".,)")
            assert any(c_norm == o or c_norm in (o or "") for o in order_numbers), \
                f"Genius hallucinated order {c_norm} (not in real orders {order_numbers})"


# ---------- 3. AUTHENTICATED catalogue snapshot (brake pads) ----------
def test_guardian_authenticated_catalogue_brake_pads(api):
    sid = f"iter24_cat_{uuid.uuid4().hex[:8]}"
    # Snapshot real catalogue to validate tier prices / SKUs
    p_r = api.get(f"{BASE_URL}/api/products?category=brake", timeout=15)
    assert p_r.status_code == 200
    # API shape is a list or {products: [...]}
    catalogue = p_r.json() if isinstance(p_r.json(), list) else p_r.json().get("products", [])
    skus = {p.get("sku") for p in catalogue if p.get("sku")}

    r = api.post(
        f"{BASE_URL}/api/guardian/message",
        headers={"Authorization": f"Bearer {WS_TOKEN}"},
        json={"session_id": sid, "message": "Show me brake pads in stock"},
        timeout=CLAUDE_TIMEOUT,
    )
    assert r.status_code == 200, f"{r.status_code} / {r.text[:400]}"
    data = r.json()
    assert data.get("authenticated") is True
    reply = data.get("reply", "")
    low = reply.lower()
    # Topical — must mention brake pad context
    assert "brake" in low or "pad" in low, f"Off-topic reply: {reply[:400]}"
    # Should reference BDT (tier prices)
    # (Soft assertion — only enforce if catalogue had brake SKUs)
    if skus:
        # at least one real SKU string appears OR reply says to check catalogue
        any_sku_mentioned = any(sku and sku in reply for sku in skus)
        mentions_catalogue = "catalogue" in low or "catalog" in low
        assert any_sku_mentioned or mentions_catalogue or "bdt" in low, \
            f"Auth reply has no SKU / BDT / catalogue hint: {reply[:400]}"


# ---------- 4. HISTORY ENDPOINT ----------
def test_guardian_history_persists(api):
    sid = f"iter24_hist_{uuid.uuid4().hex[:8]}"
    post = api.post(
        f"{BASE_URL}/api/guardian/message",
        json={"session_id": sid, "message": "What oil for Honda Vezel monsoon?"},
        timeout=CLAUDE_TIMEOUT,
    )
    assert post.status_code == 200
    time.sleep(1)
    h = api.get(f"{BASE_URL}/api/guardian/history", params={"session_id": sid}, timeout=15)
    assert h.status_code == 200
    msgs = h.json().get("messages", [])
    assert len(msgs) >= 2, f"Expected >=2 persisted msgs, got {len(msgs)}"
    roles = [m.get("role") for m in msgs]
    assert "user" in roles and "assistant" in roles


# ---------- 5. RATE LIMIT (12/min) ----------
def test_guardian_rate_limit_12_per_min(api):
    sid = f"iter24_rate_{uuid.uuid4().hex[:8]}"
    hit_429 = False
    statuses = []
    for i in range(14):
        r = api.post(
            f"{BASE_URL}/api/guardian/message",
            json={"session_id": sid, "message": f"ping {i}"},
            timeout=CLAUDE_TIMEOUT,
        )
        statuses.append(r.status_code)
        if r.status_code == 429:
            hit_429 = True
            # Must happen AFTER 12 successful (so index >= 12 means 13th or later)
            assert i >= 12, f"Rate limit tripped too early at call #{i+1}; limit should be 12. Statuses={statuses}"
            break
    assert hit_429, f"Expected 429 within 14 calls but never hit. Statuses={statuses}"
