"""Regression tests for the /api/transcribe bug fix.

Bug (already fixed by main agent): /api/transcribe was passing a plain
str path to emergentintegrations' Whisper client -> litellm rejected
with "Expected entry at file to be bytes, io.IOBase, PathLike or a
tuple but received str" -> 502 -> surfaced as 'internet connection
error' on the device. Fix: open the temp file as a binary file handle
before calling stt.transcribe.

These tests exercise the exact path that was failing:
  1) real speech WAV upload -> 200 with non-empty transcript + sha256
  2) end-to-end audio -> transcribe -> create record -> verify -> delete
  3) transcribe error paths (no credit burn)

External ingress is used (Cloudflare) to confirm no 502 is returned.
"""
import io
import os
import re
import hashlib
import pytest
import requests

BASE = "https://recordio-mvp.preview.emergentagent.com/api"
TOKEN = "recordio-test-token-abc123"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
SAMPLE_PATH = "/tmp/sample.wav"

# Shared state between ordered tests in this module
_state = {}


# -- Preflight: sample audio available --
class TestPreflight:
    def test_sample_wav_present(self):
        assert os.path.exists(SAMPLE_PATH), f"missing {SAMPLE_PATH}"
        size = os.path.getsize(SAMPLE_PATH)
        assert size > 1000, f"sample too small: {size} bytes"
        _state["expected_sha"] = hashlib.sha256(open(SAMPLE_PATH, "rb").read()).hexdigest()


# -- Transcribe: real speech (the exact scenario that was 502-ing) --
class TestTranscribeRealAudio:
    def test_real_wav_returns_200_with_transcript(self):
        """This is the exact call that used to fail with 502 through Cloudflare."""
        with open(SAMPLE_PATH, "rb") as fh:
            files = {"file": ("sample.wav", fh, "audio/wav")}
            r = requests.post(f"{BASE}/transcribe", headers=AUTH, files=files, timeout=90)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:400]}"
        body = r.json()
        # transcript is a non-empty string
        assert isinstance(body.get("transcript"), str), body
        transcript = body["transcript"].strip()
        assert len(transcript) > 0, "empty transcript"
        # audio_sha256 is 64-char hex and matches locally computed hash
        assert re.match(r"^[0-9a-f]{64}$", body.get("audio_sha256", "")), body
        assert body["audio_sha256"] == _state["expected_sha"], "sha256 mismatch"
        # save for E2E test
        _state["transcript"] = transcript
        _state["audio_sha256"] = body["audio_sha256"]


# -- Transcribe: error handling (no whisper credit burn) --
class TestTranscribeErrors:
    def test_no_file_422(self):
        r = requests.post(f"{BASE}/transcribe", headers=AUTH)
        # FastAPI treats missing required File as 422 (validation error)
        assert r.status_code in (400, 422), r.text

    def test_unsupported_content_type_415(self):
        files = {"file": ("notes.txt", io.BytesIO(b"this is text, not audio"), "text/plain")}
        r = requests.post(f"{BASE}/transcribe", headers=AUTH, files=files)
        assert r.status_code == 415, r.text
        # Should NOT be 502 (bug-fix regression sentinel)
        assert r.status_code != 502

    def test_no_auth_401(self):
        with open(SAMPLE_PATH, "rb") as fh:
            files = {"file": ("sample.wav", fh, "audio/wav")}
            r = requests.post(f"{BASE}/transcribe", files=files)
        assert r.status_code == 401


# -- E2E: transcribe -> create record -> verify -> delete --
class TestE2EAudioToRecord:
    def test_end_to_end(self):
        # Must run after TestTranscribeRealAudio
        transcript = _state.get("transcript")
        audio_sha = _state.get("audio_sha256")
        if not transcript or not audio_sha:
            pytest.skip("transcribe step didn't populate state")

        payload = {
            "transcript": transcript,
            "capture_method": "Voice Recording",
            "agent_name": "Voice Agent",
            "conversation_type": "Support",
            "audio_sha256": audio_sha,
        }
        r = requests.post(f"{BASE}/records", headers=AUTH, json=payload, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        rec = body["record"]

        # audio sha stored correctly (round-trip)
        assert rec["audio_sha256"] == audio_sha
        # transcript sha is 64-hex and recomputes correctly
        assert re.match(r"^[0-9a-f]{64}$", rec["transcript_sha256"])
        expected_tsha = hashlib.sha256(transcript.encode("utf-8")).hexdigest()
        assert rec["transcript_sha256"] == expected_tsha
        # metadata
        assert rec["capture_method"] == "Voice Recording"
        assert rec["agent_name"] == "Voice Agent"
        assert rec["conversation_type"] == "Support"
        # Gemini extraction ran (summary is a string; arrays exist)
        assert isinstance(rec["summary"], str)
        for k in ["promises", "prices_or_fees", "dates_or_deadlines",
                  "warranties_or_disclosures", "cancellations_or_changes"]:
            assert isinstance(rec[k], list), k

        _state["record_id"] = rec["record_id"]

        # Verify SHA-256 integrity
        vr = requests.post(f"{BASE}/records/{rec['record_id']}/verify", headers=AUTH)
        assert vr.status_code == 200, vr.text
        vdata = vr.json()
        assert vdata["match"] is True
        assert vdata["stored_hash"] == vdata["recomputed_hash"] == expected_tsha
        assert vdata["verification_status"] == "verified"

    def test_cleanup_delete(self):
        rid = _state.get("record_id")
        if not rid:
            pytest.skip("no record created")
        r = requests.delete(f"{BASE}/records/{rid}", headers=AUTH)
        assert r.status_code == 200
        # confirm gone
        g = requests.get(f"{BASE}/records/{rid}", headers=AUTH)
        assert g.status_code == 404

    def test_seeded_record_untouched(self):
        r = requests.get(f"{BASE}/records/RCP-2026-000001", headers=AUTH)
        assert r.status_code == 200, "seeded record must remain"
