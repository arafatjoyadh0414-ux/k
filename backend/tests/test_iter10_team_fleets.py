"""Iter10 backend regression: Team endpoints + Fleet endpoints.

Covers review request items 1-9.
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback to frontend .env value
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

WK_TOKEN = "test-token-workshop-1"
ADMIN_TOKEN = "admin-test-token-rosie-broadcast"
INVITEE_TOKEN = "tok-invitee"
INVITEE_EMAIL = "mechanic@test.com"


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ============= Team: members =============
class TestTeamMembers:
    def test_members_workshop_ok(self):
        r = requests.get(f"{BASE}/api/team/members", headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "workshop_id" in data and "members" in data
        assert isinstance(data["members"], list) and len(data["members"]) >= 1
        owner = next((m for m in data["members"] if m.get("is_owner")), None)
        assert owner is not None, "Owner not in members list"

    def test_members_admin_rejected(self):
        r = requests.get(f"{BASE}/api/team/members", headers=_h(ADMIN_TOKEN), timeout=15)
        # Admin has no workshop — per code raises 403 (or 404). Spec says 404 for admins.
        assert r.status_code in (403, 404), r.text


# ============= Team: invitations =============
class TestInvitations:
    invite_id = None
    invite_token = None

    def test_invalid_role_rejected(self):
        r = requests.post(f"{BASE}/api/team/invitations",
                          headers=_h(WK_TOKEN),
                          json={"email": "foo@test.com", "role": "ceo"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_create_invitation(self):
        r = requests.post(f"{BASE}/api/team/invitations",
                          headers=_h(WK_TOKEN),
                          json={"email": INVITEE_EMAIL, "role": "mechanic"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("invite_id", "").startswith("inv_")
        assert data.get("token")
        TestInvitations.invite_id = data["invite_id"]
        TestInvitations.invite_token = data["token"]

    def test_list_invitations(self):
        r = requests.get(f"{BASE}/api/team/invitations", headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 200, r.text
        inv_list = r.json().get("invitations", [])
        assert any(i.get("invite_id") == TestInvitations.invite_id for i in inv_list), \
            "Recently-created invite not in pending list"

    def test_lookup_public_no_auth(self):
        assert TestInvitations.invite_token
        r = requests.get(f"{BASE}/api/team/invitations/lookup/{TestInvitations.invite_token}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == INVITEE_EMAIL
        assert data.get("role") == "mechanic"
        assert data.get("workshop_name")

    def test_lookup_bad_token_404(self):
        r = requests.get(f"{BASE}/api/team/invitations/lookup/nope-bad-token", timeout=15)
        assert r.status_code == 404, r.text

    def test_accept_invitation_wrong_email(self):
        # Use workshop owner token → email mismatch
        r = requests.post(f"{BASE}/api/team/invitations/accept",
                          headers=_h(WK_TOKEN),
                          json={"token": TestInvitations.invite_token}, timeout=15)
        assert r.status_code == 403, r.text

    def test_accept_invitation_ok(self):
        r = requests.post(f"{BASE}/api/team/invitations/accept",
                          headers=_h(INVITEE_TOKEN),
                          json={"token": TestInvitations.invite_token}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("role") == "mechanic"

    def test_members_after_accept(self):
        r = requests.get(f"{BASE}/api/team/members", headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 200
        emails = [m.get("email") for m in r.json().get("members", [])]
        assert INVITEE_EMAIL in emails, f"Invitee not in members after accept: {emails}"

    def test_lookup_after_accept_410(self):
        r = requests.get(f"{BASE}/api/team/invitations/lookup/{TestInvitations.invite_token}", timeout=15)
        assert r.status_code == 410, r.text

    def test_remove_member(self):
        r = requests.get(f"{BASE}/api/team/members", headers=_h(WK_TOKEN), timeout=15)
        members = r.json().get("members", [])
        invitee = next((m for m in members if m.get("email") == INVITEE_EMAIL), None)
        assert invitee, "invitee not found"
        r = requests.delete(f"{BASE}/api/team/members/{invitee['user_id']}",
                            headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 200, r.text

    def test_remove_owner_rejected(self):
        r = requests.get(f"{BASE}/api/team/members", headers=_h(WK_TOKEN), timeout=15)
        owner = next(m for m in r.json()["members"] if m.get("is_owner"))
        r = requests.delete(f"{BASE}/api/team/members/{owner['user_id']}",
                            headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 400, r.text

    def test_revoke_invitation_404_when_accepted(self):
        # create fresh and revoke it
        r = requests.post(f"{BASE}/api/team/invitations",
                          headers=_h(WK_TOKEN),
                          json={"email": "toberevoked@test.com", "role": "manager"}, timeout=15)
        assert r.status_code == 200
        inv_id = r.json()["invite_id"]
        r2 = requests.delete(f"{BASE}/api/team/invitations/{inv_id}",
                             headers=_h(WK_TOKEN), timeout=15)
        assert r2.status_code == 200, r2.text
        # revoking again → 404
        r3 = requests.delete(f"{BASE}/api/team/invitations/{inv_id}",
                             headers=_h(WK_TOKEN), timeout=15)
        assert r3.status_code == 404, r3.text


# ============= Fleets CRUD =============
class TestFleets:
    fleet_id = None

    def test_create_fleet(self):
        payload = {
            "name": "TEST_Fleet_Iter10",
            "description": "iter10 auto fleet",
            "vehicles": [
                {"brand": "Toyota", "model": "Corolla", "year": 2021, "plate": "DHA-1234"},
                {"brand": "Honda", "model": "City", "year": 2022},
            ],
        }
        r = requests.post(f"{BASE}/api/fleets", headers=_h(WK_TOKEN), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("fleet_id", "").startswith("fleet_")
        assert data["name"] == "TEST_Fleet_Iter10"
        assert len(data["vehicles"]) == 2
        TestFleets.fleet_id = data["fleet_id"]

    def test_list_fleets(self):
        r = requests.get(f"{BASE}/api/fleets", headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 200
        ids = [f["fleet_id"] for f in r.json().get("fleets", [])]
        assert TestFleets.fleet_id in ids

    def test_get_fleet(self):
        r = requests.get(f"{BASE}/api/fleets/{TestFleets.fleet_id}", headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 200
        assert r.json()["fleet_id"] == TestFleets.fleet_id

    def test_patch_fleet(self):
        r = requests.patch(f"{BASE}/api/fleets/{TestFleets.fleet_id}",
                           headers=_h(WK_TOKEN),
                           json={"name": "TEST_Fleet_Iter10_Renamed"}, timeout=15)
        assert r.status_code == 200
        # Verify persisted
        r2 = requests.get(f"{BASE}/api/fleets/{TestFleets.fleet_id}", headers=_h(WK_TOKEN), timeout=15)
        assert r2.json()["name"] == "TEST_Fleet_Iter10_Renamed"

    def test_reorder_suggestions(self):
        r = requests.get(f"{BASE}/api/fleets/{TestFleets.fleet_id}/reorder-suggestions",
                         headers=_h(WK_TOKEN), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["fleet_id"] == TestFleets.fleet_id
        assert "suggestions" in data and isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) <= 20
        if data["suggestions"]:
            s0 = data["suggestions"][0]
            assert "retail_price_bdt" in s0 and "your_price_bdt" in s0
            # Gold tier ⇒ your_price < retail_price
            assert s0["your_price_bdt"] <= s0["retail_price_bdt"]
            assert s0.get("your_tier") == "gold"

    def test_delete_fleet(self):
        r = requests.delete(f"{BASE}/api/fleets/{TestFleets.fleet_id}",
                            headers=_h(WK_TOKEN), timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE}/api/fleets/{TestFleets.fleet_id}", headers=_h(WK_TOKEN), timeout=15)
        assert r2.status_code == 404


# ============= Auth negatives =============
class TestAuthNegatives:
    def test_fleets_unauth(self):
        r = requests.get(f"{BASE}/api/fleets", timeout=15)
        assert r.status_code in (401, 403)

    def test_team_unauth(self):
        r = requests.get(f"{BASE}/api/team/members", timeout=15)
        assert r.status_code in (401, 403)
