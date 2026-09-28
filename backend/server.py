import os
import json
import re
import secrets
import hashlib
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
import httpx

from emergentintegrations_replacement import LlmChat, UserMessage, OpenAISpeechToText

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


class DeviceRegisterRequest(BaseModel):
    device_id: str
    device_name: str = ""


class DeviceLoginRequest(BaseModel):
    device_id: str
    device_secret: str


class AnalyzeRequest(BaseModel):
    transcript: str
    language: Optional[str] = "en"
    conversationId: Optional[str] = ""


class Commitment(BaseModel):
    category: str = ""
    commitment: str = ""
    quote: str = ""
    speaker: str = ""


class ExtractedDiscrepancy(BaseModel):
    category: str = ""
    commitment: str = ""
    quote: str = ""
    speaker: str = ""
    severity: str = "low"


class Extraction(BaseModel):
    overall_summary: str = ""
    language: str = ""
    promises: List[Commitment] = Field(default_factory=list)
    prices_or_fees: List[Commitment] = Field(default_factory=list)
    dates_or_deadlines: List[Commitment] = Field(default_factory=list)
    warranties_or_disclosures: List[Commitment] = Field(default_factory=list)
    cancellations_or_changes: List[Commitment] = Field(default_factory=list)
    discrepancies: List[ExtractedDiscrepancy] = Field(default_factory=list)


class RecordCreate(BaseModel):
    transcript: str
    capture_method: str  # "Voice Recording" | "Phone Call" | "Transcript"
    agent_name: str
    agent_version: Optional[str] = ""
    policy_version: Optional[str] = ""
    conversation_type: str  # Sales | Support | Billing | Other
    audio_sha256: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""


class RecordUpdate(BaseModel):
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""


class AgentProfile(BaseModel):
    name: str
    version: Optional[str] = ""
    policy_version: Optional[str] = ""
    conversation_type: Optional[str] = "Support"


class TagColors(BaseModel):
    colors: Dict[str, str] = Field(default_factory=dict)


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


# ---------------------------------------------------------------------------
# Mobile device authentication
#
# A standalone Android APK cannot carry an Emergent session_id, so mobile
# clients authenticate with their own per-install credential instead. The app
# generates a random device_id and a high-entropy device_secret, registers the
# device once, and stores ONLY its own secret on the device. The backend stores
# only the SHA-256 hash of that secret and issues the same session_token model
# the Emergent flow uses. Server-side secrets (MONGO_URL, EMERGENT_LLM_KEY)
# never leave Render.
# ---------------------------------------------------------------------------
DEVICE_SESSION_DAYS = 90


def _device_user_id(device_id: str) -> str:
    return "dev_" + hashlib.sha256(device_id.encode("utf-8")).hexdigest()[:20]


def _mint_device_token(user_id: str) -> str:
    from pymongo.errors import DuplicateKeyError

    sessions = db.user_sessions
    now = datetime.now(timezone.utc)
    while True:
        token = secrets.token_urlsafe(32)
        try:
            sessions.insert_one({
                "session_token": token,
                "user_id": user_id,
                "created_at": now,
                "expires_at": now + timedelta(days=DEVICE_SESSION_DAYS),
            })
            return token
        except DuplicateKeyError:
            # session_token collision is effectively impossible; retry with a
            # fresh token rather than crashing the request.
            continue


@api.post("/auth/device/register")
async def device_register(body: DeviceRegisterRequest):
    device_id = (body.device_id or "").strip()
    if not device_id:
        raise HTTPException(status_code=422, detail="device_id is required.")
    if len(device_id) > 200:
        raise HTTPException(status_code=422, detail="device_id is too long.")

    user_id = _device_user_id(device_id)
    device_secret = secrets.token_urlsafe(32)
    secret_hash = hashlib.sha256(device_secret.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    name = (body.device_name or "Mobile Device").strip()

    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {"user_id": user_id, "name": name, "updated_at": now},
            "$setOnInsert": {
                "email": f"{user_id}@devices.recordioai.invalid",
                "picture": "",
                "created_at": now,
            },
        },
        upsert=True,
    )

    await db.devices.update_one(
        {"device_id": device_id},
        {
            "$set": {
                "user_id": user_id,
                "secret_hash": secret_hash,
                "name": name,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    session_token = _mint_device_token(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "session_token": session_token,
        "device_id": device_id,
        # Returned exactly once, at registration. The client stores it in the
        # device keystore; the server only keeps the SHA-256 hash above.
        "device_secret": device_secret,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "picture": user.get("picture", ""),
        },
    }


@api.post("/auth/device/token")
async def device_token(body: DeviceLoginRequest):
    device_id = (body.device_id or "").strip()
    if not device_id:
        raise HTTPException(status_code=401, detail="Invalid device credential")
    device = await db.devices.find_one({"device_id": device_id}, {"_id": 0})
    secret_hash = hashlib.sha256((body.device_secret or "").encode("utf-8")).hexdigest()
    if not device or device.get("secret_hash") != secret_hash:
        raise HTTPException(status_code=401, detail="Invalid device credential")

    user_id = device["user_id"]
    session_token = _mint_device_token(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "session_token": session_token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "picture": user.get("picture", ""),
        },
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
        '- "language": the English name of the language the conversation is written in '
        '(e.g. "English", "Spanish", "French", "German", "Portuguese").\n'
        '- "overall_summary": one concise factual sentence summarising what was promised. '
        "If nothing was promised, say so plainly. Never invent promises.\n"
        '- "promises": array of general commitments/promises made.\n'
        '- "prices_or_fees": array of any price, fee, charge or refund amounts mentioned.\n'
        '- "dates_or_deadlines": array of any dates, deadlines or timeframes mentioned.\n'
        '- "warranties_or_disclosures": array of warranties, guarantees or disclosures stated.\n'
        '- "cancellations_or_changes": array of cancellation, change or termination conditions.\n'
        '- "discrepancies": array of contradictions the caller could rely on: for example a '
        "price that is quoted and then charged differently, a fee that is only mentioned later, "
        "or a promise that conflicts with another statement. Return an empty array when the "
        "transcript is internally consistent. Never invent a conflict that is not explicit.\n\n"
        "Each array item (except discrepancies) is an object with keys: "
        '"category" (short label e.g. "Refund", "Cancellation Fee", "Deadline"), '
        '"commitment" (a short plain-language statement of what was committed), '
        '"quote" (the exact verbatim supporting sentence from the transcript), '
        '"speaker" (who said it if confidently identifiable, else empty string).\n'
        'Each "discrepancies" item is an object with keys: '
        '"category" (short label e.g. "Price Mismatch", "Undisclosed Fee", "Timeline Conflict"), '
        '"commitment" (a short statement of the conflict), '
        '"quote" (the exact verbatim supporting sentence), '
        '"speaker" (who said it, else empty string), '
        '"severity" (one of "low", "medium", "high").\n\n'
        "IMPORTANT: Write the \"overall_summary\", every \"category\" and every \"commitment\" "
        "in the SAME language as the conversation. Keep each \"quote\" verbatim in the "
        "original language.\n"
        "Rules: Only include items explicitly present. Empty array if none. Do NOT infer.\n\n"
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
    )
    # Use GEMINI_MODEL verbatim. The legacy with_model() remapping pins every
    # "flash" name to gemini-1.5-flash, which the GenerateContent endpoint no
    # longer accepts, so a dashboard-configured current model must win.
    chat.model_name = GEMINI_MODEL
    raw = await chat.send_message(UserMessage(text=_extraction_prompt(transcript)))
    parsed = _parse_json_block(raw)
    return Extraction(**parsed)


# ---------------------------------------------------------------------------
# AI analysis for the mobile app (/api/analyze)
#
# Maps the same Gemini extraction used by the record flow onto the
# ConversationAnalysis shape the Android client renders. Structured fields are
# derived from the AI's real output (no invented values): prices come from the
# price-or-fee list with a detected amount, commitments come from the promise/
# deadline/warranty/cancellation lists, and discrepancies come from the
# contradiction list when the model actually finds one.
# ---------------------------------------------------------------------------
def _money_from_text(text: str) -> Optional[dict]:
    if not text:
        return None
    symbol_currency = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"}
    found = None
    for symbol, code in symbol_currency.items():
        if symbol in text:
            found = code
            break
    code_match = re.search(r"\b(AUD|CAD|CHF|CNY|EUR|GBP|INR|JPY|USD)\b", text, re.IGNORECASE)
    currency = code_match.group(1).upper() if code_match else found
    # Only treat a number as money when a currency symbol/code is present, so
    # plain numerals (dates, counts, "5 business days") are not misread as prices.
    if currency is None:
        return None
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)", text)
    if not m:
        return None
    try:
        amount = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    return {"amount": amount, "currency": currency}


def _speaker_role(speaker: str) -> str:
    s = (speaker or "").strip().lower()
    if "customer" in s or "caller" in s or "client" in s:
        return "CUSTOMER"
    return "AI_AGENT"


def _discrepancy_type(category: str) -> str:
    c = (category or "").lower()
    if "fee" in c and any(k in c for k in ("undisclosed", "hidden", "surprise", "not mention", "not stated")):
        return "fee_not_disclosed"
    if any(k in c for k in ("price", "cost", "charge", "refund", "billing")):
        return "price_mismatch"
    if any(k in c for k in ("timeline", "date", "deadline", "when", "schedule")):
        return "timeline_mismatch"
    if any(k in c for k in ("product", "feature")):
        return "product_mismatch"
    return "other"


@api.post("/analyze")
async def analyze(body: AnalyzeRequest, user=Depends(get_current_user)):
    transcript = (body.transcript or "").strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Transcript is empty.")
    if len(transcript) > 500000:
        raise HTTPException(status_code=413, detail="Transcript exceeds the 500,000 character limit.")

    try:
        extraction = await _extract(transcript)
    except Exception as e:
        logger.error("Analyze extraction failed: %s", str(e))
        # The exception class and a sanitised message (API-key-like tokens are
        # blanked) are echoed in response headers so integration failures can be
        # classified from the client side during bring-up.
        message = re.sub(r"[A-Za-z0-9_\-]{20,}", "***", str(e))[:300]
        raise HTTPException(
            status_code=502,
            detail="AI analysis failed. Please try again later.",
            headers={
                "X-Analyze-Error": type(e).__name__,
                "X-Analyze-Detail": message,
            },
        )

    import uuid
    now = datetime.now(timezone.utc).isoformat()
    conv_id = (body.conversationId or "").strip() or f"conv_{uuid.uuid4().hex[:16]}"

    prices = []
    for item in extraction.prices_or_fees:
        money = _money_from_text(f"{item.commitment} {item.quote}")
        if money:
            prices.append({
                "id": f"price_{uuid.uuid4().hex[:12]}",
                "amount": money["amount"],
                "currency": money["currency"] or "",
                "confidence": 0.0,
                "context": item.quote or item.commitment,
                "sourceSegmentIds": [],
            })

    commitments = []
    for item in (
        extraction.promises
        + extraction.dates_or_deadlines
        + extraction.warranties_or_disclosures
        + extraction.cancellations_or_changes
    ):
        description = item.commitment or item.quote
        if not description.strip():
            continue
        commitments.append({
            "id": f"cmt_{uuid.uuid4().hex[:12]}",
            "conversationId": conv_id,
            "description": description,
            "promisedBy": _speaker_role(item.speaker),
            "status": "pending",
            "confidence": 0.0,
            "sourceSegmentIds": [],
            "createdAt": now,
            "updatedAt": now,
        })

    severity_map = {"low": "low", "medium": "medium", "high": "high"}
    discrepancies = []
    for item in extraction.discrepancies:
        description = item.commitment or item.quote
        if not description.strip():
            continue
        discrepancies.append({
            "id": f"disc_{uuid.uuid4().hex[:12]}",
            "conversationId": conv_id,
            "type": _discrepancy_type(item.category),
            "description": description,
            "promisedValue": None,
            "actualValue": None,
            "severity": severity_map.get((item.severity or "").strip().lower(), "medium"),
            "confidence": 0.0,
            "sourceSegmentIds": [],
            "status": "detected",
            "createdAt": now,
        })

    analysis = {
        "id": f"analysis_{uuid.uuid4().hex[:12]}",
        "conversationId": conv_id,
        "products": [],
        "prices": prices,
        "fees": [],
        "commitments": commitments,
        "discrepancies": discrepancies,
        "summary": extraction.overall_summary,
        "keyPoints": [],
        "language": extraction.language,
        "modelVersion": GEMINI_MODEL,
        "createdAt": now,
        "updatedAt": now,
    }

    return {"analysis": analysis, "provider": "recordioai", "modelVersion": GEMINI_MODEL}


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

    clean_tags = []
    seen = set()
    for t in (body.tags or []):
        tag = t.strip()
        if tag and tag.lower() not in seen:
            seen.add(tag.lower())
            clean_tags.append(tag)

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
        "language": extraction.language,
        "tags": clean_tags,
        "notes": (body.notes or "").strip(),
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
async def list_records(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user=Depends(get_current_user),
):
    query = {"user_id": user["user_id"], "deleted_at": None}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"agent_name": rx}, {"record_id": rx}, {"summary": rx}, {"tags": rx}, {"notes": rx}]
    if tag:
        query["tags"] = tag
    if start or end:
        created = {}
        if start:
            created["$gte"] = start
        if end:
            # end is a YYYY-MM-DD day; include the whole day
            created["$lte"] = end + "T23:59:59.999999+00:00"
        query["created_at"] = created
    cursor = db.records.find(query, {"_id": 0}).sort("created_at", -1)
    records = await cursor.to_list(500)
    return {"records": records}


@api.get("/tags")
async def list_tags(user=Depends(get_current_user)):
    tags = await db.records.distinct("tags", {"user_id": user["user_id"], "deleted_at": None})
    return {"tags": sorted([t for t in tags if t])}


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


@api.patch("/records/{record_id}")
async def update_record(record_id: str, body: RecordUpdate, user=Depends(get_current_user)):
    clean_tags = []
    seen = set()
    for t in (body.tags or []):
        tag = t.strip()
        if tag and tag.lower() not in seen:
            seen.add(tag.lower())
            clean_tags.append(tag)
    res = await db.records.update_one(
        {"record_id": record_id, "user_id": user["user_id"], "deleted_at": None},
        {"$set": {"tags": clean_tags, "notes": (body.notes or "").strip()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    rec = await db.records.find_one({"record_id": record_id, "user_id": user["user_id"]}, {"_id": 0})
    return rec


@api.delete("/records/{record_id}")
async def delete_record(record_id: str, user=Depends(get_current_user)):
    res = await db.records.update_one(
        {"record_id": record_id, "user_id": user["user_id"], "deleted_at": None},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Saved agent profiles
# ---------------------------------------------------------------------------
@api.get("/agents")
async def list_agents(user=Depends(get_current_user)):
    cursor = db.agent_profiles.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return {"agents": await cursor.to_list(200)}


@api.post("/agents")
async def create_agent(body: AgentProfile, user=Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Agent name is required.")
    import uuid
    doc = {
        "agent_id": f"ag_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": body.name.strip(),
        "version": (body.version or "").strip(),
        "policy_version": (body.policy_version or "").strip(),
        "conversation_type": body.conversation_type or "Support",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.agent_profiles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, user=Depends(get_current_user)):
    res = await db.agent_profiles.delete_one({"agent_id": agent_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agent profile not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Tag colors
# ---------------------------------------------------------------------------
@api.get("/tag-colors")
async def get_tag_colors(user=Depends(get_current_user)):
    doc = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"colors": (doc or {}).get("tag_colors", {})}


@api.put("/tag-colors")
async def set_tag_colors(body: TagColors, user=Depends(get_current_user)):
    clean = {k.strip(): v for k, v in (body.colors or {}).items() if k.strip() and v}
    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"tag_colors": clean, "user_id": user["user_id"]}},
        upsert=True,
    )
    return {"colors": clean}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.records.create_index("user_id")
    await db.records.create_index("record_id", unique=True)
    await db.devices.create_index("device_id", unique=True)
    await db.devices.create_index("user_id")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
