"""Iter 8 backend tests:
- Public stats + admin ticker broadcast (cache bust + auth gate)
- VIN Health Passport (generate / view / pdf, idempotent)
- /auth/me joy_id backfill + sequential counter
- joy_id collision-free atomic counter
"""
import os
import re
import time
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://workshop-dashboard-1.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_TOKEN = "admin-test-token-rosie-broadcast"
WORKSHOP_TOKEN = "test-token-workshop-1"


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ─── Public stats ─────────────────────────────────────────────────────────
class TestPublicStats:
    def test_returns_200_and_required_fields(self):
        r = requests.get(f"{BASE_URL}/api/public/stats", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        for f in (
            "orders_today",
            "credit_used_bdt",
            "workshops_count",
            "active_now",
            "last_order_at",
            "featured_message",
            "generated_at",
        ):
            assert f in d, f"missing field {f}"
        assert isinstance(d["orders_today"], int)
        assert isinstance(d["credit_used_bdt"], int)
        assert isinstance(d["workshops_count"], int)
        assert isinstance(d["active_now"], int)
        # Floor enforced
        assert d["orders_today"] >= 47
        assert d["credit_used_bdt"] >= 18_200_000
        assert d["workshops_count"] >= 312
        assert d["active_now"] >= 8


# ─── Admin ticker broadcast ───────────────────────────────────────────────
class TestAdminTicker:
    def test_get_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/ticker", timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_get_forbids_workshop(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/ticker", headers=_hdr(WORKSHOP_TOKEN), timeout=10,
        )
        assert r.status_code == 403, r.text

    def test_post_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/ticker", json={"text": "x", "active": True}, timeout=10,
        )
        assert r.status_code in (401, 403)

    def test_post_forbids_workshop(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/ticker",
            json={"text": "blocked", "active": True},
            headers=_hdr(WORKSHOP_TOKEN),
            timeout=10,
        )
        assert r.status_code == 403

    def test_admin_can_get_ticker(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/ticker", headers=_hdr(ADMIN_TOKEN), timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "message" in d

    def test_set_clear_and_cache_bust(self, db):
        marker = f"TEST_TICKER_{uuid.uuid4().hex[:8]}"
        # 1) Warm the public stats cache
        r0 = requests.get(f"{BASE_URL}/api/public/stats", timeout=10)
        assert r0.status_code == 200

        # 2) Set ticker via admin
        r1 = requests.post(
            f"{BASE_URL}/api/admin/ticker",
            json={"text": marker, "active": True},
            headers=_hdr(ADMIN_TOKEN),
            timeout=10,
        )
        assert r1.status_code == 200, r1.text
        body = r1.json()
        assert body.get("ok") is True
        assert body.get("message", {}).get("text") == marker
        assert body.get("message", {}).get("active") is True

        # 3) public/stats must reflect immediately (cache busted)
        r2 = requests.get(f"{BASE_URL}/api/public/stats", timeout=10)
        assert r2.status_code == 200
        assert r2.json().get("featured_message") == marker

        # 4) Admin GET shows latest
        r3 = requests.get(
            f"{BASE_URL}/api/admin/ticker", headers=_hdr(ADMIN_TOKEN), timeout=10,
        )
        assert r3.status_code == 200
        assert r3.json()["message"]["text"] == marker

        # 5) Set a second different one — old must be deactivated
        marker2 = f"TEST_TICKER2_{uuid.uuid4().hex[:8]}"
        r4 = requests.post(
            f"{BASE_URL}/api/admin/ticker",
            json={"text": marker2, "active": True},
            headers=_hdr(ADMIN_TOKEN),
            timeout=10,
        )
        assert r4.status_code == 200
        # The earlier one is deactivated in mongo
        old = db.ticker_messages.find_one({"text": marker})
        assert old is not None
        assert old.get("active") is False
        # Featured updates
        r5 = requests.get(f"{BASE_URL}/api/public/stats", timeout=10)
        assert r5.json().get("featured_message") == marker2

        # 6) Clear with empty text
        r6 = requests.post(
            f"{BASE_URL}/api/admin/ticker",
            json={"text": "", "active": False},
            headers=_hdr(ADMIN_TOKEN),
            timeout=10,
        )
        assert r6.status_code == 200
        assert r6.json().get("message") is None
        # public/stats now returns null
        r7 = requests.get(f"{BASE_URL}/api/public/stats", timeout=10)
        assert r7.json().get("featured_message") is None

        # cleanup our test markers
        db.ticker_messages.delete_many({"text": {"$in": [marker, marker2]}})


# ─── /auth/me joy_id backfill ─────────────────────────────────────────────
class TestAuthMeJoyId:
    def test_admin_me_has_joy_id(self):
        r = requests.get(
            f"{BASE_URL}/api/auth/me", headers=_hdr(ADMIN_TOKEN), timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "joy_id" in d
        assert re.match(r"^JOY-\d{4,}$", d["joy_id"]), d["joy_id"]

    def test_workshop_me_has_joy_id(self):
        r = requests.get(
            f"{BASE_URL}/api/auth/me", headers=_hdr(WORKSHOP_TOKEN), timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert re.match(r"^JOY-\d{4,}$", d.get("joy_id", "")), d

    def test_backfill_idempotent_and_counter_atomic(self, db):
        """Strip joy_id from a freshly-seeded user, hit /auth/me twice → same id, +2 to counter."""
        suffix = uuid.uuid4().hex[:8]
        user_id = f"TEST_jid_{suffix}"
        token = f"TEST_jidtok_{suffix}"
        now = datetime.now(timezone.utc).isoformat()
        db.users.insert_one({
            "user_id": user_id,
            "email": f"TEST_jid_{suffix}@x.com",
            "name": "JoyID Backfill",
            "role": "workshop",
            "created_at": now,
        })
        db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "created_at": now,
        })
        try:
            counter_before = db.counters.find_one({"_id": "joy_id_counter"}) or {"seq": 1000}
            seq_before = int(counter_before.get("seq", 1000))

            r1 = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(token), timeout=10)
            assert r1.status_code == 200
            jid1 = r1.json().get("joy_id")
            assert re.match(r"^JOY-\d{4,}$", jid1 or "")

            # Counter incremented exactly once
            counter_after = db.counters.find_one({"_id": "joy_id_counter"})
            assert int(counter_after["seq"]) == seq_before + 1

            # Hit again — same joy_id, no further increment
            r2 = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(token), timeout=10)
            assert r2.json().get("joy_id") == jid1
            counter_after2 = db.counters.find_one({"_id": "joy_id_counter"})
            assert int(counter_after2["seq"]) == seq_before + 1

            # Sequence value matches assigned id
            n = int(jid1.split("-")[1])
            assert n == max(1001, seq_before + 1)

            # joy_id is on the user doc
            doc = db.users.find_one({"user_id": user_id})
            assert doc.get("joy_id") == jid1
        finally:
            db.users.delete_one({"user_id": user_id})
            db.user_sessions.delete_one({"session_token": token})

    def test_joy_id_unique_across_users(self, db):
        """Two backfills produce distinct joy_ids."""
        users = []
        try:
            ids = []
            for _ in range(2):
                suf = uuid.uuid4().hex[:8]
                uid = f"TEST_jidU_{suf}"
                tok = f"TEST_jidUtok_{suf}"
                now = datetime.now(timezone.utc).isoformat()
                db.users.insert_one({
                    "user_id": uid, "email": f"TEST_jidU_{suf}@x.com",
                    "name": "U", "role": "workshop", "created_at": now,
                })
                db.user_sessions.insert_one({
                    "user_id": uid, "session_token": tok,
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                    "created_at": now,
                })
                users.append((uid, tok))
                r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), timeout=10)
                assert r.status_code == 200
                ids.append(r.json().get("joy_id"))
            assert ids[0] != ids[1]
            # both well-formed
            for jid in ids:
                assert re.match(r"^JOY-\d{4,}$", jid or "")
            # Sequential
            n0 = int(ids[0].split("-")[1])
            n1 = int(ids[1].split("-")[1])
            assert n1 == n0 + 1
        finally:
            for uid, tok in users:
                db.users.delete_one({"user_id": uid})
                db.user_sessions.delete_one({"session_token": tok})

    def test_orders_workshops_tie_to_user_id_not_joy_id(self, db):
        """Ensure no collection ties data to joy_id — joy_id is display-only."""
        # Schema sanity: orders.user_id, workshops.user_id, vin_passports.user_id
        sample_order = db.orders.find_one({}, {"_id": 0})
        if sample_order:
            assert "user_id" in sample_order
            assert "joy_id" not in sample_order
        sample_ws = db.workshops.find_one({}, {"_id": 0})
        if sample_ws:
            assert "user_id" in sample_ws
            assert "joy_id" not in sample_ws
        sample_p = db.vin_passports.find_one({}, {"_id": 0})
        if sample_p:
            assert "user_id" in sample_p
            assert "joy_id" not in sample_p


# ─── VIN Passport ─────────────────────────────────────────────────────────
class TestVinPassport:
    @pytest.fixture(scope="class")
    def vin(self):
        # 17-char VIN (valid format chars only — no I/O/Q)
        return f"1HGCM82633A{uuid.uuid4().hex[:6].upper().replace('I','1').replace('O','0').replace('Q','2')}"

    def test_generate_requires_login(self, vin):
        r = requests.post(
            f"{BASE_URL}/api/vin/passport/generate", json={"vin": vin}, timeout=15,
        )
        assert r.status_code == 401

    def test_generate_invalid_vin(self):
        r = requests.post(
            f"{BASE_URL}/api/vin/passport/generate",
            json={"vin": "TOOSHORT"},
            headers=_hdr(WORKSHOP_TOKEN),
            timeout=15,
        )
        assert r.status_code == 400

    def test_generate_returns_token_and_urls(self, vin):
        r = requests.post(
            f"{BASE_URL}/api/vin/passport/generate",
            json={"vin": vin},
            headers=_hdr(WORKSHOP_TOKEN),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for f in ("token", "share_url", "pdf_url", "view_url"):
            assert f in d and d[f], f"{f} missing/empty"
        assert d["pdf_url"].endswith(".pdf")
        assert f"/api/vin/passport/{d['token']}" == d["view_url"]
        # Stash for next tests
        TestVinPassport._tok = d["token"]
        TestVinPassport._vin = vin

    def test_generate_idempotent_same_token(self, vin):
        r = requests.post(
            f"{BASE_URL}/api/vin/passport/generate",
            json={"vin": vin},
            headers=_hdr(WORKSHOP_TOKEN),
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["token"] == TestVinPassport._tok

    def test_view_passport_public_no_auth(self):
        tok = TestVinPassport._tok
        r = requests.get(f"{BASE_URL}/api/vin/passport/{tok}", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["token"] == tok
        assert d["vin"] == TestVinPassport._vin
        assert "snapshot" in d
        assert "updated_at" in d

    def test_view_unknown_token_404(self):
        r = requests.get(f"{BASE_URL}/api/vin/passport/notreal_zzz", timeout=10)
        assert r.status_code == 404

    def test_pdf_public_no_auth_starts_with_pdf_magic(self):
        tok = TestVinPassport._tok
        r = requests.get(f"{BASE_URL}/api/vin/passport/{tok}.pdf", timeout=30)
        assert r.status_code == 200, r.text[:200]
        ct = r.headers.get("content-type", "")
        assert "application/pdf" in ct.lower(), ct
        assert r.content[:4] == b"%PDF", r.content[:20]
        assert len(r.content) > 500  # non-trivial pdf

    def test_pdf_unknown_token_404(self):
        r = requests.get(f"{BASE_URL}/api/vin/passport/notreal_zzz.pdf", timeout=10)
        assert r.status_code == 404

    @classmethod
    def teardown_class(cls):
        # Cleanup the passport row we created
        try:
            c = MongoClient(MONGO_URL)
            c[DB_NAME].vin_passports.delete_many({"token": getattr(cls, "_tok", "")})
            c.close()
        except Exception:
            pass
