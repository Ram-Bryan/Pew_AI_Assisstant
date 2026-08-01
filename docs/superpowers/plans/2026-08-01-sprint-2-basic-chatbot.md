# Sprint 2 — Basic Chatbot (Pew) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user hold a full back-and-forth conversation with a seeded AI provider — chat list, new chat from an enabled model, history that persists across restarts, voice output, rename/archive/delete, and a per-model token counter — with zero tool-calling possible yet. (Voice input is deferred: it requires a dev-client native module and this project runs Expo Go only.)

**Architecture:** The phone keeps all chat state in on-device SQLite (`chat`, `messages`, `historique_chat_status`, `historique_token_usage`); the backend stays stateless — a single `POST /api/chat/completions` receives the full history + provider id + model + API key fresh on every call, delegates to a per-provider completion client (OpenAI-compatible / Anthropic / Gemini / Cohere), extracts the provider's own token counts, and enforces an in-memory daily call budget read from the phone-sent setting. Voice output uses `expo-speech` (already installed, works in Expo Go). Voice input is deferred: `expo-speech-recognition` needs a custom dev client, and this project runs Expo Go only — no `npx expo run:android`.

**Tech Stack:** React Native + Expo SDK 57, expo-router, NativeWind 4, expo-sqlite, expo-secure-store, expo-speech, React Query (frontend); Express 4 + TypeScript, zod, openai SDK (backend).

## Global Constraints

- **Prerequisite:** Sprint 1 must be complete — DB migrated + seeded (`apps`, `providers`, `status_*`, `settings`), `src/services/api.ts`, `src/domains/apps/secureStorage.ts`, and the apps registry constants exist. This plan only references those.
- **Build order:** backend endpoints ship before the frontend features that consume them.
- **Backend holds no chat state** — history, model, and API key are supplied fresh per request and discarded after (CONCEPTION §4.2, Backend 2.1). The chat `settings` value affecting backend behavior is sent by the phone per-request (CONCEPTION §4.5).
- **No secret ever lives in SQLite** — the API key is read from Android Keystore (`apikey_<appId>` via `getApiKey`, Sprint 1) and sent only over the wire (CONCEPTION §4.1).
- **Hard no-tools rule, server-side (Backend 2.3):** the chat request schema only accepts message `role` in `('user','ai')` and is `.strict()` (extra fields rejected), and the provider clients never attach a tools/functions definition — regardless of what the phone sends.
- **No-tool guarantee, frontend-side (Frontend 2.5):** the send-message flow never includes an enabled-apps list in the request — it falls out naturally from what's built; no special code required beyond not building it.
- **Budget guard (Backend 2.5):** in-memory counter keyed by UTC day; `POST /api/chat/completions` returns 429 `budget_exceeded` when the phone-sent `max_requests_per_day` (seeded `200`) is already spent. Reset at midnight automatically; no persistence (user decision).
- **Expo Go only (user decision):** never run `npx expo run:android` and never add `expo-dev-client` / `expo-speech-recognition`. Voice output (`expo-speech`) works in Expo Go and ships this sprint (Task 7). Voice input/STT is deferred — it requires a custom dev client, out of scope until a future release-APK sprint. No Android toolchain (JDK/SDK/Gradle) is downloaded.
- **TypeScript `strict: true`** in both packages.
- **Verification commands:** root `npx tsc --noEmit`; backend `pnpm --dir backend exec tsc --noEmit`.
- **No automated test framework** (user decision) — every task's verification is typecheck + a concrete manual QA step.
- **No code comments** (AGENTS.md code style).
- **Package manager:** pnpm. Backend port `3000`, binds `0.0.0.0`.
- **Commit only when the user asks** (`.agent/config.yml` `auto_commit: false`); messages follow `feat:`/`chore:` style.
- **Execution context:** run this in an isolated worktree created via superpowers:using-git-worktrees at execution time.

## File Structure

**Backend (create):**
- `backend/src/domains/chat/types.ts` — endpoint zod schemas + `ChatCompletionRequest`
- `backend/src/domains/chat/budget.ts` — in-memory daily counter
- `backend/src/domains/chat/service.ts` — `completeChat` (budget → provider client)
- `backend/src/domains/chat/routes.ts` — `POST /api/chat/completions`

**Backend (modify):**
- `backend/src/domains/providers/types.ts` — add `ProviderChatMessage`, `ChatCompletionParams`, `ChatCompletionResult`
- `backend/src/domains/providers/clients.ts` — add `chatCompletion` + 4 per-provider implementations
- `backend/src/server.ts` — mount chat router

**Frontend (create):**
- `src/domains/chat/types.ts` — `ChatWithStatus`, `ChatMessage`, `EnabledModel`, `ChatCompletionReply`, `TokenUsageRow`
- `src/domains/chat/store.ts` — all DB access functions
- `src/domains/chat/api.ts` — `sendChatCompletion`
- `src/domains/chat/hooks.ts` — React Query hooks
- `src/domains/chat/components/ChatList.tsx`, `ModelPicker.tsx`, `MessageBubble.tsx`, `ChatInput.tsx`, `TokenUsageBar.tsx`
- `src/domains/voice/tts.ts` — voice output
- `src/domains/settings/store.ts`, `src/domains/settings/hooks.ts` — setting read/write

**Frontend (modify):**
- `app/(tabs)/index.tsx` — replace placeholder with chat list
- `app/chat/[id].tsx` — chat screen (empty stub)
- `app/(tabs)/settings.tsx` — replace placeholder with voice-output toggle
- `src/domains/chat/hooks.ts` — voice output call in send flow (Task 7)

**Untouched in this sprint:** `backend/src/domains/apps/*`, `backend/src/shared/db.ts`, `src/domains/apps/*`, `src/domains/providers/api.ts`, all `src/domains/chat` tool-call surfaces, `src/domains/apps` (Sprint 3 reserved). No `tools`, no `tool_calls`, no `tool` messages anywhere.

---

### Task 1: Backend chat completion endpoint + provider abstraction (Backend 2.1–2.4)

**Files:**
- Create: `backend/src/domains/chat/types.ts`, `backend/src/domains/chat/service.ts`, `backend/src/domains/chat/routes.ts`
- Modify: `backend/src/domains/providers/types.ts`, `backend/src/domains/providers/clients.ts`, `backend/src/server.ts`

**Interfaces:**
- Consumes: `validate`, `HttpError` (Sprint 1 Task 2); `PROVIDER_CONFIGS` + `OpenAI` client in `clients.ts` (Sprint 1 Task 3)
- Produces:
  - `POST /api/chat/completions` — body `{ id_app: number, model: string, api_key: string, messages: Array<{ role: 'user' | 'ai'; content: string }>, settings?: { max_requests_per_day: number } }` → `{ reply: string, tokens_input: number, tokens_output: number }`
  - `export interface ProviderChatMessage { role: 'user' | 'ai'; content: string }` (providers/types.ts)
  - `export interface ChatCompletionParams { id_app: number; model: string; api_key: string; messages: ProviderChatMessage[] }` (providers/types.ts)
  - `export interface ChatCompletionResult { reply: string; tokens_input: number; tokens_output: number }` (providers/types.ts)
  - `export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>` (clients.ts) — 404 `unknown_app` for non-provider ids (`4,5,6` are OAuth apps)
  - No-tools enforcement: `chatMessageSchema` is `.strict()` with role enum `['user','ai']` — `tool`/`function` roles and extra keys (`tool_calls`) → 400

- [ ] **Step 1: Add chat types to providers types** — `backend/src/domains/providers/types.ts` (append below `ModelInfo`)

```ts
export interface ProviderChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface ChatCompletionParams {
  id_app: number;
  model: string;
  api_key: string;
  messages: ProviderChatMessage[];
}

export interface ChatCompletionResult {
  reply: string;
  tokens_input: number;
  tokens_output: number;
}
```

- [ ] **Step 2: Add chat completion to provider clients** — `backend/src/domains/providers/clients.ts`. Keep all existing content (Sprint 1). Add the import and the functions below.

```ts
import type { ChatCompletionParams, ChatCompletionResult } from './types';
```

```ts
async function completeOpenAiCompatible(
  baseUrl: string,
  params: ChatCompletionParams
): Promise<ChatCompletionResult> {
  const client = new OpenAI({ apiKey: params.api_key, baseURL: baseUrl });
  const res = await client.chat.completions.create({
    model: params.model,
    messages: params.messages.map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    })),
  });
  return {
    reply: res.choices[0]?.message?.content ?? '',
    tokens_input: res.usage?.prompt_tokens ?? 0,
    tokens_output: res.usage?.completion_tokens ?? 0,
  };
}

async function completeAnthropic(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.api_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 1024,
      messages: params.messages.map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      })),
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const body = (await res.json()) as {
    content?: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    reply: (body.content ?? []).map((c) => c.text ?? '').join(''),
    tokens_input: body.usage?.input_tokens ?? 0,
    tokens_output: body.usage?.output_tokens ?? 0,
  };
}

async function completeGemini(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${params.api_key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: params.messages.map((m) => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return {
    reply: parts.map((p) => p.text ?? '').join(''),
    tokens_input: body.usageMetadata?.promptTokenCount ?? 0,
    tokens_output: body.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function completeCohere(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const history = params.messages.slice(0, -1).map((m) => ({
    role: m.role === 'ai' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));
  const last = params.messages[params.messages.length - 1];
  const res = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${params.api_key}`,
    },
    body: JSON.stringify({
      model: params.model,
      message: last?.content ?? '',
      chat_history: history,
    }),
  });
  if (!res.ok) throw new Error(`cohere ${res.status}`);
  const body = (await res.json()) as {
    text?: string;
    meta?: { tokens?: { input_tokens?: number; output_tokens?: number } };
  };
  return {
    reply: body.text ?? '',
    tokens_input: body.meta?.tokens?.input_tokens ?? 0,
    tokens_output: body.meta?.tokens?.output_tokens ?? 0,
  };
}

export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const config = PROVIDER_CONFIGS[params.id_app];
  if (!config) throw new HttpError(404, 'unknown_app');
  switch (config.kind) {
    case 'openai_compatible':
      return completeOpenAiCompatible(config.baseUrl, params);
    case 'anthropic':
      return completeAnthropic(params);
    case 'gemini':
      return completeGemini(params);
    case 'cohere':
      return completeCohere(params);
  }
}
```

- [ ] **Step 3: Write endpoint schemas** — `backend/src/domains/chat/types.ts`

```ts
import { z } from 'zod';

export const chatMessageSchema = z
  .object({
    role: z.enum(['user', 'ai']),
    content: z.string(),
  })
  .strict();

export const chatCompletionRequestSchema = z.object({
  id_app: z.number().int().positive(),
  model: z.string().min(1),
  api_key: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  settings: z
    .object({
      max_requests_per_day: z.number().int().nonnegative(),
    })
    .default({ max_requests_per_day: 0 }),
});

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;
```

- [ ] **Step 4: Write service** — `backend/src/domains/chat/service.ts`

```ts
import { chatCompletion } from '../providers/clients';
import type { ChatCompletionResult } from '../providers/types';
import type { ChatCompletionRequest } from './types';

export async function completeChat(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  return chatCompletion({
    id_app: req.id_app,
    model: req.model,
    api_key: req.api_key,
    messages: req.messages,
  });
}
```

(Budget guard is added in Task 2.)

- [ ] **Step 5: Write routes and mount** — `backend/src/domains/chat/routes.ts` + `backend/src/server.ts`

```ts
import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { chatCompletionRequestSchema } from './types';
import type { ChatCompletionRequest } from './types';
import * as service from './service';

export const chatRouter = Router();

chatRouter.post('/completions', validate(chatCompletionRequestSchema), async (req, res, next) => {
  try {
    res.json(await service.completeChat(req.body as ChatCompletionRequest));
  } catch (err) {
    next(err);
  }
});
```

In `backend/src/server.ts`, add after the existing routers:

```ts
import { chatRouter } from './domains/chat/routes';
// ...
app.use('/api/chat', chatRouter);
```

- [ ] **Step 6: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual QA**

Run: `pnpm --dir backend dev`, then:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/chat/completions -Method Post -ContentType 'application/json' -Body '{"id_app":1,"model":"gpt-4o-mini","api_key":"sk-invalid","messages":[{"role":"user","content":"Say hi"}]}'
```

Expected: HTTP 500 `{ error: '...' }` (OpenAI auth failure). With a valid OpenAI key: `{ reply: '...', tokens_input: N, tokens_output: M }`.

No-tools schema checks (should 400):
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/chat/completions -Method Post -ContentType 'application/json' -Body '{"id_app":1,"model":"gpt-4o-mini","api_key":"sk-x","messages":[{"role":"tool","content":"x"}]}'
Invoke-RestMethod -Uri http://localhost:3000/api/chat/completions -Method Post -ContentType 'application/json' -Body '{"id_app":1,"model":"gpt-4o-mini","api_key":"sk-x","messages":[{"role":"user","content":"hi","tool_calls":[]}]}'
```

Expected: both 400 with a zod error. OAuth id: `{"id_app":4,...}` → 404 `{ error: 'unknown_app' }`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/domains/chat backend/src/domains/providers backend/src/server.ts
git commit -m "feat: add stateless chat completion endpoint with per-provider clients"
```

---

### Task 2: Backend budget guard (Backend 2.5)

**Files:**
- Create: `backend/src/domains/chat/budget.ts`
- Modify: `backend/src/domains/chat/service.ts`

**Interfaces:**
- Consumes: `ChatCompletionRequest` (Task 1), `HttpError`
- Produces:
  - `export function tryConsumeBudget(maxPerDay: number): boolean` — `false` when the UTC day's counter already reached `maxPerDay`; otherwise increments and returns `true`. `maxPerDay <= 0` means unlimited. Resets daily via the date key.
  - `completeChat` now returns 429 `budget_exceeded` when `tryConsumeBudget(req.settings.max_requests_per_day)` is `false`

- [ ] **Step 1: Write budget module** — `backend/src/domains/chat/budget.ts`

```ts
const dayCounts = new Map<string, number>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function tryConsumeBudget(maxPerDay: number): boolean {
  if (maxPerDay <= 0) return true;
  const key = todayKey();
  const count = dayCounts.get(key) ?? 0;
  if (count >= maxPerDay) return false;
  dayCounts.set(key, count + 1);
  return true;
}
```

- [ ] **Step 2: Wire into service** — `backend/src/domains/chat/service.ts`

```ts
import { HttpError } from '../../shared/middleware/error';
import { chatCompletion } from '../providers/clients';
import type { ChatCompletionResult } from '../providers/types';
import { tryConsumeBudget } from './budget';
import type { ChatCompletionRequest } from './types';

export async function completeChat(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  if (!tryConsumeBudget(req.settings.max_requests_per_day)) {
    throw new HttpError(429, 'budget_exceeded');
  }
  return chatCompletion({
    id_app: req.id_app,
    model: req.model,
    api_key: req.api_key,
    messages: req.messages,
  });
}
```

- [ ] **Step 3: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `pnpm --dir backend dev`, then send the same valid request with `"settings":{"max_requests_per_day":1}` twice:

```powershell
$body = '{"id_app":1,"model":"gpt-4o-mini","api_key":"<VALID_KEY>","messages":[{"role":"user","content":"hi"}],"settings":{"max_requests_per_day":1}}'
Invoke-RestMethod -Uri http://localhost:3000/api/chat/completions -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod -Uri http://localhost:3000/api/chat/completions -Method Post -ContentType 'application/json' -Body $body
```

Expected: first succeeds, second → HTTP 429 `{ error: 'budget_exceeded' }`. Without `settings` → unlimited (succeeds).

- [ ] **Step 5: Commit**

```bash
git add backend/src/domains/chat
git commit -m "feat: add in-memory daily request budget guard"
```

---

### Task 3: Frontend chat types + store (Frontend 2.1/2.2/2.3/2.8/2.9 data layer)

**Files:**
- Create: `src/domains/chat/types.ts`, `src/domains/chat/store.ts`

**Interfaces:**
- Consumes: `getDb` (Sprint 1 Task 6), `expo-sqlite`
- Produces (exported names used by later tasks):
  - `export type MessageRole = 'user' | 'ai' | 'tool'`
  - `export interface ChatWithStatus { id: number; name: string; id_model: number; created_at: number; id_status: number | null }`
  - `export interface ChatMessage { id: number; id_chat: number; content: string | null; role: MessageRole; created_at: number }`
  - `export interface EnabledModel { id: number; raw_name: string; display_name: string | null; provider_name: string; id_app: number }`
  - `export interface ChatCompletionReply { reply: string; tokens_input: number; tokens_output: number }`
  - `export interface TokenUsageRow { id_model: number; model_name: string; tokens_input: number; tokens_output: number }`
  - `export async function listChats(db): Promise<ChatWithStatus[]>` — `chat` LEFT JOIN `current_chat_status`, excluding `id_status = 3` (deleted), ordered by `created_at`
  - `export async function createChat(db, name, modelId): Promise<number>` — insert `chat` + an `active` (status 1) `historique_chat_status` row; returns the new chat id
  - `export async function getChat(db, chatId): Promise<ChatWithStatus | null>`
  - `export async function listMessages(db, chatId): Promise<ChatMessage[]>` — ordered by `created_at`
  - `export async function insertMessage(db, chatId, role, content): Promise<void>` — insert `messages` + an `active` (status 1) `historique_message_status` row
  - `export async function renameChat(db, chatId, name): Promise<void>` — `UPDATE chat SET name`
  - `export async function setChatStatus(db, chatId, statusId): Promise<void>` — insert a `historique_chat_status` row (archive = 2, delete = 3); never hard-deletes
  - `export async function listEnabledModels(db): Promise<EnabledModel[]>` — `ai_models` JOIN `providers` JOIN `apps` JOIN `current_app_status`, only available models of enabled apps
  - `export async function insertTokenUsage(db, modelId, tokensInput, tokensOutput, chatId): Promise<void>`
  - `export async function aggregateTokenUsageToday(db): Promise<TokenUsageRow[]>` — per-model sum of today's input/output tokens

- [ ] **Step 1: Write types**

```ts
export type MessageRole = 'user' | 'ai' | 'tool';

export interface ChatWithStatus {
  id: number;
  name: string;
  id_model: number;
  created_at: number;
  id_status: number | null;
}

export interface ChatMessage {
  id: number;
  id_chat: number;
  content: string | null;
  role: MessageRole;
  created_at: number;
}

export interface EnabledModel {
  id: number;
  raw_name: string;
  display_name: string | null;
  provider_name: string;
  id_app: number;
}

export interface ChatCompletionReply {
  reply: string;
  tokens_input: number;
  tokens_output: number;
}

export interface TokenUsageRow {
  id_model: number;
  model_name: string;
  tokens_input: number;
  tokens_output: number;
}
```

- [ ] **Step 2: Write store** — `src/domains/chat/store.ts`

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChatMessage, ChatWithStatus, EnabledModel, MessageRole, TokenUsageRow } from './types';

export async function listChats(db: SQLiteDatabase): Promise<ChatWithStatus[]> {
  return db.getAllAsync<ChatWithStatus>(
    `SELECT c.id, c.name, c.id_model, c.created_at, ccs.id_status
     FROM chat c
     LEFT JOIN current_chat_status ccs ON ccs.id_chat = c.id
     WHERE COALESCE(ccs.id_status, 1) <> 3
     ORDER BY c.created_at`
  );
}

export async function getChat(db: SQLiteDatabase, chatId: number): Promise<ChatWithStatus | null> {
  return db.getFirstAsync<ChatWithStatus>(
    `SELECT c.id, c.name, c.id_model, c.created_at, ccs.id_status
     FROM chat c
     LEFT JOIN current_chat_status ccs ON ccs.id_chat = c.id
     WHERE c.id = ?`,
    chatId
  );
}

export async function createChat(db: SQLiteDatabase, name: string, modelId: number): Promise<number> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO chat (name, id_model, created_at) VALUES (?, ?, ?)',
    name,
    modelId,
    now
  );
  const chatId = result.lastInsertRowId;
  await db.runAsync(
    'INSERT INTO historique_chat_status (id_chat, id_status, modified_at) VALUES (?, 1, ?)',
    chatId,
    now
  );
  return chatId;
}

export async function listMessages(db: SQLiteDatabase, chatId: number): Promise<ChatMessage[]> {
  return db.getAllAsync<ChatMessage>(
    `SELECT id, id_chat, content, role, created_at
     FROM messages
     WHERE id_chat = ?
     ORDER BY created_at`,
    chatId
  );
}

export async function insertMessage(
  db: SQLiteDatabase,
  chatId: number,
  role: MessageRole,
  content: string
): Promise<void> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO messages (id_chat, content, role, created_at) VALUES (?, ?, ?, ?)',
    chatId,
    content,
    role,
    now
  );
  await db.runAsync(
    'INSERT INTO historique_message_status (id_message, id_status, modified_at) VALUES (?, 1, ?)',
    result.lastInsertRowId,
    now
  );
}

export async function renameChat(db: SQLiteDatabase, chatId: number, name: string): Promise<void> {
  await db.runAsync('UPDATE chat SET name = ? WHERE id = ?', name, chatId);
}

export async function setChatStatus(db: SQLiteDatabase, chatId: number, statusId: number): Promise<void> {
  await db.runAsync(
    'INSERT INTO historique_chat_status (id_chat, id_status, modified_at) VALUES (?, ?, ?)',
    chatId,
    statusId,
    Date.now()
  );
}

export async function listEnabledModels(db: SQLiteDatabase): Promise<EnabledModel[]> {
  return db.getAllAsync<EnabledModel>(
    `SELECT m.id, m.raw_name, m.display_name, a.name AS provider_name, p.id_app
     FROM ai_models m
     JOIN providers p ON p.id = m.id_provider
     JOIN apps a ON a.id = p.id_app
     JOIN current_app_status cas ON cas.id_app = p.id_app
     WHERE m.is_available = 1 AND COALESCE(cas.is_enabled, 0) = 1
     ORDER BY a.name, m.raw_name`
  );
}

export async function insertTokenUsage(
  db: SQLiteDatabase,
  modelId: number,
  tokensInput: number,
  tokensOutput: number,
  chatId: number
): Promise<void> {
  await db.runAsync(
    'INSERT INTO historique_token_usage (id_model, tokens_input, tokens_output, id_chat, created_at) VALUES (?, ?, ?, ?, ?)',
    modelId,
    tokensInput,
    tokensOutput,
    chatId,
    Date.now()
  );
}

export async function aggregateTokenUsageToday(db: SQLiteDatabase): Promise<TokenUsageRow[]> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  return db.getAllAsync<TokenUsageRow>(
    `SELECT htu.id_model,
            COALESCE(m.display_name, m.raw_name) AS model_name,
            SUM(htu.tokens_input) AS tokens_input,
            SUM(htu.tokens_output) AS tokens_output
     FROM historique_token_usage htu
     JOIN ai_models m ON m.id = htu.id_model
     WHERE htu.created_at >= ?
     GROUP BY htu.id_model
     ORDER BY tokens_input + tokens_output DESC`,
    dayStart.getTime()
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Nothing user-visible yet. Sanity via a temporary dev log in `listChats`/`listMessages` (removed before commit): on first launch with an existing Sprint 1 DB, both return `[]` (no chats exist yet).

- [ ] **Step 5: Commit**

```bash
git add src/domains/chat/types.ts src/domains/chat/store.ts
git commit -m "feat: add chat domain types and sqlite store functions"
```

---

### Task 4: Frontend chat api + React Query hooks

**Files:**
- Create: `src/domains/chat/api.ts`, `src/domains/chat/hooks.ts`

**Interfaces:**
- Consumes: `api` client (Sprint 1 Task 9), `getApiKey` (Sprint 1 Task 8), `getDb`, store functions (Task 3), types (Task 3)
- Produces:
  - `export interface ChatRequestMessage { role: 'user' | 'ai'; content: string }`
  - `export function sendChatCompletion(params: { idApp: number; model: string; apiKey: string; messages: ChatRequestMessage[]; maxRequestsPerDay: number }): Promise<ChatCompletionReply>`
  - Hooks: `useChats()`, `useCreateChat()`, `useEnabledModels()`, `useMessages(chatId)`, `useChat(chatId)`, `useSendMessage(chatId)`, `useRenameChat()`, `useArchiveChat()`, `useDeleteChat()`, `useTokenUsage()`
  - `useSendMessage` is the send-message flow (Frontend 2.4): inserts the user message locally, refetches so it renders, sends full history + provider + key + budget setting to `POST /api/chat/completions`, inserts the `ai` reply, inserts token usage. It never builds an enabled-apps list (Frontend 2.5).

- [ ] **Step 1: Write api** — `src/domains/chat/api.ts`

```ts
import { api } from '../../services/api';
import type { ChatCompletionReply } from './types';

export interface ChatRequestMessage {
  role: 'user' | 'ai';
  content: string;
}

export function sendChatCompletion(params: {
  idApp: number;
  model: string;
  apiKey: string;
  messages: ChatRequestMessage[];
  maxRequestsPerDay: number;
}): Promise<ChatCompletionReply> {
  return api.post<ChatCompletionReply>('/chat/completions', {
    id_app: params.idApp,
    model: params.model,
    api_key: params.apiKey,
    messages: params.messages,
    settings: { max_requests_per_day: params.maxRequestsPerDay },
  });
}
```

- [ ] **Step 2: Write hooks** — `src/domains/chat/hooks.ts`

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../../store/db';
import { getApiKey } from '../apps/secureStorage';
import { sendChatCompletion } from './api';
import * as store from './store';
import type { ChatMessage } from './types';

export function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const db = await getDb();
      return store.listChats(db);
    },
  });
}

export function useChat(chatId: number) {
  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      const db = await getDb();
      return store.getChat(db, chatId);
    },
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, modelId }: { name: string; modelId: number }) => {
      const db = await getDb();
      return store.createChat(db, name, modelId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useEnabledModels() {
  return useQuery({
    queryKey: ['enabled-models'],
    queryFn: async () => {
      const db = await getDb();
      return store.listEnabledModels(db);
    },
  });
}

export function useMessages(chatId: number) {
  return useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      const db = await getDb();
      return store.listMessages(db, chatId);
    },
  });
}

export function useSendMessage(chatId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const db = await getDb();
      const chat = await db.getFirstAsync<{ id_model: number }>(
        'SELECT id_model FROM chat WHERE id = ?',
        chatId
      );
      if (!chat) throw new Error('chat_not_found');
      const model = await db.getFirstAsync<{ id_app: number; raw_name: string }>(
        'SELECT p.id_app, m.raw_name FROM ai_models m JOIN providers p ON p.id = m.id_provider WHERE m.id = ?',
        chat.id_model
      );
      if (!model) throw new Error('model_not_found');
      const apiKey = await getApiKey(model.id_app);
      if (!apiKey) throw new Error('missing_api_key');
      const setting = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'max_requests_per_day'"
      );
      const maxRequestsPerDay = Number(setting?.value ?? 0);

      await store.insertMessage(db, chatId, 'user', content);
      await queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      const history = (await store.listMessages(db, chatId))
        .filter((m): m is ChatMessage & { role: 'user' | 'ai' } => m.role === 'user' || m.role === 'ai')
        .map((m) => ({ role: m.role, content: m.content ?? '' }));

      const reply = await sendChatCompletion({
        idApp: model.id_app,
        model: model.raw_name,
        apiKey,
        messages: history,
        maxRequestsPerDay,
      });

      await store.insertMessage(db, chatId, 'ai', reply.reply);
      await store.insertTokenUsage(db, chat.id_model, reply.tokens_input, reply.tokens_output, chatId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['token-usage'] });
    },
  });
}

export function useRenameChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, name }: { chatId: number; name: string }) => {
      const db = await getDb();
      await store.renameChat(db, chatId, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useArchiveChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: number) => {
      const db = await getDb();
      await store.setChatStatus(db, chatId, 2);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: number) => {
      const db = await getDb();
      await store.setChatStatus(db, chatId, 3);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useTokenUsage() {
  return useQuery({
    queryKey: ['token-usage'],
    queryFn: async () => {
      const db = await getDb();
      return store.aggregateTokenUsageToday(db);
    },
  });
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Not user-visible yet (exercised from Task 5 onward). Sanity via a temporary dev log: call `sendChatCompletion` with a real key from a dev-only hook and confirm `reply` + nonzero `tokens_*`; remove afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/domains/chat/api.ts src/domains/chat/hooks.ts
git commit -m "feat: add chat api client and react query hooks"
```

---

### Task 5: Chat list screen + new chat (Frontend 2.1, 2.2)

**Files:**
- Create: `src/domains/chat/components/ChatList.tsx`, `src/domains/chat/components/ModelPicker.tsx`
- Modify: `app/(tabs)/index.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `useChats`, `useCreateChat`, `useEnabledModels` (Task 4), `ChatWithStatus`
- Produces:
  - `export function ChatList({ items, isLoading, onOpen }: { items: ChatWithStatus[]; isLoading: boolean; onOpen: (chatId: number) => void })` — FlatList of chat rows (long-press management added in Task 8)
  - `export function ModelPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (modelId: number) => void })` — modal listing enabled models (name + provider); empty state explains no enabled AI provider
  - Home tab: "New chat" button opens ModelPicker; picking a model creates the chat and navigates to `/chat/<id>`

- [ ] **Step 1: Write ChatList** — `src/domains/chat/components/ChatList.tsx`

```tsx
import { ActivityIndicator, FlatList, Pressable, Text } from 'react-native';
import type { ChatWithStatus } from '../types';

export function ChatList({
  items,
  isLoading,
  onOpen,
}: {
  items: ChatWithStatus[];
  isLoading: boolean;
  onOpen: (chatId: number) => void;
}) {
  if (isLoading) {
    return <ActivityIndicator className="mt-10" color="#22C55E" />;
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerClassName="p-4"
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpen(item.id)}
          className="mb-3 rounded-2xl border border-gray-100 bg-white p-4"
        >
          <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
        </Pressable>
      )}
    />
  );
}
```

- [ ] **Step 2: Write ModelPicker** — `src/domains/chat/components/ModelPicker.tsx`

```tsx
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useEnabledModels } from '../hooks';

export function ModelPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (modelId: number) => void;
}) {
  const { data: models, isLoading } = useEnabledModels();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40">
        <View className="w-4/5 rounded-2xl bg-white p-6">
          <Text className="text-lg font-semibold text-gray-900">Choose a model</Text>
          {isLoading ? <Text className="mt-4 text-gray-500">Loading…</Text> : null}
          {!isLoading && (models?.length ?? 0) === 0 ? (
            <Text className="mt-4 text-gray-500">
              No enabled AI providers yet. Connect one in the Apps tab first.
            </Text>
          ) : null}
          <ScrollView className="mt-4 max-h-80">
            {(models ?? []).map((m) => (
              <Pressable
                key={m.id}
                onPress={() => onSelect(m.id)}
                className="mb-2 rounded-xl border border-gray-100 p-3"
              >
                <Text className="font-medium text-gray-900">{m.display_name ?? m.raw_name}</Text>
                <Text className="text-sm text-gray-500">{m.provider_name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} className="mt-4 self-end">
            <Text className="px-4 py-2 text-gray-500">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Write Home screen** — `app/(tabs)/index.tsx`

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChatList } from '../../src/domains/chat/components/ChatList';
import { ModelPicker } from '../../src/domains/chat/components/ModelPicker';
import { useChats, useCreateChat } from '../../src/domains/chat/hooks';

export default function HomeScreen() {
  const { data: chats, isLoading } = useChats();
  const createChat = useCreateChat();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSelectModel = async (modelId: number) => {
    setPickerOpen(false);
    const chatId = await createChat.mutateAsync({ name: 'New chat', modelId });
    router.push(`/chat/${chatId}`);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Pressable className="m-4 rounded-xl bg-primary py-3" onPress={() => setPickerOpen(true)}>
        <Text className="text-center font-semibold text-white">New chat</Text>
      </Pressable>
      <ChatList items={chats ?? []} isLoading={isLoading} onOpen={(id) => router.push(`/chat/${id}`)} />
      <ModelPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelectModel} />
    </View>
  );
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

Run: `pnpm android` (backend running). Home tab shows "New chat" + empty list. Tap it → "No enabled AI providers yet" (unless a provider is enabled). In the Apps tab connect a provider with a real key, return, tap New chat → pick a model → navigates to `/chat/<id>` (blank screen is fine; that's Task 6). Kill and relaunch the app → the chat row persists.

- [ ] **Step 6: Commit**

```bash
git add src/domains/chat/components/ChatList.tsx src/domains/chat/components/ModelPicker.tsx "app/(tabs)/index.tsx"
git commit -m "feat: add chat list screen and new-chat model picker"
```

---

### Task 6: Chat screen — history + send flow (Frontend 2.3, 2.4, 2.5)

**Files:**
- Create: `src/domains/chat/components/MessageBubble.tsx`, `src/domains/chat/components/ChatInput.tsx`
- Modify: `app/chat/[id].tsx` (empty stub)

**Interfaces:**
- Consumes: `useChat`, `useMessages`, `useSendMessage` (Task 4), `ChatMessage`
- Produces:
  - `export function MessageBubble({ message }: { message: ChatMessage })` — user messages right-aligned in `primary` green; AI messages left-aligned white
  - `export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => Promise<void> })` — multiline input + Send button; clears on send; shows a "Failed to send: …" line on rejection (e.g. `budget_exceeded`)
  - Chat screen renders history by `role`, auto-scrolls to bottom on new messages, sets its header title to the chat name
  - No-tool guarantee: the only things sent to the backend are messages + settings — there is no enabled-apps list anywhere in this flow

- [ ] **Step 1: Write MessageBubble** — `src/domains/chat/components/MessageBubble.tsx`

```tsx
import { Text, View } from 'react-native';
import type { ChatMessage } from '../types';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isAi = message.role === 'ai';
  return (
    <View
      className={`mb-2 max-w-[80%] rounded-2xl px-4 py-2 ${
        isAi ? 'self-start bg-white' : 'self-end bg-primary'
      }`}
    >
      <Text className={isAi ? 'text-gray-900' : 'text-white'}>{message.content ?? ''}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Write ChatInput** — `src/domains/chat/components/ChatInput.tsx`

```tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function ChatInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText('');
    setError(null);
    try {
      await onSend(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send_failed');
    }
  };

  return (
    <View className="border-t border-gray-200 bg-white p-3">
      {error ? <Text className="mb-2 text-sm text-red-500">Failed to send: {error}</Text> : null}
      <View className="flex-row items-center gap-2">
        <TextInput
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-gray-900"
          placeholder="Message…"
          placeholderTextColor="#9CA3AF"
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={disabled || text.trim().length === 0}
          className="rounded-xl bg-primary px-5 py-3"
        >
          <Text className="font-semibold text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Write chat screen** — `app/chat/[id].tsx`

```tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { FlatList, Text, View } from 'react-native';
import { ChatInput } from '../../src/domains/chat/components/ChatInput';
import { MessageBubble } from '../../src/domains/chat/components/MessageBubble';
import { useChat, useMessages, useSendMessage } from '../../src/domains/chat/hooks';
import type { ChatMessage } from '../../src/domains/chat/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Number(id);
  const { data: chat } = useChat(chatId);
  const { data: messages, isLoading } = useMessages(chatId);
  const send = useSendMessage(chatId);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages?.length) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: chat?.name ?? 'Chat' }} />
      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="p-4"
        renderItem={({ item }) => <MessageBubble message={item} />}
        ListEmptyComponent={
          isLoading ? (
            <Text className="mt-10 text-center text-gray-500">Loading…</Text>
          ) : (
            <Text className="mt-10 text-center text-gray-500">Say something to get started.</Text>
          )
        }
      />
      <ChatInput disabled={send.isPending} onSend={(text) => send.mutateAsync({ content: text })} />
    </View>
  );
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

Run: `pnpm android` (backend running). Open a chat (create one if needed). Send "hello" → user bubble appears immediately, then AI bubble with the reply, list auto-scrolls. Relaunch the app → full history persists. Send with the backend stopped → inline "Failed to send: …". Set the backend's `max_requests_per_day` to `1` in the seed DB and send twice → second send shows `budget_exceeded`. Confirm no tool behavior: request body in the backend log contains no `tools`/`tool_calls` field.

- [ ] **Step 6: Commit**

```bash
git add src/domains/chat/components/MessageBubble.tsx src/domains/chat/components/ChatInput.tsx "app/chat/[id].tsx"
git commit -m "feat: add chat screen with history and send flow"
```

---

### Task 7: Voice output + settings toggle (Frontend 2.7)

**Files:**
- Create: `src/domains/voice/tts.ts`, `src/domains/settings/store.ts`, `src/domains/settings/hooks.ts`
- Modify: `src/domains/chat/hooks.ts`, `app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `expo-speech` (installed, Expo Go-compatible), `getDb`, seed setting `voice_output_enabled` (`'true'` default)
- Produces:
  - `export async function speakIfEnabled(text: string): Promise<void>` — reads `voice_output_enabled`; if `'true'`, calls `Speech.speak(text)`
  - `export function stopSpeaking(): void` — `Speech.stop()`
  - `export async function getSettingValue(db, key): Promise<string | null>` / `export async function setSettingValue(db, key, value): Promise<void>` (settings/store.ts, UPSERT on `key`)
  - `export function useSettingValue(key: string)` / `export function useSetSetting()` (settings/hooks.ts)
  - Settings tab: "Read replies aloud" switch bound to `voice_output_enabled`
  - `useSendMessage` speaks the AI reply after storing it (gated by the setting)

- [ ] **Step 1: Write TTS module** — `src/domains/voice/tts.ts`

```ts
import * as Speech from 'expo-speech';
import { getDb } from '../../store/db';

export async function speakIfEnabled(text: string): Promise<void> {
  const db = await getDb();
  const setting = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'voice_output_enabled'"
  );
  if (setting?.value === 'true') {
    Speech.speak(text);
  }
}

export function stopSpeaking() {
  Speech.stop();
}
```

- [ ] **Step 2: Write settings store** — `src/domains/settings/store.ts`

```ts
import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSettingValue(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSettingValue(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, label, description, value, modified_at)
     VALUES (?, '', '', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, modified_at = excluded.modified_at`,
    key,
    value,
    Date.now()
  );
}
```

- [ ] **Step 3: Write settings hooks** — `src/domains/settings/hooks.ts`

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../../store/db';
import { getSettingValue, setSettingValue } from './store';

export function useSettingValue(key: string) {
  return useQuery({
    queryKey: ['setting', key],
    queryFn: async () => {
      const db = await getDb();
      return getSettingValue(db, key);
    },
  });
}

export function useSetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const db = await getDb();
      await setSettingValue(db, key, value);
    },
    onSuccess: (_data, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['setting', key] });
    },
  });
}
```

- [ ] **Step 4: Wire speech into send flow** — modify `src/domains/chat/hooks.ts`

Add the import and the call after `insertTokenUsage`:

```ts
import { speakIfEnabled } from '../voice/tts';
// in useSendMessage mutationFn, after:
//   await store.insertTokenUsage(db, chat.id_model, reply.tokens_input, reply.tokens_output, chatId);
await speakIfEnabled(reply.reply);
```

- [ ] **Step 5: Write Settings screen** — `app/(tabs)/settings.tsx`

```tsx
import { Switch, Text, View } from 'react-native';
import { useSettingValue, useSetSetting } from '../../src/domains/settings/hooks';

export default function SettingsScreen() {
  const { data: voiceEnabled } = useSettingValue('voice_output_enabled');
  const setSetting = useSetSetting();

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold text-gray-900">Settings</Text>
      <View className="mt-6 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-900">Read replies aloud</Text>
          <Text className="text-sm text-gray-500">
            Speak AI replies using on-device text-to-speech.
          </Text>
        </View>
        <Switch
          value={voiceEnabled === 'true'}
          onValueChange={(value) =>
            setSetting.mutate({ key: 'voice_output_enabled', value: String(value) })
          }
          trackColor={{ true: '#22C55E' }}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual QA**

Run: `pnpm android` (still Expo Go). Settings tab shows "Read replies aloud" ON. Send a message → the reply is spoken aloud. Toggle the switch OFF, send again → no speech. Kill and relaunch → the toggle keeps its value (persisted in `settings`).

- [ ] **Step 8: Commit**

```bash
git add src/domains/voice/tts.ts src/domains/settings app "app/(tabs)/settings.tsx" src/domains/chat/hooks.ts
git commit -m "feat: add voice output gated by a settings toggle"
```

---

### Task 8: Chat management actions (Frontend 2.8)

**Files:**
- Modify: `src/domains/chat/components/ChatList.tsx`

**Interfaces:**
- Consumes: `useRenameChat`, `useArchiveChat`, `useDeleteChat` (Task 4), `ChatWithStatus`
- Produces: long-press on a chat row → action sheet (Rename / Archive / Delete / Cancel). Rename opens a cross-platform modal (RN `Alert.prompt` is iOS-only, so use a `Modal` + `TextInput`). Archive dims the row (status 2). Delete removes it from the list (status 3) — no hard delete, only a `historique_chat_status` row.

- [ ] **Step 1: Add management menu** — replace `src/domains/chat/components/ChatList.tsx`

```tsx
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useArchiveChat, useDeleteChat, useRenameChat } from '../hooks';
import type { ChatWithStatus } from '../types';

export function ChatList({
  items,
  isLoading,
  onOpen,
}: {
  items: ChatWithStatus[];
  isLoading: boolean;
  onOpen: (chatId: number) => void;
}) {
  const rename = useRenameChat();
  const archive = useArchiveChat();
  const del = useDeleteChat();
  const [renameTarget, setRenameTarget] = useState<ChatWithStatus | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleLongPress = (chat: ChatWithStatus) => {
    Alert.alert(chat.name, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setRenameValue(chat.name);
          setRenameTarget(chat);
        },
      },
      { text: 'Archive', onPress: () => archive.mutate(chat.id) },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate(chat.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmRename = () => {
    if (renameTarget && renameValue.trim()) {
      rename.mutate({ chatId: renameTarget.id, name: renameValue.trim() });
    }
    setRenameTarget(null);
  };

  if (isLoading) {
    return <ActivityIndicator className="mt-10" color="#22C55E" />;
  }
  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="p-4"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpen(item.id)}
            onLongPress={() => handleLongPress(item)}
            className={`mb-3 rounded-2xl border border-gray-100 bg-white p-4 ${
              item.id_status === 2 ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
          </Pressable>
        )}
      />
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40">
          <View className="w-4/5 rounded-2xl bg-white p-6">
            <Text className="text-lg font-semibold text-gray-900">Rename chat</Text>
            <TextInput
              className="mt-4 rounded-xl border border-gray-200 px-4 py-3 text-gray-900"
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
            />
            <View className="mt-6 flex-row justify-end gap-3">
              <Pressable onPress={() => setRenameTarget(null)}>
                <Text className="px-4 py-2 text-gray-500">Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmRename} className="rounded-xl bg-primary px-5 py-2">
                <Text className="font-semibold text-white">Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA**

Run: `pnpm android`. Create two chats. Long-press one → Rename → new name shows immediately. Long-press another → Archive → row dims. Archive both → empty list but rows still in DB (status 2). Recreate a chat → long-press → Delete → disappears. Relaunch → deleted stays gone, archived stays dimmed.

- [ ] **Step 4: Commit**

```bash
git add src/domains/chat/components/ChatList.tsx
git commit -m "feat: add chat rename, archive, and delete actions"
```

---

### Task 9: Token usage display (Frontend 2.9)

**Files:**
- Create: `src/domains/chat/components/TokenUsageBar.tsx`
- Modify: `app/chat/[id].tsx`

**Interfaces:**
- Consumes: `useTokenUsage`, `useChat` (Task 4), `TokenUsageRow`
- Produces: `export function TokenUsageBar({ modelId }: { modelId: number })` — renders the active model's name and today's summed tokens ("Tokens today: N (in X / out Y)"), or nothing when the model has no usage today

- [ ] **Step 1: Write TokenUsageBar** — `src/domains/chat/components/TokenUsageBar.tsx`

```tsx
import { Text, View } from 'react-native';
import { useTokenUsage } from '../hooks';

export function TokenUsageBar({ modelId }: { modelId: number }) {
  const { data } = useTokenUsage();
  const row = data?.find((t) => t.id_model === modelId);
  if (!row) return null;
  const total = row.tokens_input + row.tokens_output;
  return (
    <View className="flex-row items-center justify-between border-t border-gray-100 bg-white px-4 py-2">
      <Text className="text-xs text-gray-500">{row.model_name}</Text>
      <Text className="text-xs text-gray-500">
        Tokens today: {total} (in {row.tokens_input} / out {row.tokens_output})
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Wire into chat screen** — modify `app/chat/[id].tsx`

```tsx
import { TokenUsageBar } from '../../src/domains/chat/components/TokenUsageBar';
// between the FlatList and <ChatInput>, when the chat is loaded:
{chat ? <TokenUsageBar modelId={chat.id_model} /> : null}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `pnpm android` (backend running). Open a chat, send two messages → the bar shows the model name and a growing "Tokens today" total after each reply. Open a different chat with the same model → the total is shared per model. Open Settings → nothing breaks when the bar is absent on the list screen.

- [ ] **Step 5: Commit**

```bash
git add src/domains/chat/components/TokenUsageBar.tsx "app/chat/[id].tsx"
git commit -m "feat: show per-model token usage counter"
```

---

## Sprint 2 done-when cross-check

| STEPS.md requirement | Task |
|---|---|
| Frontend 2.1 chat list (chat + current_chat_status, exclude deleted, by creation order) | 3, 5 |
| Frontend 2.2 new chat requires an enabled AI model (ai_models of enabled providers) | 3, 5 |
| Frontend 2.3 chat screen loads history ordered by creation, renders by role | 3, 6 |
| Frontend 2.4 send flow (insert user msg → send history+provider+key → insert AI reply) | 4, 6 |
| Frontend 2.5 no-tool guarantee, frontend side | 4, 6 |
| Frontend 2.6 voice input (dev-client recognizer) | deferred — Expo Go only, no dev build (see constraints) |
| Frontend 2.7 voice output gated by user-toggleable setting | 7 |
| Frontend 2.8 chat management (rename/archive/delete, no hard delete) | 3, 8 |
| Frontend 2.9 token usage logged per reply + read-only aggregation display | 3, 4, 9 |
| Backend 2.1 chat completion endpoint (stateless) | 1 |
| Backend 2.2 provider abstraction layer, single entry point | 1 |
| Backend 2.3 hard no-tools rule server-side | 1 |
| Backend 2.4 token accounting passthrough | 1 |
| Backend 2.5 basic budget guard from phone-sent settings | 2 |

All tasks verified by `npx tsc --noEmit` / `pnpm --dir backend exec tsc --noEmit` plus the manual QA step in each task.

## Self-review

- **Spec coverage:** every STEPS §2 frontend and backend item maps to a task above, except Frontend 2.6 voice input, which is deferred by the Expo Go-only decision (STT needs a custom dev client) and documented as such in Global Constraints and the done-when table. Task 7 also wires the Settings tab (which Sprint 1 left as a placeholder) with the single toggle that Backend/Frontend 2.7 needs — the only addition beyond STEPS, required for "user-toggleable".
- **Placeholder scan:** every provider client (`openai_compatible` / `anthropic` / `gemini` / `cohere`) has full request/response code, token extraction, and error handling. No "similar to Task N", no ellipses, no TODO.
- **Type consistency:** `ChatWithStatus`, `ChatMessage`, `EnabledModel`, `ChatCompletionReply`, `TokenUsageRow` are defined once (Task 3) and referenced identically across Tasks 4–9. Backend names match their producers: `chatCompletion` (Task 1) ← `completeChat` (Task 1) ← route `POST /api/chat/completions`; `tryConsumeBudget` (Task 2) is the only budget export and is consumed in the same file it's defined in. `speakIfEnabled` is created in Task 7 and consumed in Task 7 only.
- **Schema ↔ app parity:** every INSERT this sprint touches (`chat`, `historique_chat_status`, `messages`, `historique_message_status`, `historique_token_usage`, `settings`) matches `backend/schema.sql` column-for-column, and status ids (active=1, archived=2, deleted=3) match `backend/seed.sql`.
