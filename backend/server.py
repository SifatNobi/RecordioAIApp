import os
import json
import re
import hashlib
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
import httpx

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
TRIAL_LIMIT = 10

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("recordio")

app = FastAPI(title="RecordioAI")
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SessionRequest(BaseModel):
    session_id: str


class Commitment(BaseModel):
    category: str = ""
    commitment: str = ""
    quote: str = ""
    speaker: str = ""


class Extraction(BaseModel):
    overall_summary: str = ""
    promises: List[Commitment] = Field(default_factory=list)
    prices_or_fees: List[Commitment] = Field(default_factory=list)
    dates_or_deadlines: List[Commitment] = Field(default_factory=list)
    warranties_or_disclosures: List[Commitment] = Field(default_factory=list)
    cancellations_or_changes: List[Commitment] = Field(default_factory=list)


class RecordCreate(BaseModel):
    transcript: str
    capture_method: str  # "Voice Recording" | "Phone Call" | "Transcript"
    agent_name: str
    agent_version: Optional[str] = ""
    policy_version: Optional[str] = ""
    conversation_type: str  # Sales | Support | Billing | Other
    audio_sha256: Optional[str] = ""


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@api.get("/")
async def root():
    return {"service": "RecordioAI", "status": "ok"}


@api.post("/auth/session")
async def create_session(body: SessionRequest):
    async with httpx.AsyncClient(timeout=20) as hc:
        resp = await hc.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session_id")
    data = resp.json()
    email = data.get("email")
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Incomplete session data")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        import uuid
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
        })

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })

    return {
        "session_token": session_token,
        "user": {"user_id": user_id, "email": email, "name": name, "picture": picture},
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user_id": user["user_id"], "email": user["email"], "name": user.get("name", ""), "picture": user.get("picture", "")}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Trial
# ---------------------------------------------------------------------------
async def _trial_status(user_id: str):
    used = await db.records.count_documents({"user_id": user_id, "deleted_at": None})
    remaining = max(0, TRIAL_LIMIT - used)
    return {"used": used, "limit": TRIAL_LIMIT, "remaining": remaining}


@api.get("/trial")
async def trial(user=Depends(get_current_user)):
    return await _trial_status(user["user_id"])


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------
@api.post("/transcribe")
async def transcribe(file: UploadFile = File(...), user=Depends(get_current_user)):
    suffix = Path(file.filename or "audio.m4a").suffix.lower() or ".m4a"
    if suffix.lstrip(".") not in {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}:
        raise HTTPException(status_code=415, detail="Unsupported audio format")
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio exceeds 25 MB limit")

    audio_sha256 = hashlib.sha256(audio_bytes).hexdigest()

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        with open(tmp_path, "rb") as audio_file:
            result = await stt.transcribe(audio_file, model="whisper-1", response_format="text")
        transcript = result if isinstance(result, str) else getattr(result, "text", str(result))
        transcript = (transcript or "").strip()
    except Exception as e:
        logger.error("Transcription failed: %s", str(e))
        raise HTTPException(status_code=502, detail="Transcription service failed. Please try again or paste the transcript manually.")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected in the recording.")

    return {"transcript": transcript, "audio_sha256": audio_sha256}


# ---------------------------------------------------------------------------
# AI extraction (single Gemini request)
# ---------------------------------------------------------------------------
EXTRACTION_SYSTEM = (
    "You are a precise compliance analyst for RecordioAI. You read a conversation "
    "transcript between a customer and an AI agent or human representative, and you "
    "extract ONLY the commitments that were actually stated. You never invent, infer, "
    "or assume information that is not explicitly present in the transcript. If a "
    "category has nothing explicitly stated, return an empty array for it. "
    "Every extracted item MUST include a verbatim supporting quote copied exactly from "
    "the transcript. Respond with STRICT JSON ONLY, no markdown, no commentary."
)


def _extraction_prompt(transcript: str) -> str:
    return (
        "Extract structured commitments from the transcript below. Return a JSON object "
        "with EXACTLY these keys:\n"
        '- "overall_summary": one concise factual sentence summarising what was promised. '
        "If nothing was promised, say so plainly. Never invent promises.\n"
        '- "promises": array of general commitments/promises made.\n'
        '- "prices_or_fees": array of any price, fee, charge or refund amounts mentioned.\n'
        '- "dates_or_deadlines": array of any dates, deadlines or timeframes mentioned.\n'
        '- "warranties_or_disclosures": array of warranties, guarantees or disclosures stated.\n'
        '- "cancellations_or_changes": array of cancellation, change or termination conditions.\n\n'
        "Each array item is an object with keys: "
        '"category" (short label e.g. "Refund", "Cancellation Fee", "Deadline"), '
        '"commitment" (a short plain-language statement of what was committed), '
        '"quote" (the exact verbatim supporting sentence from the transcript), '
        '"speaker" (who said it if confidently identifiable, else empty string).\n\n'
        "Rules: Only include items explicitly present. Empty array if none. Do NOT infer. "
        "Copy quotes verbatim.\n\n"
        "TRANSCRIPT:\n\"\"\"\n" + transcript + "\n\"\"\""
    )


def _parse_json_block(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model output")
    return json.loads(text[start : end + 1])


async def _extract(transcript: str) -> Extraction:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id="recordio-extract",
        system_message=EXTRACTION_SYSTEM,
    ).with_model("gemini", GEMINI_MODEL)
    raw = await chat.send_message(UserMessage(text=_extraction_prompt(transcript)))
    parsed = _parse_json_block(raw)
    return Extraction(**parsed)


# ---------------------------------------------------------------------------
# Records
# ---------------------------------------------------------------------------
async def _next_record_id() -> str:
    year = datetime.now(timezone.utc).year
    key = f"RCP-{year}"
    doc = await db.counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc["seq"]
    return f"{key}-{seq:06d}"


@api.post("/records")
async def create_record(body: RecordCreate, user=Depends(get_current_user)):
    transcript = (body.transcript or "").strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Transcript is empty.")

    status = await _trial_status(user["user_id"])
    if status["remaining"] <= 0:
        raise HTTPException(status_code=402, detail="Trial limit reached. Upgrade to create more records.")

    if not body.agent_name.strip():
        raise HTTPException(status_code=422, detail="Agent name is required.")

    try:
        extraction = await _extract(transcript)
    except Exception as e:
        logger.error("Extraction failed: %s", str(e))
        raise HTTPException(status_code=502, detail="AI extraction failed or returned invalid data. Please try again.")

    transcript_sha256 = hashlib.sha256(transcript.encode("utf-8")).hexdigest()
    record_id = await _next_record_id()
    now = datetime.now(timezone.utc)

    record = {
        "record_id": record_id,
        "user_id": user["user_id"],
        "created_at": now.isoformat(),
        "capture_method": body.capture_method,
        "agent_name": body.agent_name.strip(),
        "agent_version": (body.agent_version or "").strip(),
        "policy_version": (body.policy_version or "").strip(),
        "conversation_type": body.conversation_type,
        "transcript": transcript,
        "transcript_sha256": transcript_sha256,
        "audio_sha256": (body.audio_sha256 or "").strip(),
        "summary": extraction.overall_summary,
        "promises": [c.model_dump() for c in extraction.promises],
        "prices_or_fees": [c.model_dump() for c in extraction.prices_or_fees],
        "dates_or_deadlines": [c.model_dump() for c in extraction.dates_or_deadlines],
        "warranties_or_disclosures": [c.model_dump() for c in extraction.warranties_or_disclosures],
        "cancellations_or_changes": [c.model_dump() for c in extraction.cancellations_or_changes],
        "verification_status": "verified",
        "last_verified_at": now.isoformat(),
        "deleted_at": None,
    }
    await db.records.insert_one(record)
    record.pop("_id", None)
    trial_status = await _trial_status(user["user_id"])
    return {"record": record, "trial": trial_status}


@api.get("/records")
async def list_records(q: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["user_id"], "deleted_at": None}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"agent_name": rx}, {"record_id": rx}, {"summary": rx}]
    cursor = db.records.find(query, {"_id": 0}).sort("created_at", -1)
    records = await cursor.to_list(500)
    return {"records": records}


@api.get("/records/{record_id}")
async def get_record(record_id: str, user=Depends(get_current_user)):
    rec = await db.records.find_one({"record_id": record_id, "user_id": user["user_id"], "deleted_at": None}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    return rec


@api.post("/records/{record_id}/verify")
async def verify_record(record_id: str, user=Depends(get_current_user)):
    rec = await db.records.find_one({"record_id": record_id, "user_id": user["user_id"], "deleted_at": None})
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    recomputed = hashlib.sha256(rec["transcript"].encode("utf-8")).hexdigest()
    match = recomputed == rec["transcript_sha256"]
    status = "verified" if match else "mismatch"
    now = datetime.now(timezone.utc).isoformat()
    await db.records.update_one(
        {"record_id": record_id, "user_id": user["user_id"]},
        {"$set": {"verification_status": status, "last_verified_at": now}},
    )
    return {
        "match": match,
        "verification_status": status,
        "stored_hash": rec["transcript_sha256"],
        "recomputed_hash": recomputed,
        "verified_at": now,
    }


@api.delete("/records/{record_id}")
async def delete_record(record_id: str, user=Depends(get_current_user)):
    res = await db.records.update_one(
        {"record_id": record_id, "user_id": user["user_id"], "deleted_at": None},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.records.create_index("user_id")
    await db.records.create_index("record_id", unique=True)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
