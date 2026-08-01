# Pew — Project Conception

**What it is:** an Android AI-assistant app that can chat, speak, and — once connected to a user's own apps and their own AI provider keys — take real actions on their behalf (send an email, post a message, etc.), always with an explicit approval step before anything happens.

This document is the single reference for what Pew is, how it's built, and why each major decision was made the way it was. Anything not written here should be treated as undecided, not assumed.

---

## 1. Feature scope

### v1 (in scope for the three sprints)
- Chat interface: talk to the model in plain conversation, or ask it to perform actions
- Connect to external apps and let the AI act through them (e.g. send an email, then act on the reply)
- Multiple AI models, using the user's own API key per provider (bring-your-own-key, not a shared backend key)
- Persistent chat history, stored locally on-device
- Two-way voice: speech input and spoken replies
- Visibility into remaining/used tokens per model
- Action confirmation layer — the AI proposes, the user approves, before anything executes
- Secure credential storage — keys and tokens never touch the local database
- Cost/budget guardrails — hard caps on chained AI actions and daily request volume

### Explicitly deferred (not in v1, listed so they don't creep in)
- Making Pew the Android system assistant (`VoiceInteractionService`) — real native-Android effort, planned for v1.1, independent of everything else
- Live coding via a connected GitHub repo
- Notifications, to-do list, and calendar features
- Multi-model conversations (one chat is locked to one model for v1 — see schema notes)
- Cost shown in real currency (token counts only, for now — pricing changes too often to hardcode)
- Per-app rate-limit tracking (e.g. Gmail/Messenger quotas)
- Biometric app lock

### Design
- Brand colors: green `#22C55E` (primary) and light blue `#38BDF8` (accent)
- Modern UI with smooth animation, built with NativeWind

---

## 2. Architecture

Pew is two separate pieces, not one:

```
Pew Android app  <--HTTP-->  Backend server  <--HTTP-->  LLM providers + action APIs (Gmail, GitHub, ...)
(React Native)                (Node + Express)
```

**Why a backend exists at all** (this was a deliberate decision, not a default):
1. **OAuth.** Gmail/GitHub-style integrations issue refresh tokens meant to be exchanged by a confidential server-side client — not held loose on a phone.
2. **"Wait and react" behavior.** The app's own example use case — *"send an email, then act when they reply"* — requires something watching for an event that may arrive hours later. A phone app can't reliably do that; it gets backgrounded or killed. A small always-on server can.
3. **Enforceable budget guardrails.** A limit enforced only on-device can be bypassed by reinstalling the app. Enforced server-side, it's real.

The backend is otherwise intentionally thin: it holds no chat state of its own. Every chat request carries its own full history, model choice, and API key from the phone. The backend is stateless for secrets — it receives a credential per request and never persists it.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile framework | React Native (TypeScript) + Expo | No Android Studio/SDK needed locally; matches the team's existing React knowledge |
| Styling | NativeWind | Tailwind syntax, no native dependency, works in Expo Go |
| Local storage | SQLite (`expo-sqlite`) | On-device chat history, works in Expo Go, no server round-trip needed to read history |
| Secure credential storage | Android Keystore via `expo-secure-store` | Hardware-backed, unlike a plain database file |
| Voice output (TTS) | `expo-speech` | On-device, free, works in Expo Go, no API key |
| Voice input (STT) | `@react-native-voice/voice` (Android's native `SpeechRecognizer`) | Free, works offline, no per-minute API cost — chosen over cloud STT APIs specifically to keep voice free |
| Backend | Node.js + TypeScript + Express | Same language as the frontend; minimal footprint |
| Dev preview | Expo Go, moving to a custom dev client once STT's native module is added | Expo Go can't load arbitrary native modules; the dev client is a one-time build via the same GitHub Actions pipeline |
| Build pipeline | GitHub Actions (`expo prebuild` + Gradle), no local Android Studio | Signed release APK produced entirely on GH-hosted runners |
| Package manager | pnpm (or npm) | Installs are per-project by design (Node has no real global dependency model for app code); pnpm just hard-links shared packages to save disk |

**Android package id:** placeholder `com.yourname.pew` in `app.json` — pick the real one once and never change it, it's the app's permanent identity.

**Build secrets required in the GitHub repo** (one-time setup): `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

---

## 4. Security principles

These are non-negotiable design rules established across this project, not suggestions:

1. **No secret ever lives in SQLite.** Not an API key, not an OAuth token. They live only in Android Keystore, referenced by a deterministic lookup name (e.g. `apikey_<app id>`).
2. **The backend never persists a credential.** It receives one as part of a request, uses it for that single upstream call, and discards it.
3. **Every action requires explicit approval.** The AI can propose a tool call; nothing executes until the user approves it in the UI.
4. **Files live in app-private storage only**, at a fixed path resolved in code (`FileSystem.documentDirectory`), never a public directory — with a uniquely generated filename per attachment, so two recordings can never silently overwrite each other.
5. **Settings that affect backend behavior are sent per-request, not read directly from the phone's local database** — the backend has no access to the phone's filesystem at all; this was corrected after an earlier draft implied otherwise.
6. **Static metadata (docs URLs, icons) lives in a constants file, not the database** — avoids schema churn for things that aren't user data.

---

## 5. Database (SQLite, on-device, no login)

Full current schema — see the delivered `.sql` files for exact `CREATE TABLE` statements; this is the conceptual summary.

**Status/lookup tables:** `status_chat` (active/archived/deleted), `status_message` (active/deleted), `status_tool_call` (pending/approved/rejected/completed/failed).

**Registry:** `apps` — every integration and every AI provider, one flat table, distinguished by `auth_type` (`api_key`/`oauth`). `providers` is a subtype table (one row per AI-capable app) holding `api_base_url` — an app is an AI provider *if and only if* a row exists for it in `providers`; there is no boolean flag duplicating that fact anywhere.

**Models:** `ai_models` is a live cache, not a static list — populated by calling each provider's own model-listing endpoint, never hardcoded, because provider lineups change on their own schedule. Tracks `raw_name` (stable id), `display_name`, `is_available`, and `fetched_at`.

**Conversation:** `chat` (currently locked to one `id_model` per chat — an explicit MVP constraint to keep token accounting and context-window handling simple; revisit later if multi-model chat is wanted) and `messages`, with `role` in `('user','ai','tool')` — the `tool` role holds the result of an executed (or rejected) action, fed back into the LLM's context so it can respond intelligently to what happened.

**Actions:** `tool_calls` stores what the AI requested (audit only — the result lives in the `messages` table as a `tool` row, not duplicated here). `historique_tool_calls_status` tracks the approval lifecycle over time.

**Everything mutable has a history table**, not a status column on the entity itself: `historique_apps_status`, `historique_chat_status`, `historique_message_status`, `historique_tool_calls_status`. Current state is always "the latest row for this id," exposed through a `current_*_status` view so application code never hand-writes that subquery.

**Accounting:** `historique_token_usage` logs input/output tokens per model per chat, keyed by the model's stable integer id (not its name) so a provider renaming a model doesn't break historical reports. Deliberately stores raw tokens, not cost — cost is computed at read time from a separate pricing source, since prices change more often than the schema should.

**Attachments:** pure linkage — `id_message` + `file_name` only. No path, no mime type, no duration stored; those are derived in application code from a fixed storage convention, kept in one shared utility rather than repeated per screen.

**Settings:** local user preferences (e.g. `require_confirmation`, `max_tool_calls_per_turn`, `max_requests_per_day`, `voice_output_enabled`), read by the app and forwarded to the backend inside each relevant request — never read by the backend directly.

**Known fix required before running the schema:** the `attachments` table as originally drafted had a trailing comma after `file_name TEXT NOT NULL,)` — invalid SQLite syntax, must be removed.

---

## 6. Backend responsibilities

- **Credential verification** — given an app + credential, makes one real call to confirm it works; returns pass/fail only, stores nothing
- **OAuth token exchange** — trades an authorization code for tokens using a backend-held client secret; returns tokens to the phone, keeps none
- **Model discovery/sync** — calls a provider's own model list endpoint on demand; the phone caches the result locally
- **Chat completion** — a single provider-abstraction entry point that branches per vendor internally, so callers never touch vendor-specific request shapes directly
- **Budget guardrails** — enforced server-side because a phone-only limit can be bypassed by reinstalling the app
- **Agent loop / tool calling** — sends available tools to the model, and on a tool request returns a *pending* state rather than executing immediately
- **Approve/reject endpoints** — the only two ways a proposed action actually runs; both produce a result the phone turns into a `role='tool'` message so the AI always gets a definite answer
- **Chained-call guardrail** — hard cap on how many tool calls one user turn can trigger before the loop is forced to stop and return a partial answer

---

## 7. Project plan

Three sprints, frontend and backend built in lockstep within each (backend endpoint before its frontend counterpart, not all-backend-then-all-frontend):

1. **Sprint 1 — app/AI connections.** Browse, search/filter, and connect apps and AI providers; explicit approve/fail feedback on every connection attempt; nothing sensitive ever touches SQLite.
2. **Sprint 2 — basic chatbot.** Full conversation loop with persistent history and two-way voice, but the backend is hard-restricted from offering any tools — a request it genuinely cannot fulfill gets an honest "not available yet" rather than a silent failure.
3. **Sprint 3 — AI and apps talking.** Tool calling goes live behind the mandatory approval flow, with a hard ceiling on chained actions per turn.

Full sub-step breakdown lives in `STEPS.md`.

---

## 8. Open items — not yet decided

- **MCP server integration** — planned as the standard way to expose app tools to the AI without hand-integrating every API, prioritizing free options. Not yet designed; a dedicated discussion is still pending.
- Exact list of which apps ship connectors in Sprint 3 beyond the ones already seeded
- Real Android package id (currently a placeholder)
- Whether `pnpm` or `npm` is the team's final default (both work identically against the same `package.json`)

---