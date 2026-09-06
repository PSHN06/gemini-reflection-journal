# Gemini Reflection Journal — Temporal Tapes

## What this is

This application began as the Google AI Studio Build-mode and Cloud Run codelab for multi-turn AI reflection journaling. It was evolved into a secure, evidence-based future-self messaging platform called **Temporal Tapes**. Users write reflections to their future selves, which are sealed and cryptographically protected until longitudinal cognitive telemetry satisfies a deterministic unlock condition. Private reflections remain inaccessible—even to the client application—until objective psychological signals derived from authenticated journaling verify that the intended mindset has been achieved.

## The core innovation

Temporal Tapes solves the problem of premature gratification and arbitrary time-capsules by tying message delivery to evidence of real mental state transitions. Instead of unlocking on an arbitrary date or relying on unverified LLM whims, the system enforces a strict architectural boundary:

> Gemini analyzes. The server validates. The deterministic engine evaluates. Firestore transactions commit. Only the backend unlocks the tape.

Why this matters:
- **Bounded and auditable AI**: Gemini extracts cognitive indicators (stress, focus, creativity scores from 1 to 10 with quotes and confidence), but never makes the unlock decision.
- **Deterministic unlock governance**: Unlock decisions are evaluated by pure mathematical rules with zero LLM or network dependencies.
- **Server-enforced secrecy**: The user's private sealed reflection is never returned by the API until the condition is provably satisfied.

## Architecture overview

```text
  Journal entry
    → POST /api/gemini/telemetry
    → Gemini proposes structured telemetry
    → Server validates and bounds all values
    → Observation written to telemetry ledger
    → POST /api/tapes/:tapeId/evaluate
    → tapeEngine.ts evaluates policy deterministically
    → Firestore transaction commits unlock if condition satisfied
    → Frontend displays unlocked prose only after server confirmation
```

## Tech stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React
- **Backend**: Express backend (TypeScript), running via `tsx` in development and bundled with `esbuild` for production
- **Authentication**: Firebase Authentication (Google Identity Services / Federated popup)
- **Database**: Cloud Firestore with user-scoped isolation (with disk-backed local fallback for offline development)
- **AI Engine**: Google Gemini API (`@google/genai` SDK) with resilient fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`)
- **Container Infrastructure**: Google Cloud Run

## Project structure

The repository is organized around clean separation between LLM inference, server authorization, and pure deterministic evaluation:

```text
server/tapeEngine.ts         — Pure deterministic evaluation engine (zero external dependencies)
server/tapeService.ts        — Tape lifecycle, telemetry ledger, and Firestore transactional operations
server/authMiddleware.ts     — Firebase ID token verification and authenticated user context
server/firebaseAdmin.ts      — Firebase Admin SDK initialization with service account fallback
server/geminiService.ts      — Server-side Gemini integration with fallback ladder and cognitive parsing
server.ts                    — Express HTTP server and authenticated API route definitions
src/components/              — React frontend UI (TemporalTapesView, CreateTapeModal, EntryEditor, etc.)
src/services/tapeService.ts   — Frontend API client for Temporal Tapes
firestore.rules              — Owner-bound Firestore security rules enforcing strict multi-tenant isolation
metadata.json                — Application metadata and permission manifests
```

## Security model

- **Authentication barrier**: All `/api/tapes/*`, `/api/telemetry/*`, and `/api/gemini/*` endpoints require a valid, verified Firebase ID token passed in the `Authorization: Bearer <token>` header.
- **Tenant isolation**: Users can only access, evaluate, or list tapes and telemetry records stored under their own authenticated UID (`/users/{uid}/*`). Cross-tenant access attempts return HTTP 403 or 404.
- **Zero-leakage sealed prose protection**: When a tape is sealed, the backend sanitizes the payload to completely strip `sealedProse`. The secret prose is only returned when the tape status has transitionally reached `unlocked`.
- **Atomic state transitions**: Tape unlock events are committed inside Firestore transactions, verifying pre-conditions and writing cryptographic evaluation proofs atomically.
- **Server-only secret management**: The `GEMINI_API_KEY` is exclusively read on the server side via environment variables or Secret Manager, never exposed to client bundles or browser dev tools.

## Local development

### 1. Clone & install
```bash
git clone <repository-url>
cd gemini-reflection-journal
npm install
```

### 2. Configure environment variables
Create a `.env` file based on `.env.example`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id
```

### 3. Run development server
```bash
npm run dev
```
The full-stack application will be available at `http://localhost:3000`.

### 4. Run verification tests
```bash
npm test
```

## Deployment

The application is containerized and deploys directly to Google Cloud Run:

```bash
gcloud run deploy gemini-reflection-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --labels dev-tutorial=cloud-run-ai-challenge
```

*Note: The deployment preserves the required challenge verification label: `dev-tutorial=cloud-run-ai-challenge`.*

## Running tests

```bash
npm test
```

Current test results: **35 passed, 0 failed**.

The comprehensive test suite verifies:
1. **Deterministic Tape Engine (`server/tapeEngine.test.ts` — 12 tests)**:
   - Positive evaluation over required sustained duration and observation count.
   - Boundary tests for threshold operators (`lte` and `gte`).
   - Single-observation threshold violation rejections.
   - Insufficient sustained duration and insufficient observation counts.
   - Low confidence filtering and handling.
   - Input sanitization for invalid metrics, operators, or out-of-bound values.
   - Bitwise idempotency across repeated runs.
   - Rejection of re-evaluations on already-unlocked tapes (`ALREADY_UNLOCKED`).

2. **Backend Security & Lifecycle (`server/tapeBackend.test.ts` — 23 tests)**:
   - Authentication enforcement on all tape, telemetry, and Gemini routes.
   - Rejection of missing or malformed Bearer tokens.
   - Input validation on condition thresholds, metrics, and sustained days.
   - Zero client-boundary leakage of `sealedProse` while sealed.
   - Strict multi-tenant isolation (User B cannot read or trigger evaluation of User A's tape).
   - Authoritative telemetry ledger recording and condition verification.
   - Transactional unlock and cryptographic proof generation.
   - Irreversibility and idempotency invariants.
   - Full end-to-end vertical slice from reflection to telemetry, tape creation, and conditional unlock.
   - Automatic evaluation: non-blocking evaluation and transactional unlock of sealed tapes upon telemetry recording without requiring manual user evaluation.

## Roadmap

Completed enhancements:
- **Automatic evaluation hook**: Trigger non-blocking tape evaluation immediately when qualifying telemetry is recorded to the ledger.

Planned future enhancements:
- **Eventarc and Cloud Tasks**: Asynchronous event-driven evaluation pipeline for high-scale journaling.
- **Private Cloud Run background worker**: Decoupled background service for continuous temporal analytics.
- **Scheduled evaluation**: Periodic cron-based evaluation for duration-dependent conditions.
- **Notifications**: Secure browser and email notifications when a Temporal Tape unlocks.
