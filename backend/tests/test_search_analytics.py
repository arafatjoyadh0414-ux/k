"""Tests for P2 search-intent capture & admin search-analytics endpoints."""
import time
import requests


def _post_log(base_url, payload):
    return requests.post(f"{base_url}/api/public/search-log", json=payload, timeout=15)


# ============= POST /api/public/search-log =============
class TestPublicSearchLog:
    def test_valid_log_inserted(self, base_url, mongo):
        payload = {"query": "TEST_brake_pad_unique_q1", "source": "landing", "hit_count": 3}
        r = _post_log(base_url, payload)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "log_id" in data and isinstance(data["log_id"], str) and len(data["log_id"]) > 0

        # Verify persistence in DB
        doc = mongo.public_search_logs.find_one({"log_id": data["log_id"]})
        assert doc is not None
        assert doc["query"] == payload["query"]
        assert doc["source"] == "landing"
        assert doc["hit_count"] == 3
        assert doc["zero_result"] is False
        assert "ip_hash" in doc
        # Cleanup
        mongo.public_search_logs.delete_one({"log_id": data["log_id"]})

    def test_short_query_skipped(self, base_url, mongo):
        before = mongo.public_search_logs.count_documents({"query": "a"})
        r = _post_log(base_url, {"query": "a", "source": "landing"})
        assert r.status_code == 200
        body = r.json()
        assert body == {"ok": True, "skipped": "too_short"}
        after = mongo.public_search_logs.count_documents({"query": "a"})
        assert after == before  # no insert

    def test_empty_query_skipped(self, base_url):
        r = _post_log(base_url, {"query": "  ", "source": "landing"})
        assert r.status_code == 200
        assert r.json().get("skipped") == "too_short"

    def test_truncation_query_120_source_40(self, base_url, mongo):
        long_q = "TEST_" + ("x" * 200)  # 205 chars
        long_src = "s" * 100
        r = _post_log(base_url, {"query": long_q, "source": long_src, "hit_count": 0})
        assert r.status_code == 200
        log_id = r.json()["log_id"]
        doc = mongo.public_search_logs.find_one({"log_id": log_id})
        assert doc is not None
        assert len(doc["query"]) == 120
        assert len(doc["source"]) == 40
        mongo.public_search_logs.delete_one({"log_id": log_id})

    def test_zero_result_flag_set(self, base_url, mongo):
        r = _post_log(base_url, {"query": "TEST_zr_unique_q2", "source": "landing", "hit_count": 0})
        log_id = r.json()["log_id"]
        doc = mongo.public_search_logs.find_one({"log_id": log_id})
        assert doc["zero_result"] is True
        mongo.public_search_logs.delete_one({"log_id": log_id})


# ============= GET /api/admin/search-analytics auth =============
class TestSearchAnalyticsAuth:
    def test_unauth_blocked(self, base_url):
        r = requests.get(f"{base_url}/api/admin/search-analytics?days=30", timeout=15)
        assert r.status_code in (401, 403)

    def test_workshop_blocked(self, base_url, workshop_headers):
        r = requests.get(f"{base_url}/api/admin/search-analytics?days=30",
                         headers=workshop_headers, timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_allowed(self, base_url, admin_headers):
        r = requests.get(f"{base_url}/api/admin/search-analytics?days=30",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ["window_days", "total_logs", "unique_queries", "unique_visitors",
                  "zero_result_rate", "top_queries", "zero_result_queries",
                  "daily_volume", "by_source"]:
            assert k in data, f"missing key: {k}"
        assert data["window_days"] == 30


# ============= Aggregation correctness =============
class TestSearchAnalyticsAggregation:
    def test_full_aggregation_shape_and_zero_rate(self, base_url, admin_headers, mongo):
        # Use a unique tag query + clean up at end
        tag = "TEST_AGG_" + str(int(time.time()))
        # 3 hits for "tag hit" (hit_count > 0) and 2 hits for "tag miss" (zero result)
        log_ids = []
        for _ in range(3):
            r = _post_log(base_url, {"query": f"{tag} hit", "source": "landing", "hit_count": 5})
            log_ids.append(r.json()["log_id"])
        for _ in range(2):
            r = _post_log(base_url, {"query": f"{tag} miss", "source": "catalog", "hit_count": 0})
            log_ids.append(r.json()["log_id"])

        r = requests.get(f"{base_url}/api/admin/search-analytics?days=30",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total_logs"] >= 5
        # zero_result_rate is in [0,1]
        assert 0.0 <= data["zero_result_rate"] <= 1.0
        # top_queries should include our hit tag (normalized)
        norm_hit = f"{tag} hit".lower()
        norm_miss = f"{tag} miss".lower()
        top_norms = [q["query_norm"] for q in data["top_queries"]]
        assert norm_hit in top_norms or norm_miss in top_norms

        # zero-result list should contain only zero-hit queries (i.e. miss but NOT hit)
        zero_norms = [q["query_norm"] for q in data["zero_result_queries"]]
        if norm_miss in zero_norms:
            assert norm_hit not in zero_norms, "hit query incorrectly in zero-result list"

        # daily_volume entries shaped {day, count}
        if data["daily_volume"]:
            sample = data["daily_volume"][0]
            assert "day" in sample and "count" in sample
            assert len(sample["day"]) == 10  # YYYY-MM-DD

        # by_source entries shaped {source, count}
        if data["by_source"]:
            assert "source" in data["by_source"][0] and "count" in data["by_source"][0]

        # Cleanup
        for lid in log_ids:
            mongo.public_search_logs.delete_one({"log_id": lid})

    def test_window_days_param(self, base_url, admin_headers):
        for d in (7, 30, 90):
            r = requests.get(f"{base_url}/api/admin/search-analytics?days={d}",
                             headers=admin_headers, timeout=15)
            assert r.status_code == 200, f"days={d} failed"
            assert r.json()["window_days"] == d
