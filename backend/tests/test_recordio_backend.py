"""RecordioAI backend regression suite (pytest)."""
import os
import io
import re
import time
import pytest
import requests

BASE = "https://recordio-mvp.preview.emergentagent.com/api"
TOKEN = "recordio-test-token-abc123"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

SAMPLE_TRANSCRIPT = (
    "Customer: Hi, I need to cancel my subscription. "
    "Agent: I can help with that. If you cancel today there is a $49 cancellation fee, "
    "and we'll issue a prorated refund of $120 within 5 business days. "
    "Customer: Okay please proceed. "
    "Agent: Confirmed. Your service will end on January 31, 2026. "
    "We also guarantee that no further charges will be applied to your card."
)

created_ids = []


# --- Health / Auth ---
class TestAuth:
    def test_root(self):
        r = requests.get(f"{BASE}/")
        assert r.status_code == 200

    def test_me_valid_token(self):
        r = requests.get(f"{BASE}/auth/me", headers=AUTH)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == "test@recordio.ai"
        assert d["user_id"] == "user_testrecordio"

    def test_me_no_token_401(self):
        r = requests.get(f"{BASE}/auth/me")
        assert r.status_code == 401

    def test_records_no_token_401(self):
        r = requests.get(f"{BASE}/records")
        assert r.status_code == 401

    def test_trial_no_token_401(self):
        r = requests.get(f"{BASE}/trial")
        assert r.status_code == 401

    def test_create_no_token_401(self):
        r = requests.post(f"{BASE}/records", json={
            "transcript": "x", "capture_method": "Transcript",
            "agent_name": "a", "conversation_type": "Sales"
        })
        assert r.status_code == 401

    def test_session_invalid_session_id(self):
        r = requests.post(f"{BASE}/auth/session", json={"session_id": "definitely-invalid-xyz"})
        assert r.status_code == 401


# --- Trial ---
class TestTrial:
    def test_trial_shape(self):
        r = requests.get(f"{BASE}/trial", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["limit"] == 10
        assert d["used"] + d["remaining"] == 10


# --- Records validation ---
class TestRecordValidation:
    def test_empty_transcript_422(self):
        r = requests.post(f"{BASE}/records", headers=AUTH, json={
            "transcript": "", "capture_method": "Transcript",
            "agent_name": "Bot", "conversation_type": "Support"
        })
        assert r.status_code == 422, r.text

    def test_missing_agent_name_422(self):
        # agent_name is required by Pydantic model -> 422
        r = requests.post(f"{BASE}/records", headers=AUTH, json={
            "transcript": "hello world",
            "capture_method": "Transcript",
            "conversation_type": "Support"
        })
        assert r.status_code == 422, r.text

    def test_blank_agent_name_422(self):
        r = requests.post(f"{BASE}/records", headers=AUTH, json={
            "transcript": "hello world",
            "capture_method": "Transcript",
            "agent_name": "   ",
            "conversation_type": "Support"
        })
        assert r.status_code == 422, r.text


# --- Records CRUD + Gemini extraction ---
class TestRecordsFlow:
    def test_create_extract_verify(self):
        payload = {
            "transcript": SAMPLE_TRANSCRIPT,
            "capture_method": "Transcript",
            "agent_name": "TEST_AgentAlpha",
            "agent_version": "v1",
            "policy_version": "p1",
            "conversation_type": "Support",
        }
        r = requests.post(f"{BASE}/records", headers=AUTH, json=payload, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        rec = body["record"]
        created_ids.append(rec["record_id"])

        # record_id format
        assert re.match(r"^RCP-2026-\d{6}$", rec["record_id"]), rec["record_id"]
        # sha
        assert re.match(r"^[0-9a-f]{64}$", rec["transcript_sha256"])
        # verified
        assert rec["verification_status"] == "verified"
        # summary
        assert isinstance(rec["summary"], str) and len(rec["summary"].strip()) > 0
        # arrays present
        for k in ["promises", "prices_or_fees", "dates_or_deadlines",
                  "cancellations_or_changes", "warranties_or_disclosures"]:
            assert isinstance(rec[k], list)
        # At least one commitment across categories has quote + commitment
        all_items = (rec["promises"] + rec["prices_or_fees"] +
                     rec["dates_or_deadlines"] + rec["cancellations_or_changes"])
        assert len(all_items) > 0, "Gemini extracted nothing"
        for it in all_items:
            assert "quote" in it and "commitment" in it and "category" in it
        # trial math
        assert "trial" in body and body["trial"]["limit"] == 10

    def test_verify_endpoint(self):
        assert created_ids, "prior create test failed"
        rid = created_ids[0]
        r = requests.post(f"{BASE}/records/{rid}/verify", headers=AUTH)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["match"] is True
        assert d["stored_hash"] == d["recomputed_hash"]
        assert d["verification_status"] == "verified"

    def test_get_record(self):
        rid = created_ids[0]
        r = requests.get(f"{BASE}/records/{rid}", headers=AUTH)
        assert r.status_code == 200
        assert r.json()["record_id"] == rid

    def test_get_record_404(self):
        r = requests.get(f"{BASE}/records/RCP-9999-999999", headers=AUTH)
        assert r.status_code == 404

    def test_list_records_sorted(self):
        r = requests.get(f"{BASE}/records", headers=AUTH)
        assert r.status_code == 200
        recs = r.json()["records"]
        assert len(recs) >= 1
        # sorted desc by created_at
        for i in range(len(recs) - 1):
            assert recs[i]["created_at"] >= recs[i + 1]["created_at"]

    def test_search_filter(self):
        r = requests.get(f"{BASE}/records", headers=AUTH, params={"q": "TEST_AgentAlpha"})
        assert r.status_code == 200
        recs = r.json()["records"]
        assert any(x["record_id"] == created_ids[0] for x in recs)

        r2 = requests.get(f"{BASE}/records", headers=AUTH, params={"q": "no-such-agent-zzz-xyz"})
        assert r2.status_code == 200
        assert all(x["record_id"] != created_ids[0] for x in r2.json()["records"])

    def test_delete_and_trial_decrement(self):
        # Only delete the record we created (do not touch seeded RCP-2026-000001)
        rid = created_ids[0]
        t_before = requests.get(f"{BASE}/trial", headers=AUTH).json()
        r = requests.delete(f"{BASE}/records/{rid}", headers=AUTH)
        assert r.status_code == 200
        # not in list
        recs = requests.get(f"{BASE}/records", headers=AUTH).json()["records"]
        assert all(x["record_id"] != rid for x in recs)
        t_after = requests.get(f"{BASE}/trial", headers=AUTH).json()
        assert t_after["used"] == t_before["used"] - 1
        # 2nd delete -> 404
        r2 = requests.delete(f"{BASE}/records/{rid}", headers=AUTH)
        assert r2.status_code == 404


# --- Transcribe error handling (no credit burn) ---
class TestTranscribeErrors:
    def test_no_file_422(self):
        r = requests.post(f"{BASE}/transcribe", headers=AUTH)
        assert r.status_code in (400, 422), r.text

    def test_unsupported_content_type_415(self):
        files = {"file": ("test.txt", io.BytesIO(b"not audio"), "text/plain")}
        r = requests.post(f"{BASE}/transcribe", headers=AUTH, files=files)
        assert r.status_code == 415, r.text
