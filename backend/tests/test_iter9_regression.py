"""Iter 9 regression: smoke-test public stats/catalog/categories, auth, VIN passport, joy_id."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
WS_TOKEN = "test-token-workshop-1"
ADMIN_TOKEN = "admin-test-token-rosie-broadcast"
ADMIN_TOKEN_2 = "test-token-admin-1"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ----- Public endpoints -----
class TestPublicEndpoints:
    def test_stats_returns_required_fields(self):
        r = requests.get(f"{BASE_URL}/api/public/stats", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("workshops_count", "orders_today", "credit_used_bdt", "last_order_at", "active_now"):
            assert k in d, f"missing {k} in stats response: {d}"
        assert isinstance(d["workshops_count"], int)
        assert isinstance(d["orders_today"], int)

    def test_catalog_returns_array(self):
        r = requests.get(f"{BASE_URL}/api/public/catalog", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # Could be {"items":[...]} or [...]
        items = body if isinstance(body, list) else body.get("items") or body.get("products") or body.get("data")
        assert items is not None, f"no array key found in: {list(body.keys()) if isinstance(body, dict) else type(body)}"
        assert isinstance(items, list)

    def test_categories_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/public/categories", timeout=15)
        assert r.status_code == 200, r.text


# ----- Auth -----
class TestAuth:
    def test_workshop_me(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(WS_TOKEN), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("role") == "workshop", d
        # joy_id should be JOY-XXXX (4 digits)
        if d.get("joy_id"):
            jid = d["joy_id"]
            assert jid.startswith("JOY-"), jid
            assert jid[4:].isdigit() and len(jid[4:]) == 4, f"joy_id not 4 digits: {jid}"

    def test_admin_me_primary(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(ADMIN_TOKEN), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "admin"

    def test_admin_me_seeded(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(ADMIN_TOKEN_2), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "admin"

    def test_unauth_me_rejected(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code in (401, 403), r.status_code


# ----- VIN passport regression -----
class TestVinPassport:
    @classmethod
    def setup_class(cls):
        cls.token = None
        cls.vin = "1HGBH41JXMN109186"  # valid 17-char VIN

    def test_generate_passport(self):
        body = {
            "vin": self.vin,
            "make": "Test", "model": "Reg", "year": 2024,
            "owner_name": "Reg Test", "owner_phone": "+8801710000000",
            "service_summary": "iter9 regression",
        }
        r = requests.post(f"{BASE_URL}/api/vin/passport/generate", json=body, headers=_auth(WS_TOKEN), timeout=20)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert "share_token" in d or "token" in d, d
        TestVinPassport.token = d.get("share_token") or d.get("token")
        assert TestVinPassport.token

    def test_public_view_passport(self):
        if not TestVinPassport.token:
            pytest.skip("no token from generate")
        r = requests.get(f"{BASE_URL}/api/vin/passport/{TestVinPassport.token}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "user_id" not in d, "user_id leaked in public passport"

    def test_pdf_download(self):
        if not TestVinPassport.token:
            pytest.skip("no token from generate")
        r = requests.get(
            f"{BASE_URL}/api/vin/passport/{TestVinPassport.token}.pdf",
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"%PDF", f"not a PDF: {r.content[:20]}"
        assert "application/pdf" in r.headers.get("content-type", "")
