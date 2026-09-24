"""Iteration 4: Saved Agents + Tag Colors + Date Filter + regression on create/verify."""
import os
import re
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE = "https://recordio-mvp.preview.emergentagent.com/api"
TOKEN = "recordio-test-token-abc123"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

SHORT_TRANSCRIPT = (
    "Customer: Please cancel my plan. "
    "Agent: Ok, $19 cancellation fee applies and refund of $40 within 3 business days. "
    "Customer: Fine. Agent: Confirmed on January 20, 2026."
)

state = {"agent_ids": [], "record_ids": []}


# ---------------- Saved Agents ----------------
class TestAgents:
    def test_agents_requires_auth(self):
        r = requests.get(f"{BASE}/agents")
        assert r.status_code == 401
        r2 = requests.post(f"{BASE}/agents", json={"name": "x"})
        assert r2.status_code == 401
        r3 = requests.delete(f"{BASE}/agents/ag_deadbeef")
        assert r3.status_code == 401

    def test_create_agent(self):
        payload = {"name": "TEST_Agent_A", "version": "v1", "policy_version": "p2",
                   "conversation_type": "Sales"}
        r = requests.post(f"{BASE}/agents", headers=AUTH, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["agent_id"].startswith("ag_")
        assert d["name"] == "TEST_Agent_A"
        assert d["version"] == "v1"
        assert d["policy_version"] == "p2"
        assert d["conversation_type"] == "Sales"
        assert "_id" not in d
        state["agent_ids"].append(d["agent_id"])

    def test_create_agent_empty_name_422(self):
        r = requests.post(f"{BASE}/agents", headers=AUTH, json={"name": ""})
        assert r.status_code == 422, r.text
        r2 = requests.post(f"{BASE}/agents", headers=AUTH, json={"name": "   "})
        assert r2.status_code == 422, r2.text

    def test_list_agents_contains_created(self):
        r = requests.get(f"{BASE}/agents", headers=AUTH)
        assert r.status_code == 200
        agents = r.json()["agents"]
        assert any(a["agent_id"] == state["agent_ids"][0] for a in agents)
        # No _id leakage
        for a in agents:
            assert "_id" not in a

    def test_delete_agent_ok_and_404_on_repeat(self):
        aid = state["agent_ids"][0]
        r = requests.delete(f"{BASE}/agents/{aid}", headers=AUTH)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        r2 = requests.delete(f"{BASE}/agents/{aid}", headers=AUTH)
        assert r2.status_code == 404

    def test_delete_unknown_agent_404(self):
        r = requests.delete(f"{BASE}/agents/ag_nonexistent999", headers=AUTH)
        assert r.status_code == 404


# ---------------- Tag Colors ----------------
class TestTagColors:
    def test_tag_colors_requires_auth(self):
        r = requests.get(f"{BASE}/tag-colors")
        assert r.status_code == 401
        r2 = requests.put(f"{BASE}/tag-colors", json={"colors": {}})
        assert r2.status_code == 401

    def test_get_initial(self):
        # Reset first
        requests.put(f"{BASE}/tag-colors", headers=AUTH, json={"colors": {}})
        r = requests.get(f"{BASE}/tag-colors", headers=AUTH)
        assert r.status_code == 200
        assert r.json() == {"colors": {}}

    def test_put_and_get_persists(self):
        r = requests.put(f"{BASE}/tag-colors", headers=AUTH,
                         json={"colors": {"vip": "red", "urgent": "amber"}})
        assert r.status_code == 200
        assert r.json()["colors"] == {"vip": "red", "urgent": "amber"}
        # subsequent GET returns same
        r2 = requests.get(f"{BASE}/tag-colors", headers=AUTH)
        assert r2.status_code == 200
        assert r2.json()["colors"] == {"vip": "red", "urgent": "amber"}

    def test_put_drops_empty_keys_and_values(self):
        r = requests.put(f"{BASE}/tag-colors", headers=AUTH,
                         json={"colors": {"": "red", "keep": "blue", "  ": "green", "empty": ""}})
        assert r.status_code == 200
        colors = r.json()["colors"]
        assert colors == {"keep": "blue"}
        r2 = requests.get(f"{BASE}/tag-colors", headers=AUTH)
        assert r2.json()["colors"] == {"keep": "blue"}

    def test_cleanup_reset(self):
        r = requests.put(f"{BASE}/tag-colors", headers=AUTH, json={"colors": {}})
        assert r.status_code == 200
        assert r.json() == {"colors": {}}


# ---------------- Record create for date-filter + regression ----------------
class TestRecordCreateAndDateFilter:
    def test_create_record_regression(self):
        payload = {
            "transcript": SHORT_TRANSCRIPT,
            "capture_method": "Transcript",
            "agent_name": "TEST_Iter4_Agent",
            "agent_version": "v1",
            "policy_version": "p1",
            "conversation_type": "Support",
            "tags": ["TEST_iter4"],
            "notes": "TEST_iter4 note",
        }
        r = requests.post(f"{BASE}/records", headers=AUTH, json=payload, timeout=90)
        assert r.status_code == 200, r.text
        rec = r.json()["record"]
        state["record_ids"].append(rec["record_id"])
        # regression: real gemini extraction fields present
        assert re.match(r"^[0-9a-f]{64}$", rec["transcript_sha256"])
        assert rec["verification_status"] == "verified"
        assert isinstance(rec["summary"], str) and len(rec["summary"].strip()) > 0
        assert rec["tags"] == ["TEST_iter4"]
        assert rec["notes"] == "TEST_iter4 note"
        all_items = (rec["promises"] + rec["prices_or_fees"] +
                     rec["dates_or_deadlines"] + rec["cancellations_or_changes"])
        assert len(all_items) > 0

    def test_verify_matches(self):
        rid = state["record_ids"][0]
        r = requests.post(f"{BASE}/records/{rid}/verify", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["match"] is True
        assert d["stored_hash"] == d["recomputed_hash"]

    def test_date_filter_today_returns_record(self):
        today = datetime.now(timezone.utc).date().isoformat()
        rid = state["record_ids"][0]
        r = requests.get(f"{BASE}/records", headers=AUTH, params={"start": today})
        assert r.status_code == 200
        recs = r.json()["records"]
        assert any(x["record_id"] == rid for x in recs), f"Expected {rid} in {[x['record_id'] for x in recs]}"

    def test_date_filter_future_start_returns_zero(self):
        r = requests.get(f"{BASE}/records", headers=AUTH, params={"start": "2099-01-01"})
        assert r.status_code == 200
        assert r.json()["records"] == []

    def test_date_filter_past_end_returns_zero(self):
        r = requests.get(f"{BASE}/records", headers=AUTH, params={"end": "2000-12-31"})
        assert r.status_code == 200
        assert r.json()["records"] == []

    def test_date_filter_range_includes_today(self):
        today = datetime.now(timezone.utc).date()
        start = (today - timedelta(days=1)).isoformat()
        end = today.isoformat()
        rid = state["record_ids"][0]
        r = requests.get(f"{BASE}/records", headers=AUTH,
                         params={"start": start, "end": end})
        assert r.status_code == 200
        recs = r.json()["records"]
        assert any(x["record_id"] == rid for x in recs)

    def test_soft_delete_cleanup(self):
        rid = state["record_ids"][0]
        r = requests.delete(f"{BASE}/records/{rid}", headers=AUTH)
        assert r.status_code == 200
        r2 = requests.delete(f"{BASE}/records/{rid}", headers=AUTH)
        assert r2.status_code == 404
        # not in list
        recs = requests.get(f"{BASE}/records", headers=AUTH).json()["records"]
        assert all(x["record_id"] != rid for x in recs)
