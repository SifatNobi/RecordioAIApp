# RecordioAI — Product Requirements Document

## Original Problem Statement
Build RecordioAI, a focused business MVP: "Prove What Your AI Promised." It turns
conversations involving AI agents/representatives into structured, verifiable
commitment records. Core loop: Capture → Transcribe → Extract commitments →
Conversation Receipt with SHA-256 integrity hash → Verify → Export evidence.
Single-user business workspace. No fake data, no faked recordings, no faked
verification, no pretending unsupported call recording works.

## Architecture
- **Frontend**: Expo Router (React Native), dark security aesthetic, Geist + Geist Mono
  fonts, Phosphor icons, TanStack Query, react-native-keyboard-controller.
- **Backend**: FastAPI + MongoDB (motor). All `/api` prefixed.
- **AI**: Google Gemini `gemini-3-flash-preview` (configurable via `GEMINI_MODEL`) for a
  single structured-JSON extraction per record, via emergentintegrations (key on backend only).
- **STT**: OpenAI Whisper via emergentintegrations (Emergent universal key, backend only).
- **Auth**: Emergent-managed Google OAuth (session_token, 7-day sessions).
- **Integrity**: SHA-256 of the exact canonical transcript computed and stored on the backend;
  verify recomputes and compares. Audio SHA-256 computed during transcription (audio not stored).

## User Personas
- Small business owner / freelancer / agency using AI sales or support agents who needs a
  reliable, checkable record of what the AI promised a customer.

## Core Requirements (static)
1. Three capture methods: microphone recording, phone call (honest capability detection +
   speakerphone/mic fallback), paste transcript.
2. Transcript is visible and editable before the record is created; edited text is canonical.
3. Metadata: agent name (required), agent version, policy version, conversation type.
4. Explicit recording/processing consent before processing.
5. One Gemini request → validated JSON: overall_summary + promises, prices_or_fees,
   dates_or_deadlines, warranties_or_disclosures, cancellations_or_changes; empty when absent,
   never invented; each item carries a verbatim supporting quote.
6. Conversation Receipt: Record ID (RCP-YYYY-NNNNNN), created, capture method, agent, type,
   executive summary, commitment cards, original transcript, SHA-256 hash (mono), verify, export.
7. Verify Integrity shows the real match/mismatch result. Export Evidence generates a PDF.
8. Simple local-style trial: 10 records, count persisted per user; upgrade/pricing screen with
   placeholder plans (no payments).
9. Completely empty for a new user; everything generated from real input.

## Implemented (2026-09-24 — iteration 2)
- ✅ Fixed transcription bug (Whisper received a file handle, not a string path) — recording & call
  transcription now work end-to-end.
- ✅ **Language Support**: Whisper auto-detects language; Gemini returns a `language` field and writes
  the summary/commitments in the conversation's language; shown on the receipt + evidence PDF.
- ✅ **Record Tags & Notes**: optional tags + notes on create, editable on the receipt (PATCH), shown
  on cards/receipt/PDF, searchable, and filterable via a tag chip row on the Records tab (`GET /api/tags`).
- ✅ **Evidence Sharing**: Export Evidence opens the native share sheet (email/AirDrop) on device.
- ✅ **Retry On Fail**: mic + phone screens keep the recording and offer one-tap "Retry Transcription".
- ✅ 12/12 new backend tests + full frontend E2E passing.

## Implemented (2026-09-24 — iteration 1)
- ✅ Google login screen + Emergent OAuth flow (mobile deep-link + web).
- ✅ Home dashboard: tagline, trial pill, Create/View actions, recent records, empty state, why-it-matters.
- ✅ Create flow: method selection → record (expo-audio, permissions handled) / phone
  (capability detection + speakerphone/paste fallback) / paste transcript → Review & Process
  (editable transcript + metadata + consent) → receipt.
- ✅ Backend: auth/session, auth/me, logout, trial, transcribe (Whisper), records CRUD (soft delete),
  Gemini extraction, sequential record IDs, verify, search.
- ✅ Conversation Receipt with verified/mismatch banner, commitment cards + quotes, SHA-256 blocks
  (transcript + audio), copy hash, Verify Integrity, Export Evidence PDF.
- ✅ Records history with search; Account with profile, trial bar, sign out; Pricing (3 plans).
- ✅ 20/20 backend regression tests passing; full frontend E2E verified.

## Backlog / Remaining
- **P1**: Native build to validate real microphone/phone recording on device (not testable in Expo Go/web).
- **P2**: Record-level tags/notes; export as plain-text alongside PDF; date-range filtering on Records.
- **P2**: Optional local audio retention toggle with user-controlled deletion.

## Next Tasks
- Ship as-is for demo; gather feedback on extraction quality and receipt layout.
