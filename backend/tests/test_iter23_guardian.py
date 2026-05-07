"""Iter 23 — Guardian Bot public AI endpoint tests."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_guardian_message_basic(session):
    r = session.post(f"{API}/guardian/message",
                     json={"message": "What engine oil for Toyota Vitz 2014 in Dhaka monsoon?"},
                     timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_id" in data and data["session_id"].startswith("grd_"), data
    assert isinstance(data.get("reply"), str) and len(data["reply"].strip()) > 0
    # stash sid for later test
    pytest.guardian_sid = data["session_id"]
    pytest.guardian_first_reply = data["reply"]


def test_guardian_empty_message_400(session):
    r = session.post(f"{API}/guardian/message", json={"message": ""}, timeout=15)
    assert r.status_code == 400, r.text


def test_guardian_whitespace_message_400(session):
    r = session.post(f"{API}/guardian/message", json={"message": "   "}, timeout=15)
    assert r.status_code == 400, r.text


def test_guardian_message_too_long_400(session):
    r = session.post(f"{API}/guardian/message", json={"message": "a" * 1501}, timeout=15)
    assert r.status_code == 400, r.text


def test_guardian_history_returns_pair(session):
    sid = getattr(pytest, "guardian_sid", None)
    assert sid, "Need a session id from first test"
    # give DB write a beat
    time.sleep(1)
    r = session.get(f"{API}/guardian/history", params={"session_id": sid}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("session_id") == sid
    msgs = data.get("messages", [])
    assert len(msgs) >= 2, f"Expected ≥2 messages, got {len(msgs)}"
    # User message first, assistant second
    roles = [m.get("role") for m in msgs[:2]]
    assert "user" in roles and "assistant" in roles
    # Sorted by created_at ascending
    times = [m.get("created_at") for m in msgs]
    assert times == sorted(times)


def test_guardian_history_no_session_400(session):
    r = session.get(f"{API}/guardian/history", params={"session_id": "  "}, timeout=10)
    assert r.status_code == 400


def test_guardian_rate_limit_429(session):
    """Send 9 rapid messages w/ same session_id; 9th should 429."""
    sid = f"grd_ratetest_{int(time.time())}"
    statuses = []
    for i in range(9):
        r = session.post(f"{API}/guardian/message",
                         json={"session_id": sid, "message": f"hi {i}"},
                         timeout=60)
        statuses.append(r.status_code)
        if r.status_code == 429:
            break
    assert 429 in statuses, f"Expected at least one 429 in first 9 calls. Got {statuses}"


def test_guardian_reply_quality(session):
    """Soft check that engine-oil reply mentions oil/viscosity terms."""
    reply = getattr(pytest, "guardian_first_reply", "") or ""
    low = reply.lower()
    # Should mention something automotive/oil-related
    keywords = ["oil", "5w", "10w", "viscosity", "api", "engine", "monsoon", "vitz"]
    hits = sum(1 for k in keywords if k in low)
    assert hits >= 2, f"Reply seems off-topic: {reply[:200]}"
