"""RecordioAI iteration 3 backend regression:
Language detection, tags dedupe, notes, PATCH update, /tags, tag filter, q filter on tags/notes.
Also regression: create -> verify -> soft delete -> auth-required.
"""
import re
import pytest
import requests

BASE = "https://recordio-mvp.preview.emergentagent.com/api"
TOKEN = "recordio-test-token-abc123"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

SPANISH_TRANSCRIPT = (
    "Cliente: Hola, necesito cancelar mi suscripción hoy mismo. "
    "Agente: Entiendo. Si cancela hoy hay una tarifa de cancelación de $49 dólares, "
    "y le reembolsaremos $120 de forma prorrateada en 5 días hábiles. "
    "Cliente: De acuerdo, proceda por favor. "
    "Agente: Confirmado. Su servicio finalizará el 31 de enero de 2026. "
    "Le garantizamos que no se aplicarán más cargos a su tarjeta."
)

state = {"record_id": None}


# --- Auth regression ---
def test_records_no_token_401():
    r = requests.get(f"{BASE}/records")
    assert r.status_code == 401


def test_tags_no_token_401():
    r = requests.get(f"{BASE}/tags")
    assert r.status_code == 401


# --- Language + tags + notes on create ---
def test_create_spanish_with_tags_and_notes():
    payload = {
        "transcript": SPANISH_TRANSCRIPT,
        "capture_method": "Transcript",
        "agent_name": "TEST_AgenteBeta",
        "agent_version": "v1",
        "policy_version": "p1",
        "conversation_type": "Support",
        "tags": ["TEST_billing", "TEST_Billing", "  TEST_refund  ", "TEST_es"],
        "notes": "TEST_note_created: cliente pidió cancelación",
    }
    r = requests.post(f"{BASE}/records", headers=AUTH, json=payload, timeout=120)
    assert r.status_code == 200, r.text
    rec = r.json()["record"]
    state["record_id"] = rec["record_id"]

    # language detected as Spanish (case-insensitive contains)
    lang = (rec.get("language") or "").lower()
    assert "span" in lang or "espa" in lang, f"expected Spanish, got: {rec.get('language')}"

    # summary/commitments in Spanish (heuristic: contains a Spanish keyword or accented char)
    summary = rec.get("summary", "")
    spanish_signal = re.search(r"[áéíóúñ¿¡]|cancel|reembols|tarifa|garantiz", summary, re.I)
    assert spanish_signal, f"summary does not look Spanish: {summary}"

    # tags deduped case-insensitively, trimmed, first-seen preserved
    assert rec["tags"] == ["TEST_billing", "TEST_refund", "TEST_es"], rec["tags"]

    # notes stored
    assert rec["notes"] == "TEST_note_created: cliente pidió cancelación"

    # sha + verified
    assert re.match(r"^[0-9a-f]{64}$", rec["transcript_sha256"])
    assert rec["verification_status"] == "verified"


def test_verify_still_matches():
    rid = state["record_id"]
    assert rid
    r = requests.post(f"{BASE}/records/{rid}/verify", headers=AUTH)
    assert r.status_code == 200
    d = r.json()
    assert d["match"] is True
    assert d["stored_hash"] == d["recomputed_hash"]


# --- PATCH tags + notes ---
def test_patch_updates_tags_and_notes_preserves_hash():
    rid = state["record_id"]
    before = requests.get(f"{BASE}/records/{rid}", headers=AUTH).json()
    r = requests.patch(f"{BASE}/records/{rid}", headers=AUTH, json={
        "tags": ["TEST_urgent", "TEST_URGENT", "TEST_followup"],
        "notes": "TEST_note_updated",
    })
    assert r.status_code == 200, r.text
    rec = r.json()
    assert rec["tags"] == ["TEST_urgent", "TEST_followup"]
    assert rec["notes"] == "TEST_note_updated"
    # invariants
    assert rec["transcript_sha256"] == before["transcript_sha256"]
    assert rec["verification_status"] == before["verification_status"]
    assert rec["record_id"] == rid


def test_patch_unknown_id_404():
    r = requests.patch(f"{BASE}/records/RCP-9999-999999", headers=AUTH,
                       json={"tags": ["x"], "notes": "y"})
    assert r.status_code == 404


# --- /tags + tag/q filters ---
def test_tags_list_contains_updated_tags():
    r = requests.get(f"{BASE}/tags", headers=AUTH)
    assert r.status_code == 200
    tags = r.json()["tags"]
    # sorted
    assert tags == sorted(tags)
    assert "TEST_urgent" in tags
    assert "TEST_followup" in tags


def test_records_filter_by_tag():
    r = requests.get(f"{BASE}/records", headers=AUTH, params={"tag": "TEST_urgent"})
    assert r.status_code == 200
    recs = r.json()["records"]
    assert any(x["record_id"] == state["record_id"] for x in recs)
    for x in recs:
        assert "TEST_urgent" in x["tags"]


def test_records_filter_by_tag_no_match():
    r = requests.get(f"{BASE}/records", headers=AUTH, params={"tag": "TEST_nomatch_zzz"})
    assert r.status_code == 200
    assert r.json()["records"] == []


def test_records_q_matches_tags():
    r = requests.get(f"{BASE}/records", headers=AUTH, params={"q": "TEST_urgent"})
    assert r.status_code == 200
    assert any(x["record_id"] == state["record_id"] for x in r.json()["records"])


def test_records_q_matches_notes():
    r = requests.get(f"{BASE}/records", headers=AUTH, params={"q": "TEST_note_updated"})
    assert r.status_code == 200
    assert any(x["record_id"] == state["record_id"] for x in r.json()["records"])


# --- Cleanup: soft delete, verify not in list, second delete 404 ---
def test_delete_soft_deletes():
    rid = state["record_id"]
    r = requests.delete(f"{BASE}/records/{rid}", headers=AUTH)
    assert r.status_code == 200
    recs = requests.get(f"{BASE}/records", headers=AUTH).json()["records"]
    assert all(x["record_id"] != rid for x in recs)
    # seeded record must remain
    assert any(x["record_id"] == "RCP-2026-000001" for x in recs)

    # second delete -> 404
    r2 = requests.delete(f"{BASE}/records/{rid}", headers=AUTH)
    assert r2.status_code == 404
