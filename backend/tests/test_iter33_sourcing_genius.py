"""Tests for Iter33: Sourcing Leads & Genius Analytics endpoints.

Covers:
- Auto-promotion of zero-result queries to sourcing_leads (>=5 unique IPs in 7d)
- GET /api/admin/sourcing-leads (auth, filtering, shape)
- POST /api/admin/sourcing-leads/{id}/status (validation, 404, 400)
- POST /api/chat/action-click (auth required, persists to genius_action_clicks)
- GET /api/admin/genius-analytics (auth, shape, window switching)
"""
import time
import uuid
import requests


# ============= Sourcing Leads — auto-promotion =============
class TestSourcingLeadAutoPromotion:
    def test_zero_result_promotes_after_threshold(self, base_url, admin_headers, mongo):
        # Ensure clean slate for this test query
        unique_q = f"TEST_iter33_widget_{uuid.uuid4().hex[:6]}"
        mongo.sourcing_leads.delete_many({"query_norm": unique_q.lower()})
        mongo.public_search_logs.delete_many({"query_norm": unique_q.lower()})

        # Fire 5 zero-result searches with distinct ip_hash (vary user-agent so server side doesn't matter,
        # but ip_hash is derived from request.client.host. Since all come from same caller, ip_hash will
        # be identical — but the route counts BOTH total>=5 OR unique_visitors>=5. Total alone triggers.)
        log_ids = []
        for i in range(6):
            r = requests.post(
                f"{base_url}/api/public/search-log",
                json={"query": unique_q, "source": "landing", "hit_count": 0},
                timeout=15,
            )
            assert r.status_code == 200
            log_ids.append(r.json().get("log_id"))

        time.sleep(1)
        # The lead should now exist
        lead = mongo.sourcing_leads.find_one({"query_norm": unique_q.lower()})
        assert lead is not None, "Lead should have been auto-promoted after 5+ zero-result hits"
        assert lead["status"] == "open"
        assert lead["search_count_window"] >= 5
        assert "lead_id" in lead

        # Cleanup
        mongo.sourcing_leads.delete_many({"query_norm": unique_q.lower()})
        mongo.public_search_logs.delete_many({"query_norm": unique_q.lower()})

    def test_zero_result_below_threshold_no_lead(self, base_url, mongo):
        unique_q = f"TEST_iter33_below_{uuid.uuid4().hex[:6]}"
        mongo.sourcing_leads.delete_many({"query_norm": unique_q.lower()})
        for _ in range(3):
            requests.post(
                f"{base_url}/api/public/search-log",
                json={"query": unique_q, "source": "landing", "hit_count": 0},
                timeout=15,
            )
        time.sleep(0.5)
        lead = mongo.sourcing_leads.find_one({"query_norm": unique_q.lower()})
        assert lead is None
        mongo.public_search_logs.delete_many({"query_norm": unique_q.lower()})


# ============= GET /api/admin/sourcing-leads =============
class TestListSourcingLeads:
    def test_unauth_blocked(self, base_url):
        r = requests.get(f"{base_url}/api/admin/sourcing-leads", timeout=15)
        assert r.status_code in (401, 403)

    def test_workshop_blocked(self, base_url, workshop_headers):
        r = requests.get(
            f"{base_url}/api/admin/sourcing-leads", headers=workshop_headers, timeout=15
        )
        assert r.status_code in (401, 403)

    def test_admin_returns_shape(self, base_url, admin_headers):
        r = requests.get(
            f"{base_url}/api/admin/sourcing-leads", headers=admin_headers, timeout=15
        )
        assert r.status_code == 200
        data = r.json()
        for k in ("leads", "by_status", "threshold", "window_days"):
            assert k in data, f"missing {k}"
        assert data["threshold"] == 5
        assert data["window_days"] == 7
        assert isinstance(data["leads"], list)
        assert isinstance(data["by_status"], dict)
        # Verify _id is excluded
        for lead in data["leads"]:
            assert "_id" not in lead

    def test_filter_by_status_open(self, base_url, admin_headers, mongo):
        # Seed a lead in 'open' status
        seeded = {
            "lead_id": f"TEST_lead_{uuid.uuid4().hex[:8]}",
            "query_norm": f"test_filter_{uuid.uuid4().hex[:6]}",
            "sample_query": "test_filter_sample",
            "search_count_window": 7,
            "unique_visitors_window": 5,
            "status": "open",
            "priority": "medium",
            "notes": "",
            "first_seen_at": "2026-01-01T00:00:00+00:00",
            "last_seen_at": "2026-01-01T00:00:00+00:00",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        mongo.sourcing_leads.insert_one(seeded.copy())
        try:
            r = requests.get(
                f"{base_url}/api/admin/sourcing-leads?status=open",
                headers=admin_headers,
                timeout=15,
            )
            assert r.status_code == 200
            data = r.json()
            for lead in data["leads"]:
                assert lead["status"] == "open"
            assert any(lead["lead_id"] == seeded["lead_id"] for lead in data["leads"])
        finally:
            mongo.sourcing_leads.delete_one({"lead_id": seeded["lead_id"]})


# ============= POST /api/admin/sourcing-leads/{lead_id}/status =============
class TestUpdateSourcingLeadStatus:
    def _seed(self, mongo, status="open"):
        lid = f"TEST_lead_{uuid.uuid4().hex[:8]}"
        mongo.sourcing_leads.insert_one({
            "lead_id": lid,
            "query_norm": f"test_upd_{uuid.uuid4().hex[:6]}",
            "sample_query": "test_upd",
            "search_count_window": 5,
            "unique_visitors_window": 5,
            "status": status,
            "priority": "medium",
            "notes": "",
            "first_seen_at": "2026-01-01T00:00:00+00:00",
            "last_seen_at": "2026-01-01T00:00:00+00:00",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        return lid

    def test_update_to_sourcing_then_added(self, base_url, admin_headers, mongo):
        lid = self._seed(mongo)
        try:
            r = requests.post(
                f"{base_url}/api/admin/sourcing-leads/{lid}/status",
                headers=admin_headers,
                json={"status": "sourcing", "notes": "looking into it"},
                timeout=15,
            )
            assert r.status_code == 200
            body = r.json()
            assert body["ok"] is True
            assert body["lead"]["status"] == "sourcing"
            assert body["lead"]["notes"] == "looking into it"

            # Verify persistence
            doc = mongo.sourcing_leads.find_one({"lead_id": lid})
            assert doc["status"] == "sourcing"

            # Then -> added
            r2 = requests.post(
                f"{base_url}/api/admin/sourcing-leads/{lid}/status",
                headers=admin_headers,
                json={"status": "added"},
                timeout=15,
            )
            assert r2.status_code == 200
            assert r2.json()["lead"]["status"] == "added"
        finally:
            mongo.sourcing_leads.delete_one({"lead_id": lid})

    def test_invalid_status_400(self, base_url, admin_headers, mongo):
        lid = self._seed(mongo)
        try:
            r = requests.post(
                f"{base_url}/api/admin/sourcing-leads/{lid}/status",
                headers=admin_headers,
                json={"status": "invalid_status_xyz"},
                timeout=15,
            )
            assert r.status_code == 400
        finally:
            mongo.sourcing_leads.delete_one({"lead_id": lid})

    def test_nonexistent_lead_404(self, base_url, admin_headers):
        r = requests.post(
            f"{base_url}/api/admin/sourcing-leads/does_not_exist_xyz/status",
            headers=admin_headers,
            json={"status": "sourcing"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_unauth_blocked(self, base_url):
        r = requests.post(
            f"{base_url}/api/admin/sourcing-leads/anything/status",
            json={"status": "sourcing"},
            timeout=15,
        )
        assert r.status_code in (401, 403)


# ============= POST /api/chat/action-click =============
class TestActionClick:
    def test_unauth_blocked(self, base_url):
        r = requests.post(
            f"{base_url}/api/chat/action-click",
            json={"session_id": "s1", "action_type": "add_to_cart"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_workshop_can_post_and_persists(self, base_url, workshop_headers, mongo):
        sid = f"TEST_session_{uuid.uuid4().hex[:8]}"
        before = mongo.genius_action_clicks.count_documents({"session_id": sid})
        r = requests.post(
            f"{base_url}/api/chat/action-click",
            headers=workshop_headers,
            json={
                "session_id": sid,
                "action_type": "add_to_cart",
                "action_label": "Add to cart",
                "product_id": "P-TEST-001",
            },
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert "click_id" in body

        # Verify persistence
        doc = mongo.genius_action_clicks.find_one({"click_id": body["click_id"]})
        assert doc is not None
        assert doc["session_id"] == sid
        assert doc["action_type"] == "add_to_cart"
        assert doc["action_label"] == "Add to cart"
        assert doc["product_id"] == "P-TEST-001"
        assert "user_id" in doc

        after = mongo.genius_action_clicks.count_documents({"session_id": sid})
        assert after == before + 1
        # Cleanup
        mongo.genius_action_clicks.delete_one({"click_id": body["click_id"]})


# ============= GET /api/admin/genius-analytics =============
class TestGeniusAnalytics:
    def test_unauth_blocked(self, base_url):
        r = requests.get(f"{base_url}/api/admin/genius-analytics", timeout=15)
        assert r.status_code in (401, 403)

    def test_workshop_blocked(self, base_url, workshop_headers):
        r = requests.get(
            f"{base_url}/api/admin/genius-analytics",
            headers=workshop_headers,
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_admin_full_shape(self, base_url, admin_headers):
        r = requests.get(
            f"{base_url}/api/admin/genius-analytics?days=30",
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        required = [
            "window_days", "total_messages", "total_user_messages",
            "total_assistant_replies", "total_sessions", "unique_users",
            "actions_surfaced", "actions_clicked", "click_rate",
            "top_questions", "daily_volume", "actions_by_type",
        ]
        for k in required:
            assert k in data, f"missing key: {k}"
        assert data["window_days"] == 30
        assert isinstance(data["top_questions"], list)
        assert isinstance(data["daily_volume"], list)
        assert isinstance(data["actions_by_type"], list)
        assert 0.0 <= data["click_rate"] <= 1.0 or data["click_rate"] == 0.0

    def test_window_switch_7d_vs_90d(self, base_url, admin_headers):
        r7 = requests.get(
            f"{base_url}/api/admin/genius-analytics?days=7",
            headers=admin_headers,
            timeout=15,
        )
        r90 = requests.get(
            f"{base_url}/api/admin/genius-analytics?days=90",
            headers=admin_headers,
            timeout=15,
        )
        assert r7.status_code == 200 and r90.status_code == 200
        assert r7.json()["window_days"] == 7
        assert r90.json()["window_days"] == 90
        # 90d window should be >= 7d window
        assert r90.json()["total_messages"] >= r7.json()["total_messages"]
