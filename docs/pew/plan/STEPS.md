# Pew — Project Steps

This document breaks the project into two parts — **Frontend (the Pew app)** and **Backend (the Express server)** — each divided into the three sprints already agreed on. Steps describe logic only (what function or class does what, and why) — no code.

**Dependency note:** within a sprint, the relevant Backend endpoint should exist (even as a stub returning fake data) before the matching Frontend step is built against it. Build backend-first, sprint by sprint, not all-backend-then-all-frontend.

**Simplicity rule for this whole plan:** every step below does exactly one thing. If while implementing a step you find yourself wanting to also handle a second concern, that's a sign to split it into its own step rather than fold it in — that's what "keep the workflow simple" means in practice.

---

## Part 1 — Frontend (Pew mobile app)

### Sprint 1: Integration of native apps

1.1 **Local database setup** — run the agreed SQLite schema on first app launch. A single migration-runner function checks a stored schema-version number and applies missing migrations in order, so re-running it later never duplicates tables.

1.2 **Seed the apps registry** — on first launch, insert the known list of apps (Gmail, WhatsApp, Messenger, OpenAI, Anthropic, DeepSeek, etc.) into `apps`, and the AI ones into `providers`. This list lives in a constants file, not fetched remotely — it's your own registry, not user data.

1.3 **Secure storage wrapper module** — a small set of functions (`saveApiKey`, `getApiKey`, `deleteApiKey`) wrapping Android Keystore access. Every other screen that needs a credential goes through this module — nothing reads Keystore directly.

1.4 **Apps/AIs list screen** — a function that reads `apps` joined with `current_app_status` (for the enabled/disabled badge) and the `providers` table (to tell AI rows from integration rows), and renders them as a single list.

1.5 **Search and filter logic** — a pure function that takes the loaded list plus a search string and a set of active filters (enabled/disabled, AI/app) and returns the filtered subset. Runs entirely in memory against the already-loaded list — no new query per keystroke.

1.6 **App detail view** — opens on tapping a list item. Shows: an enable/disable toggle, a "How to enable this?" link (URL pulled from the same constants file as 1.2, not the database), and a "Connect" action.

1.7 **Credential entry modal** — for `auth_type = 'api_key'` apps: a text field plus a "Connect" button. For `auth_type = 'oauth'` apps: the button instead opens a browser-based consent flow.

1.8 **Connection verification flow** — on "Connect," the app calls the backend's verification endpoint (Backend 1.1) with the entered credential and waits for a pass/fail result before doing anything else.

1.9 **On verification success** — store the credential via the module from 1.3, insert a row into `historique_apps_status` marking the app enabled, and show a one-time success message (a transient toast, not a stored record).

1.10 **On verification failure** — show an inline "verify your credentials" message on the modal itself. Nothing is stored, and the app's status is left untouched.

1.11 **OAuth completion handling** — for OAuth apps, after the browser consent step, the app receives tokens back from the backend's exchange endpoint (Backend 1.2) and stores them the same way as an API key (1.9), just as a token pair instead of a single string.

**Sprint 1 is done when:** a user can see the full apps/AI list, filter it, connect or fail to connect to at least one API-key app and one OAuth app, and toggle any app's enabled state — with nothing sensitive ever touching the SQLite file.

---

### Sprint 2: Basic chatbot

2.1 **Chat list screen** — reads `chat` joined with `current_chat_status`, ordered by creation order, excluding deleted chats.

2.2 **New chat creation** — a function that creates a `chat` row, requiring an enabled AI model to be selected first (pulled from `ai_models` for apps with `providers` rows and an enabled status).

2.3 **Chat screen — load history** — reads all `messages` for the current `id_chat`, ordered by creation order, and renders them by `role`.

2.4 **Send message flow** — a function that: inserts the user's message locally, sends the full message history plus the selected model's provider and stored API key to the backend's chat endpoint (Backend 2.1), then inserts the returned reply as a new `role='ai'` message.

2.5 **No-tool guarantee, frontend side** — the send-message flow in this sprint never includes an enabled-apps list in the request, so the backend has nothing to call tools with. No special handling needed here — it falls out naturally from what's sent.

2.6 **Voice input** — a record function using the on-device microphone; on stop, the recognized text populates the message input field before sending (implementation detail of on-device vs. dev-client recognizer to be finalized separately).

2.7 **Voice output** — after inserting an AI reply, a function passes its text to the on-device speech synthesizer, gated by a user-toggleable setting so it isn't forced on every reply.

2.8 **Chat management actions** — rename, archive, and delete each map to a single function that inserts the appropriate `historique_chat_status` row (or updates the `chat.name` field for rename); no chat is ever hard-deleted, only marked.

2.9 **Token usage display** — after each reply, the backend's returned token counts are inserted into `historique_token_usage`. A separate read-only function aggregates these per model to drive the "tokens used/left" indicator.

**Sprint 2 is done when:** a user can hold a full back-and-forth conversation with voice in and out, see it persist across app restarts, and see a token counter update — with zero tool-calling behavior possible yet.

---

### Sprint 3: AI and apps talking

3.1 **Enabled-apps context builder** — before sending a message, a function collects the currently-enabled integration apps (from `current_app_status`) and includes that list in the request to the backend, replacing the "nothing sent" behavior from 2.5.

3.2 **Pending tool-call rendering** — when a backend response includes a pending tool call instead of a plain reply, the chat screen renders a distinct approval card (action name + a plain-language summary of what it would do) instead of a normal message bubble.

3.3 **Approve action** — calls the backend's approve endpoint (Backend 3.4) with the tool call's id; on response, inserts the returned `role='tool'` message and lets the flow continue to the AI's next reply.

3.4 **Reject action** — calls the backend's reject endpoint (Backend 3.5); on response, inserts the synthetic rejection `role='tool'` message the same way, so the AI always gets a definite answer either way.

3.5 **Tool-call status reflection** — the approval card's visual state (pending/approved/completed/failed) is driven by `current_tool_call_status`, re-read after every approve/reject action so the UI never shows a stale state.

**Sprint 3 is done when:** a user can ask the assistant to do something in a connected app, see a clear approval step before anything happens, approve or reject it, and see the AI acknowledge the outcome in the conversation.

---

## Part 2 — Backend (Express server)

### Sprint 1: Integration of native apps

1.1 **Credential verification endpoint** — accepts an app identifier and a credential (key or OAuth code), performs one lightweight authenticated call against that provider/app (e.g. list models for an AI provider, fetch profile for an OAuth app), and returns pass/fail only. Never writes the credential anywhere.

1.2 **OAuth exchange endpoint** — accepts an authorization code, exchanges it for access/refresh tokens using the backend-held client secret for that app, and returns the tokens to the caller. The backend holds no memory of them afterward.

1.3 **Model discovery endpoint** — accepts a provider identifier and its key, calls that provider's model-listing endpoint, and returns the raw list back to the caller for the phone to cache locally. The backend doesn't persist this either.

**Sprint 1 is done when:** every verification/exchange/discovery call this sprint's frontend needs has a real (or realistically stubbed) endpoint, and none of them retain any credential in memory past the single request.

---

### Sprint 2: Basic chatbot

2.1 **Chat completion endpoint** — accepts a message, the full conversation history, the target provider, model, and API key, all supplied fresh by the phone on every call (the backend holds no chat state of its own).

2.2 **Provider abstraction layer** — one internal interface with a single entry point (e.g. "get a completion for these messages from this provider") that internally branches per provider (OpenAI, Anthropic, DeepSeek, …), so the endpoint above never has provider-specific logic in it directly.

2.3 **Hard no-tools rule** — this sprint's version of the provider abstraction never attaches a tools/functions definition to the outgoing LLM request, regardless of what's in the payload. This guarantees the "sorry, not available yet" behavior server-side rather than relying on the frontend to withhold it.

2.4 **Token accounting passthrough** — the provider's own reported input/output token counts are extracted from its response and included in the endpoint's return value, for the phone to log.

2.5 **Basic budget guard** — a check at the top of the chat endpoint that rejects the request outright if a configured per-day or per-chat call limit (read from the `settings` value sent by the phone) has already been hit.

**Sprint 2 is done when:** the chat endpoint reliably answers through any configured provider, never attempts a tool call under any input, and enforces a hard call ceiling.

---

### Sprint 3: AI and apps talking

3.1 **Tool schema builder** — a function that takes the list of enabled apps sent by the phone and produces the corresponding tool definitions to attach to the outgoing LLM request. Apps with no matching tool integration are simply skipped, not errored on.

3.2 **Action connector layer** — one module per integrated app (or one shared MCP client where applicable, detailed separately) responsible only for actually performing an approved action — sending the Gmail, posting the message, etc. Nothing above this layer talks to a third-party API directly.

3.3 **Agent loop controller** — the core function of this sprint: sends the message and available tools to the LLM; if the LLM's response is a tool request, it does **not** call the connector layer yet — it stores the request (`tool_calls`, status `pending`) and returns that pending state to the phone instead.

3.4 **Approve endpoint** — given a tool call id, invokes the matching module from 3.2, records the outcome (`completed` or `failed`), and returns a result suitable for the phone to insert as a `role='tool'` message.

3.5 **Reject endpoint** — given a tool call id, records status `rejected` and returns a fixed rejection payload, so the frontend always has something concrete to insert as the `role='tool'` message.

3.6 **Chained-call guardrail** — inside the agent loop controller, a running counter caps how many tool calls can chain within a single user turn; once hit, the loop stops and returns whatever answer the AI can give plus a note that the limit was reached, rather than looping indefinitely.

**Sprint 3 is done when:** the AI can propose an action, nothing executes without an explicit approve call, every approve/reject produces a message the AI can react to, and no single user turn can trigger unbounded tool calls.

---

## What's deliberately left out of this plan

- **MCP server integration details** — Sprint 3's "action connector layer" (3.2) is where MCP will plug in, but the actual client setup, server choices, and free-tier options are a separate discussion, not covered here.
- **Multi-model chats, cost-in-currency display, rate-limit tracking, notifications, biometric lock** — all flagged as future-proofing in the DB migration guide, intentionally not part of these three sprints.