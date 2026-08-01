# Sprint 3 — AI and Apps Talking (Pew) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the AI propose a real action in a connected app (send a Gmail), show the user an approval card before anything executes, run the action only after explicit approval, feed the outcome back so the AI acknowledges it — with a hard cap on chained tool calls per user turn.

**Architecture:** The backend stays stateless. A new own MCP server (`pew-actions`, stdio transport) is the only thing that talks to third-party APIs. The agent loop (`runAgentTurn`) sends tools to the LLM; if the LLM proposes a tool call the loop does **not** execute it — it returns a pending proposal to the phone. The phone stores the proposal in on-device SQLite (`tool_calls`, status `pending`, linked to a `role='ai'` message) and renders an approval card. `POST /api/chat/tools/approve` executes via the MCP client (spawning the MCP server per execution with the credential only in `PEW_CREDENTIAL` env) and returns text the phone stores as a `role='tool'` message; a continuation call with the same `turn_id` lets the AI react. `POST /api/chat/tools/reject` returns fixed rejection text the same way. Tool-call ids on the wire are the phone's local `tool_calls.id` row ids; each provider adapter reconstructs its own reference format (`call_<id>` / `toolu_<id>` / Gemini `functionResponse` by name / Cohere matching `id`).

**Tech Stack:** Same as Sprints 1–2, plus: MCP SDK v2 (`@modelcontextprotocol/client` + `@modelcontextprotocol/server`, spec 2026-07-28, ESM-only), `zod/v4` subpath, `tsx` for the dev runner. No new Expo packages. **Expo Go only — no custom dev client.**

## Global Constraints

- **Prerequisite:** Sprints 1 and 2 must be complete — DB migrated + seeded (now including `messages.id_tool_call` and all 8 providers with `supports_tool_calling = 1`, applied to `backend/schema.sql` + `backend/seed.sql` before this sprint), the chat completion endpoint + budget guard live, and the frontend chat send-flow with voice output ships.
- **Expo Go only (user decision):** never run `npx expo run:android` and never add `expo-dev-client` / `expo-speech-recognition`. Voice output (`expo-speech`) works in Expo Go; voice input/STT is deferred to a future release-APK sprint. Sprint 2's Task 8 has been revised to match (TTS only).
- **Build order:** backend endpoints ship before the frontend features that consume them.
- **Backend holds no chat state** (CONCEPTION §4.2) — history, model, key, enabled-apps, settings, `turn_id`, and the per-turn tool-call count are supplied fresh by the phone on every request. The only backend memory is the per-day budget counter (Sprint 2) and an in-memory per-`turn_id` execution counter for the approve endpoint guardrail (Sprint 3), both intentionally ephemeral.
- **Tool-call ids are the phone's local `tool_calls.id` row ids.** The backend never stores a tool call; on continuation it reconstructs provider-specific references from the phone-sent id: `call_<id>` (OpenAI-compatible), `toolu_<id>` (Anthropic), function name (Gemini), matching `id` (Cohere).
- **Nothing executes without explicit approval** (CONCEPTION §4.3). The agent loop returns proposals only; only the approve endpoint runs the connector layer.
- **Backend never persists a credential** — access tokens / refresh tokens arrive per request; the MCP server receives the access token only via `env: { ...process.env, PEW_CREDENTIAL }` of a freshly spawned subprocess, never in tool arguments, the DB, or logs.
- **Two chained-call guardrails (Backend 3.6):** the agent loop withholds tools once `tool_calls_done_this_turn >= max_tool_calls_per_turn` (so the LLM must answer), and the approve endpoint independently 429s (`max_tool_calls_exceeded`) per `turn_id` using an in-memory counter. Both read the phone-sent `max_tool_calls_per_turn` (seeded `5`).
- **All 8 providers are tool-capable** (`supports_tool_calling = 1` in `backend/seed.sql`, already applied). The chat request still only includes `enabled_apps` when the provider's flag is 1.
- **MCP server is self-owned** (`pew-actions`), not a community package — least-privilege Google scopes and no third-party trust. Gmail is real (reuses Sprint 1 OAuth tokens); Messenger and WhatsApp are registered as stub tools returning `not configured yet`.
- **New downloads (~40–70 MB, all npm):** `tsx` (~15–25 MB), `@modelcontextprotocol/client` + `@modelcontextprotocol/server` (~5–10 MB, brings zod v4 transitively), optional `npx @modelcontextprotocol/inspector` (~5–10 MB). **Nothing Android** (no JDK/SDK/Gradle, no dev-client packages) — the Expo Go decision removed those needs.
- **TypeScript `strict: true`** in both packages. Backend is now ESM (`"type": "module"`, `module`/`moduleResolution` `NodeNext`, target ES2022); all relative imports use `.js`.
- **Verification commands:** root `npx tsc --noEmit`; backend `pnpm --dir backend exec tsc --noEmit`.
- **No automated test framework** (user decision) — every task's verification is typecheck + a concrete manual QA step.
- **No code comments** (AGENTS.md code style).
- **Package manager:** pnpm. Backend port `3000`, binds `0.0.0.0`. Backend OAuth client secret for Gmail refresh lives in `backend/.env` (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`), never in code or the DB.
- **Commit only when the user asks** (`.agent/config.yml` `auto_commit: false`); messages follow `feat:`/`chore:` style.
- **Execution context:** run this in an isolated worktree created via superpowers:using-git-worktrees at execution time.

## File Structure

**Backend (create):**
- `backend/src/domains/tools/types.ts` — canonical tool types (`ToolDefinition`, `CanonicalMessage`, `CanonicalToolCall`, `ChatWithToolsParams`, `ToolRequestResult`)
- `backend/src/domains/tools/schema.ts` — `TOOL_APP_PREFIXES`, `buildToolDefs`, `appIdFromToolName`
- `backend/src/domains/tools/mcpClient.ts` — `listMcpTools`, `executeMcpTool`
- `backend/src/domains/chat/agent.ts` — `runAgentTurn` loop controller
- `backend/src/domains/chat/toolRoutes.ts` — approve + reject routes
- `backend/src/domains/chat/toolService.ts` — approve/reject services + per-turn guard + OAuth refresh
- `backend/src/mcp/server.ts` — `createPewServer()` (MCP server with the 3 tools)
- `backend/src/mcp/main.ts` — stdio entry
- `backend/src/mcp/connectors/gmail.ts`, `messenger.ts`, `whatsapp.ts` — action connectors

**Backend (modify):**
- `backend/package.json` — `"type": "module"`, dev script → `tsx watch src/server.ts`, add `tsx` + MCP SDK deps
- `backend/tsconfig.json` — NodeNext module settings
- All existing `backend/src/**` relative imports — append `.js`
- `backend/src/domains/providers/types.ts` — chat-with-tools types
- `backend/src/domains/providers/clients.ts` — `chatWithTools` dispatcher + 4 per-shape adapters
- `backend/src/domains/chat/types.ts` — request schema v2 + approve/reject schemas
- `backend/src/domains/chat/service.ts` — `completeChat` v2 → agent loop
- `backend/src/domains/chat/routes.ts` — `/completions` v2
- `backend/src/server.ts` — mount `/api/chat/tools`
- `backend/.env.example` — add `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
- `backend/seed.sql` + `backend/schema.sql` — already updated before this sprint (all providers `1`; `messages.id_tool_call`)

**Frontend (create):**
- `src/domains/chat/components/ApprovalCard.tsx`

**Frontend (modify):**
- `src/store/migrations.ts` — migration v2 (`messages.id_tool_call`)
- `src/domains/chat/types.ts` — v2 message/tool-call types
- `src/domains/chat/store.ts` — v2 list/insert, tool-call functions, context builders
- `src/domains/chat/api.ts` — v2 send + approve/reject API
- `src/domains/chat/hooks.ts` — `runTurn`, `useSendMessage` v2, `useApproveToolCall`, `useRejectToolCall`
- `app/chat/[id].tsx` — render ApprovalCard, drive approve/reject

**Untouched in this sprint:** `backend/src/domains/apps/*`, `backend/src/domains/settings/*`, `backend/src/shared/db.ts`, `src/domains/apps/*` (credential storage unchanged), `src/domains/voice/*`, `src/domains/settings/*`. No per-app connector files beyond the three MCP connectors.

---

### Task 1: Backend ESM conversion (infra)

**Files:**
- Modify: `backend/package.json`, `backend/tsconfig.json`, every relative import in `backend/src/**`

**Interfaces:**
- Consumes: the backend files created by Sprints 1–2 (all present at execution time)
- Produces: an ESM backend — `import { Router } from 'express'` works, but **every relative import ends in `.js`**. `pnpm dev` runs `tsx watch src/server.ts`; `pnpm build` still emits `dist/`; `pnpm start` still runs `node dist/server.js`.

- [ ] **Step 1: Install tsx and switch the dev script** — `backend/package.json`

```powershell
pnpm --dir backend add -D tsx
```

Then edit `backend/package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

(Keep `"main": "dist/server.js"` and all existing dependencies. `ts-node-dev` stays in the tree but is no longer referenced.)

- [ ] **Step 2: Switch TypeScript to NodeNext** — `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Append `.js` to every relative import**

For each file under `backend/src/`, rewrite relative imports so the specifier ends in `.js`:

| Before | After |
|---|---|
| `from './types'` | `from './types.js'` |
| `from '../providers/clients'` | `from '../providers/clients.js'` |
| `from '../../shared/middleware/validate'` | `from '../../shared/middleware/validate.js'` |

Package imports (`express`, `zod`, `openai`, `cors`, `dotenv`) are unchanged. All code blocks in the remaining tasks of this plan already use `.js` — match them.

- [ ] **Step 4: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors. If NodeNext complains about a package's CJS/ESM interop (`better-sqlite3`, `openai`), the `esModuleInterop: true` above covers it; report the exact error before moving on if not.

- [ ] **Step 5: Manual QA**

Run: `pnpm --dir backend dev`
Expected: the `Pew backend listening on :3000` banner appears and `Invoke-RestMethod -Uri http://localhost:3000/api/health` returns `status ok`. Then `pnpm --dir backend build` and `pnpm --dir backend start` both work against `dist/`.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/pnpm-lock.yaml backend/src
git commit -m "chore: convert backend to ESM with tsx dev runner"
```

---

### Task 2: Canonical tool types + `chatWithTools` dispatcher + OpenAI-compatible adapter (Backend 3.1 groundwork)

**Files:**
- Create: `backend/src/domains/tools/types.ts`
- Modify: `backend/src/domains/providers/types.ts`, `backend/src/domains/providers/clients.ts`

**Interfaces:**
- Consumes: `PROVIDER_CONFIGS` + `HttpError` (Sprint 1), `openai` SDK
- Produces (used by Tasks 3, 4, 8):
  - `backend/src/domains/tools/types.ts`:
    - `export interface ToolDefinition { name: string; description: string; parameters: Record<string, unknown> }`
    - `export interface CanonicalToolCall { tool_call_id: string; tool_name: string; arguments: string }` — `arguments` is a JSON string
    - `export interface CanonicalMessage { role: 'user' | 'ai' | 'tool'; content: string | null; tool_calls?: CanonicalToolCall[]; tool_call_id?: string; tool_name?: string }` — `tool_calls` only on `role='ai'`, `tool_call_id`/`tool_name` only on `role='tool'`
    - `export interface ChatWithToolsParams { id_app: number; model: string; api_key: string; messages: CanonicalMessage[]; tools: ToolDefinition[] }`
    - `export interface ToolRequestResult { reply: string; tool_calls: CanonicalToolCall[]; tokens_input: number; tokens_output: number }`
  - `clients.ts`: `export async function chatWithTools(params: ChatWithToolsParams): Promise<ToolRequestResult>` — same switch on `PROVIDER_CONFIGS[params.id_app].kind` as `chatCompletion`; 404 `unknown_app` for non-provider ids

- [ ] **Step 1: Write canonical tool types** — `backend/src/domains/tools/types.ts`

```ts
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CanonicalToolCall {
  tool_call_id: string;
  tool_name: string;
  arguments: string;
}

export interface CanonicalMessage {
  role: 'user' | 'ai' | 'tool';
  content: string | null;
  tool_calls?: CanonicalToolCall[];
  tool_call_id?: string;
  tool_name?: string;
}

export interface ChatWithToolsParams {
  id_app: number;
  model: string;
  api_key: string;
  messages: CanonicalMessage[];
  tools: ToolDefinition[];
}

export interface ToolRequestResult {
  reply: string;
  tool_calls: CanonicalToolCall[];
  tokens_input: number;
  tokens_output: number;
}
```

- [ ] **Step 2: Add chat-with-tools types** — append to `backend/src/domains/providers/types.ts`

```ts
import type { ToolDefinition, CanonicalMessage, ToolRequestResult } from '../tools/types';

export interface ChatWithToolsParams {
  id_app: number;
  model: string;
  api_key: string;
  messages: CanonicalMessage[];
  tools: ToolDefinition[];
}

export type { ToolRequestResult };
```

- [ ] **Step 3: Add the OpenAI-compatible adapter + dispatcher** — `backend/src/domains/providers/clients.ts`. Keep all existing content (Sprints 1–2). Add the imports and functions below.

```ts
import type { CanonicalMessage, ToolDefinition, ToolRequestResult } from '../tools/types';
import type { ChatWithToolsParams } from './types';
```

```ts
function toOpenAiMessage(m: CanonicalMessage): Record<string, unknown> {
  if (m.role === 'ai') {
    return {
      role: 'assistant',
      content: m.content ?? '',
      ...(m.tool_calls?.length
        ? {
            tool_calls: m.tool_calls.map((tc) => ({
              id: `call_${tc.tool_call_id}`,
              type: 'function',
              function: { name: tc.tool_name, arguments: tc.arguments },
            })),
          }
        : {}),
    };
  }
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: `call_${m.tool_call_id}`, content: m.content ?? '' };
  }
  return { role: 'user', content: m.content ?? '' };
}

async function chatWithToolsOpenAiCompatible(
  baseUrl: string,
  params: ChatWithToolsParams
): Promise<ToolRequestResult> {
  const client = new OpenAI({ apiKey: params.api_key, baseURL: baseUrl });
  const res = await client.chat.completions.create({
    model: params.model,
    messages: params.messages.map(toOpenAiMessage),
    tools: params.tools.map((t): Record<string, unknown> => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  });
  const message = res.choices[0]?.message;
  return {
    reply: message?.content ?? '',
    tool_calls: (message?.tool_calls ?? []).map((c) => ({
      tool_call_id: c.id,
      tool_name: c.function?.name ?? '',
      arguments: c.function?.arguments ?? '{}',
    })),
    tokens_input: res.usage?.prompt_tokens ?? 0,
    tokens_output: res.usage?.completion_tokens ?? 0,
  };
}
```

```ts
export async function chatWithTools(params: ChatWithToolsParams): Promise<ToolRequestResult> {
  const config = PROVIDER_CONFIGS[params.id_app];
  if (!config) throw new HttpError(404, 'unknown_app');
  switch (config.kind) {
    case 'openai_compatible':
      return chatWithToolsOpenAiCompatible(config.baseUrl, params);
    case 'anthropic':
      return chatWithToolsAnthropic(params);
    case 'gemini':
      return chatWithToolsGemini(params);
    case 'cohere':
      return chatWithToolsCohere(params);
  }
}
```

(Note: `chatWithToolsAnthropic`, `chatWithToolsGemini`, `chatWithToolsCohere` are declared in Tasks 3 and 4. Until then the file won't typecheck — that's expected; the switch lands after Task 4. If you must typecheck between tasks, add the missing three as `throw new Error('not implemented')` stubs and replace them in the later tasks.)

- [ ] **Step 4: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors only once the Task 3/4 functions exist. Until then, the three stub functions from the note above keep it green.

- [ ] **Step 5: Manual QA**

Needs a real OpenAI-compatible key. Temporarily call `chatWithTools` from a dev-only script with `tools: [gmail_send_email shape]` and a user message "reply with hi only" → expected `{ kind: 'reply' }`. With "send an email to a@b.com" and no tool actually executed → the provider proposes `tool_calls[0]` with `tool_name`/`arguments`. Remove the dev script afterwards.

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/tools backend/src/domains/providers
git commit -m "feat: add canonical tool types and tool-capable provider dispatcher"
```

---

### Task 3: Anthropic tool-calling adapter

**Files:**
- Modify: `backend/src/domains/providers/clients.ts`

**Interfaces:**
- Consumes: `CanonicalMessage`, `ToolDefinition`, `ChatWithToolsParams`, `ToolRequestResult` (Task 2)
- Produces: `chatWithToolsAnthropic(params)` — Anthropic `/v1/messages` with `tools`, `tool_use`/`tool_result` blocks. Tool references reconstructed as `toolu_<id>`.

- [ ] **Step 1: Write the adapter** — append to `backend/src/domains/providers/clients.ts`

```ts
function toAnthropicMessage(m: CanonicalMessage): Record<string, unknown> {
  if (m.role === 'ai') {
    const blocks: unknown[] = [];
    if (m.content) blocks.push({ type: 'text', text: m.content });
    for (const tc of m.tool_calls ?? []) {
      blocks.push({
        type: 'tool_use',
        id: `toolu_${tc.tool_call_id}`,
        name: tc.tool_name,
        input: JSON.parse(tc.arguments || '{}'),
      });
    }
    return { role: 'assistant', content: blocks };
  }
  if (m.role === 'tool') {
    return {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: `toolu_${m.tool_call_id}`, content: m.content ?? '' }],
    };
  }
  return { role: 'user', content: m.content ?? '' };
}

async function chatWithToolsAnthropic(params: ChatWithToolsParams): Promise<ToolRequestResult> {
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
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      messages: params.messages.map(toAnthropicMessage),
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const toolUses = (body.content ?? []).filter((c) => c.type === 'tool_use');
  return {
    reply: (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join(''),
    tool_calls: toolUses.map((c) => ({
      tool_call_id: c.id ?? '',
      tool_name: c.name ?? '',
      arguments: JSON.stringify(c.input ?? {}),
    })),
    tokens_input: body.usage?.input_tokens ?? 0,
    tokens_output: body.usage?.output_tokens ?? 0,
  };
}
```

- [ ] **Step 2: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA**

Needs a real Anthropic key. Temporarily call `chatWithTools` (`id_app: 2`) with the same two test prompts as Task 2 Step 5 → plain reply, then a `tool_calls[0]` proposal with `tool_name`/`arguments`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/domains/providers/clients.ts
git commit -m "feat: add anthropic tool-calling adapter"
```

---

### Task 4: Gemini + Cohere tool-calling adapters

**Files:**
- Modify: `backend/src/domains/providers/clients.ts`

**Interfaces:**
- Consumes: `CanonicalMessage`, `ToolDefinition`, `ChatWithToolsParams`, `ToolRequestResult` (Task 2)
- Produces: `chatWithToolsGemini(params)` and `chatWithToolsCohere(params)`; the `chatWithTools` switch from Task 2 now compiles completely.

- [ ] **Step 1: Write the Gemini adapter** — append to `backend/src/domains/providers/clients.ts`

```ts
function toGeminiMessage(m: CanonicalMessage): { role: string; parts: unknown[] } {
  if (m.role === 'ai') {
    const parts: unknown[] = [];
    if (m.content) parts.push({ text: m.content });
    for (const tc of m.tool_calls ?? []) {
      parts.push({ functionCall: { name: tc.tool_name, args: JSON.parse(tc.arguments || '{}') } });
    }
    return { role: 'model', parts };
  }
  if (m.role === 'tool') {
    return {
      role: 'user',
      parts: [{ functionResponse: { name: m.tool_name, response: { result: m.content } } }],
    };
  }
  return { role: 'user', parts: [{ text: m.content }] };
}

async function chatWithToolsGemini(params: ChatWithToolsParams): Promise<ToolRequestResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${params.api_key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: params.messages.map(toGeminiMessage),
        tools: params.tools.map((t) => ({
          functionDeclarations: [{ name: t.name, description: t.description, parameters: t.parameters }],
        })),
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const body = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: unknown } }> };
    }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return {
    reply: parts.filter((p) => p.text).map((p) => p.text ?? '').join(''),
    tool_calls: parts
      .filter((p) => p.functionCall)
      .map((p) => ({
        tool_call_id: '',
        tool_name: p.functionCall?.name ?? '',
        arguments: JSON.stringify(p.functionCall?.args ?? {}),
      })),
    tokens_input: body.usageMetadata?.promptTokenCount ?? 0,
    tokens_output: body.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
```

- [ ] **Step 2: Write the Cohere adapter** — append to `backend/src/domains/providers/clients.ts`

```ts
function toCohereMessage(m: CanonicalMessage): Record<string, unknown> {
  if (m.role === 'ai') {
    const msg: Record<string, unknown> = { role: 'CHATBOT', message: m.content ?? '' };
    if (m.tool_calls?.length) {
      msg.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.tool_call_id,
        type: 'function',
        function: { name: tc.tool_name, arguments: tc.arguments },
      }));
    }
    return msg;
  }
  if (m.role === 'tool') {
    return {
      role: 'USER',
      message: m.content ?? '',
      tool_results: [{ id: m.tool_call_id, name: m.tool_name, result: { content: m.content } }],
    };
  }
  return { role: 'USER', message: m.content ?? '' };
}

function toCohereTools(tools: ToolDefinition[]): unknown[] {
  return tools.map((t) => {
    const props = (t.parameters as { properties?: Record<string, { type?: string; description?: string }> })?.properties ?? {};
    return {
      name: t.name,
      description: t.description,
      parameter_definitions: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [
          key,
          { type: value.type ?? 'string', description: value.description ?? '' },
        ])
      ),
    };
  });
}

async function chatWithToolsCohere(params: ChatWithToolsParams): Promise<ToolRequestResult> {
  const last = params.messages[params.messages.length - 1];
  const lastIsTool = last?.role === 'tool';
  const history = params.messages.slice(0, -1).map(toCohereMessage);
  const res = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${params.api_key}`,
    },
    body: JSON.stringify({
      model: params.model,
      message: lastIsTool ? ' ' : (last?.content ?? ''),
      chat_history: lastIsTool ? [...history, toCohereMessage(last)] : history,
      tools: params.tools.length ? toCohereTools(params.tools) : undefined,
    }),
  });
  if (!res.ok) throw new Error(`cohere ${res.status}`);
  const body = (await res.json()) as {
    text?: string;
    tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    meta?: { tokens?: { input_tokens?: number; output_tokens?: number } };
  };
  return {
    reply: body.text ?? '',
    tool_calls: (body.tool_calls ?? []).map((c) => ({
      tool_call_id: c.id ?? '',
      tool_name: c.function?.name ?? '',
      arguments: c.function?.arguments ?? '{}',
    })),
    tokens_input: body.meta?.tokens?.input_tokens ?? 0,
    tokens_output: body.meta?.tokens?.output_tokens ?? 0,
  };
}
```

> Doc note: Cohere v1 requires a non-empty `message`; when the last message is a tool result it is carried in `chat_history` and `message` is a space. Confirm this against the installed Cohere docs during QA; if the space is rejected, substitute a neutral instruction like `'continue.'`.

- [ ] **Step 3: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors — the `chatWithTools` switch from Task 2 now has all four cases.

- [ ] **Step 4: Manual QA**

Needs a real Gemini key and a real Cohere key. Repeat the Task 2/3 test prompts with `id_app: 7` (Gemini) and `id_app: 11` (Cohere): plain reply, then a `tool_calls[0]` proposal. Gemini's `tool_call_id` is `''` — the phone ignores it and assigns its own row id, so an empty string is fine.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domains/providers/clients.ts
git commit -m "feat: add gemini and cohere tool-calling adapters"
```

---

### Task 5: MCP server (`pew-actions`) + Gmail connector (Backend 3.2)

**Files:**
- Create: `backend/src/mcp/server.ts`, `backend/src/mcp/main.ts`, `backend/src/mcp/connectors/gmail.ts`, `backend/src/mcp/connectors/messenger.ts`, `backend/src/mcp/connectors/whatsapp.ts`
- Modify: `backend/package.json` (add MCP SDK deps)

**Interfaces:**
- Consumes: MCP SDK v2 (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`), `zod/v4` subpath
- Produces:
  - `export function createPewServer(): McpServer` — registers `gmail_send_email` (real), `messenger_send_message` + `whatsapp_send_message` (stubs returning `isError: true`)
  - `backend/src/mcp/main.ts` — `serveStdio(createPewServer())`; banner printed via `console.error` only (stdout is the protocol channel)
  - `sendEmail(input, accessToken)` in `connectors/gmail.ts` — POSTs RFC-2822 raw message to `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
  - `messenger.ts` / `whatsapp.ts` — throw-not-implemented stubs (the only files to touch when those apps ship)
  - Credential arrives only via `process.env.PEW_CREDENTIAL`

- [ ] **Step 1: Install the MCP SDK**

```powershell
pnpm --dir backend add @modelcontextprotocol/client @modelcontextprotocol/server
```

Expected: both packages install at their latest v2 (spec 2026-07-28) with zod v4 pulled transitively. (If the `zod/v4` subpath used below is missing from the installed zod, run `pnpm --dir backend add zod@^4` too.)

- [ ] **Step 2: Write the Gmail connector** — `backend/src/mcp/connectors/gmail.ts`

```ts
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export async function sendEmail(
  input: { to: string; subject: string; body: string },
  accessToken: string
): Promise<void> {
  const raw = [`To: ${input.to}`, `Subject: ${input.subject}`, '', input.body].join('\r\n');
  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: Buffer.from(raw, 'utf-8').toString('base64url') }),
  });
  if (!res.ok) throw new Error(`gmail ${res.status}`);
}
```

- [ ] **Step 3: Write the Messenger + WhatsApp connector stubs**

`backend/src/mcp/connectors/messenger.ts`:

```ts
export async function sendMessengerMessage(
  _input: { to: string; text: string },
  _accessToken: string
): Promise<void> {
  throw new Error('messenger connector not configured yet');
}
```

`backend/src/mcp/connectors/whatsapp.ts`:

```ts
export async function sendWhatsAppMessage(
  _input: { to: string; text: string },
  _accessToken: string
): Promise<void> {
  throw new Error('whatsapp connector not configured yet');
}
```

- [ ] **Step 4: Write the MCP server** — `backend/src/mcp/server.ts`

```ts
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { sendEmail } from './connectors/gmail.js';

export function createPewServer(): McpServer {
  const server = new McpServer({ name: 'pew-actions', version: '1.0.0' });

  server.registerTool(
    'gmail_send_email',
    {
      title: 'Send an email',
      description: 'Send an email from the connected Gmail account.',
      inputSchema: {
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Subject line'),
        body: z.string().describe('Email body (plain text)'),
      },
    },
    async ({ to, subject, body }) => {
      const credential = process.env.PEW_CREDENTIAL;
      if (!credential) {
        return { content: [{ type: 'text', text: 'No Gmail credential provided.' }], isError: true };
      }
      try {
        await sendEmail({ to, subject, body }, credential);
        return { content: [{ type: 'text', text: `Email sent to ${to}.` }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Failed to send email: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );

  for (const [name, label] of [
    ['messenger_send_message', 'Messenger'],
    ['whatsapp_send_message', 'WhatsApp'],
  ] as const) {
    server.registerTool(
      name,
      {
        title: `Send a ${label} message`,
        description: `Send a message on ${label}.`,
        inputSchema: {
          to: z.string().describe('Recipient'),
          text: z.string().describe('Message text'),
        },
      },
      async () => ({
        content: [{ type: 'text', text: `${name} is not configured yet.` }],
        isError: true,
      })
    );
  }

  return server;
}
```

- [ ] **Step 5: Write the stdio entry** — `backend/src/mcp/main.ts`

```ts
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createPewServer } from './server.js';

const server = createPewServer();
console.error('pew-actions MCP server ready');
serveStdio(server);
```

- [ ] **Step 6: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors. If `registerTool`/`serveStdio` names differ in the installed SDK, follow the installed typings (SDK v2 spec 2026-07-28) and keep the shape: tool name, schema, handler.

- [ ] **Step 7: Manual QA**

```powershell
pnpm --dir backend build
node backend/dist/mcp/main.js
```

Expected: the `pew-actions MCP server ready` banner appears on stderr and the process idles (no stdout output — that would corrupt the protocol). Optional interactive check:

```powershell
npx @modelcontextprotocol/inspector node backend/dist/mcp/main.js
```

Expected: the inspector connects over stdio and lists `gmail_send_email`, `messenger_send_message`, `whatsapp_send_message`. Calling `messenger_send_message` with `{"to":"x","text":"hi"}` returns an error text `... not configured yet.`

- [ ] **Step 8: Commit**

```bash
git add backend/src/mcp backend/package.json backend/pnpm-lock.yaml
git commit -m "feat: add pew-actions MCP server with gmail connector and stub apps"
```

---

### Task 6: MCP client (Backend 3.2 continued)

**Files:**
- Create: `backend/src/domains/tools/mcpClient.ts`

**Interfaces:**
- Consumes: MCP SDK client, the compiled `dist/mcp/main.js` from Task 5
- Produces (used by Task 9):
  - `export async function listMcpTools(): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>>`
  - `export async function executeMcpTool(params: { tool_name: string; arguments: unknown; credential?: string }): Promise<{ ok: boolean; text: string }>` — spawns a **fresh** stdio transport per call, passes the access token only via `env: { ...process.env, PEW_CREDENTIAL }`, closes the client in `finally`
  - `MCP_ENTRY` resolves to `backend/dist/mcp/main.js` via `process.cwd()` (both `pnpm dev` and `pnpm start` run with the backend directory as cwd)

- [ ] **Step 1: Write the client** — `backend/src/domains/tools/mcpClient.ts`

```ts
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { join } from 'node:path';

const MCP_ENTRY = join(process.cwd(), 'dist', 'mcp', 'main.js');

interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export async function listMcpTools(): Promise<McpToolInfo[]> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_ENTRY],
    env: { ...process.env },
  });
  const client = new Client({ name: 'pew-backend', version: '1.0.0' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    return tools.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
  } finally {
    await client.close();
  }
}

export async function executeMcpTool(params: {
  tool_name: string;
  arguments: unknown;
  credential?: string;
}): Promise<{ ok: boolean; text: string }> {
  const env: Record<string, string | undefined> = { ...process.env };
  if (params.credential) env.PEW_CREDENTIAL = params.credential;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_ENTRY],
    env,
  });
  const client = new Client({ name: 'pew-backend', version: '1.0.0' });
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: params.tool_name,
      arguments: params.arguments as Record<string, unknown>,
    });
    const text =
      (result.content ?? [])
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('\n') ?? '';
    return { ok: !result.isError, text };
  } finally {
    await client.close();
  }
}
```

- [ ] **Step 2: Verify types**

Run: `pnpm --dir backend build && pnpm --dir backend exec tsc --noEmit`
Expected: `dist/mcp/main.js` exists after build; no type errors. If the SDK's transport/client names differ, follow the installed typings.

- [ ] **Step 3: Manual QA**

Temporarily call `executeMcpTool({ tool_name: 'messenger_send_message', arguments: { to: 'x', text: 'hi' } })` from a dev-only script.

```powershell
pnpm --dir backend build
node -e "import('./dist/domains/tools/mcpClient.js').then(async m => { console.log(await m.executeMcpTool({ tool_name: 'messenger_send_message', arguments: { to: 'x', text: 'hi' } })); })"
```

Expected: `{ ok: false, text: 'messenger_send_message is not configured yet.' }`. Also verify `listMcpTools()` returns the three names. Remove the temp call afterwards.

- [ ] **Step 4: Commit**

```bash
git add backend/src/domains/tools/mcpClient.ts
git commit -m "feat: add mcp client that executes tools via stdio subprocess"
```

---

### Task 7: Tool schema builder + provider flags (Backend 3.1)

**Files:**
- Create: `backend/src/domains/tools/schema.ts`

**Interfaces:**
- Consumes: `ToolDefinition` (Task 2), app ids from `backend/seed.sql` (Gmail `4`, Messenger `5`, WhatsApp `6`)
- Produces (used by Task 8):
  - `export const TOOL_APP_PREFIXES: Record<string, number>` — `{ gmail: 4, messenger: 5, whatsapp: 6 }`
  - `export function buildToolDefs(enabledAppIds: number[]): ToolDefinition[]` — returns only the tool defs whose app id is enabled; enabled apps with no tool def are silently skipped (the Backend 3.1 skip rule)
  - `export function appIdFromToolName(toolName: string): number | null`
- Seed/flag change: all 8 providers already have `supports_tool_calling = 1` and `backend/schema.sql` already has `messages.id_tool_call` (both applied to the repo before this sprint). Step 3 below verifies them.

- [ ] **Step 1: Write the schema builder** — `backend/src/domains/tools/schema.ts`

```ts
import type { ToolDefinition } from './types';

export const TOOL_APP_PREFIXES: Record<string, number> = {
  gmail: 4,
  messenger: 5,
  whatsapp: 6,
};

const TOOL_DEFS: Array<{ name: string; appId: number; description: string; parameters: Record<string, unknown> }> = [
  {
    name: 'gmail_send_email',
    appId: 4,
    description: 'Send an email from the user\'s connected Gmail account.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject.' },
        body: { type: 'string', description: 'Email body (plain text).' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'messenger_send_message',
    appId: 5,
    description: 'Send a Facebook Messenger message.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient.' },
        text: { type: 'string', description: 'Message text.' },
      },
      required: ['to', 'text'],
    },
  },
  {
    name: 'whatsapp_send_message',
    appId: 6,
    description: 'Send a WhatsApp message.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient.' },
        text: { type: 'string', description: 'Message text.' },
      },
      required: ['to', 'text'],
    },
  },
];

export function buildToolDefs(enabledAppIds: number[]): ToolDefinition[] {
  const enabled = new Set(enabledAppIds);
  return TOOL_DEFS.filter((t) => enabled.has(t.appId)).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function appIdFromToolName(toolName: string): number | null {
  const prefix = toolName.split('_')[0];
  return TOOL_APP_PREFIXES[prefix] ?? null;
}
```

- [ ] **Step 2: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the seed/flags that were applied to the repo**

Inspect `backend/seed.sql` and `backend/schema.sql` and confirm:

```sql
-- seed.sql: every provider row has supports_tool_calling = 1
-- schema.sql: messages table includes  id_tool_call INTEGER REFERENCES tool_calls(id)
```

If either is missing, apply it now (all 8 providers → `1`; add the `messages.id_tool_call` column + `idx_messages_tool_call` index) before continuing.

- [ ] **Step 4: Manual QA**

Temporarily log from a dev-only backend route:

```ts
console.log(buildToolDefs([4, 6])); // gmail_send_email + whatsapp_send_message
console.log(buildToolDefs([7]));    // [] — enabled app with no tool def is skipped
console.log(appIdFromToolName('gmail_send_email')); // 4
```

Expected: the three logs above. Remove the temp code afterwards.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domains/tools/schema.ts
git commit -m "feat: add tool schema builder keyed to enabled apps"
```

---

### Task 8: Agent loop controller + chat endpoint v2 (Backend 3.3, 3.6)

**Files:**
- Create: `backend/src/domains/chat/agent.ts`
- Modify: `backend/src/domains/chat/types.ts` (schema v2), `backend/src/domains/chat/service.ts`, `backend/src/domains/chat/routes.ts`

**Interfaces:**
- Consumes: `chatWithTools` (Task 2), `buildToolDefs`/`appIdFromToolName` (Task 7), `tryConsumeBudget` (Sprint 2), `validate`/`HttpError`
- Produces:
  - `export type AgentTurnResult = { kind: 'reply'; reply: string; tokens_input: number; tokens_output: number } | { kind: 'tool_request'; tool_name: string; arguments: string; app_id: number; tokens_input: number; tokens_output: number }`
  - `export async function runAgentTurn(params: { id_app: number; model: string; api_key: string; messages: CanonicalMessage[]; enabled_apps: number[]; tool_calls_done_this_turn: number; max_tool_calls_per_turn: number }): Promise<AgentTurnResult>`
  - `POST /api/chat/completions` v2 — body `{ id_app, model, api_key, messages: Array<{ role: 'user'|'ai'|'tool'; content: string|null; tool_calls?: Array<{ tool_call_id, tool_name, arguments }>; tool_call_id?: string; tool_name?: string }>, enabled_apps: number[], turn_id: string, tool_calls_done_this_turn: number, settings: { max_requests_per_day, max_tool_calls_per_turn } }` → `AgentTurnResult`
  - Guardrail: when `tool_calls_done_this_turn >= max_tool_calls_per_turn`, tools are **withheld** so the LLM must reply with text

- [ ] **Step 1: Write the request schema v2** — replace the contents of `backend/src/domains/chat/types.ts`

```ts
import { z } from 'zod';

export const chatMessageV2Schema = z
  .object({
    role: z.enum(['user', 'ai', 'tool']),
    content: z.string().nullable(),
    tool_calls: z
      .array(
        z.object({
          tool_call_id: z.string().min(1),
          tool_name: z.string().min(1),
          arguments: z.string(),
        })
      )
      .optional(),
    tool_call_id: z.string().optional(),
    tool_name: z.string().optional(),
  })
  .strict();

export const chatRequestV2Schema = z.object({
  id_app: z.number().int().positive(),
  model: z.string().min(1),
  api_key: z.string().min(1),
  messages: z.array(chatMessageV2Schema).min(1),
  enabled_apps: z.array(z.number().int().positive()).default([]),
  turn_id: z.string().min(1),
  tool_calls_done_this_turn: z.number().int().nonnegative().default(0),
  settings: z
    .object({
      max_requests_per_day: z.number().int().nonnegative(),
      max_tool_calls_per_turn: z.number().int().positive(),
    })
    .default({ max_requests_per_day: 0, max_tool_calls_per_turn: 5 }),
});

export type ChatRequestV2 = z.infer<typeof chatRequestV2Schema>;
```

- [ ] **Step 2: Write the agent loop** — `backend/src/domains/chat/agent.ts`

```ts
import { chatWithTools } from '../providers/clients';
import { appIdFromToolName, buildToolDefs } from '../tools/schema';
import type { CanonicalMessage, ToolDefinition } from '../tools/types';

export type AgentTurnResult =
  | { kind: 'reply'; reply: string; tokens_input: number; tokens_output: number }
  | {
      kind: 'tool_request';
      tool_name: string;
      arguments: string;
      app_id: number;
      tokens_input: number;
      tokens_output: number;
    };

export async function runAgentTurn(params: {
  id_app: number;
  model: string;
  api_key: string;
  messages: CanonicalMessage[];
  enabled_apps: number[];
  tool_calls_done_this_turn: number;
  max_tool_calls_per_turn: number;
}): Promise<AgentTurnResult> {
  const canUseTools = params.tool_calls_done_this_turn < params.max_tool_calls_per_turn;
  const tools: ToolDefinition[] = canUseTools ? buildToolDefs(params.enabled_apps) : [];
  const result = await chatWithTools({
    id_app: params.id_app,
    model: params.model,
    api_key: params.api_key,
    messages: params.messages,
    tools,
  });
  const first = result.tool_calls[0];
  if (first && first.tool_name) {
    return {
      kind: 'tool_request',
      tool_name: first.tool_name,
      arguments: first.arguments,
      app_id: appIdFromToolName(first.tool_name) ?? 0,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
    };
  }
  return {
    kind: 'reply',
    reply: result.reply ?? '',
    tokens_input: result.tokens_input,
    tokens_output: result.tokens_output,
  };
}
```

- [ ] **Step 3: Rewrite the service** — `backend/src/domains/chat/service.ts`

```ts
import { HttpError } from '../../shared/middleware/error';
import { runAgentTurn } from './agent';
import type { AgentTurnResult } from './agent';
import { tryConsumeBudget } from './budget';
import type { ChatRequestV2 } from './types';

export async function completeChat(req: ChatRequestV2): Promise<AgentTurnResult> {
  if (!tryConsumeBudget(req.settings.max_requests_per_day)) {
    throw new HttpError(429, 'budget_exceeded');
  }
  return runAgentTurn({
    id_app: req.id_app,
    model: req.model,
    api_key: req.api_key,
    messages: req.messages,
    enabled_apps: req.enabled_apps,
    tool_calls_done_this_turn: req.tool_calls_done_this_turn,
    max_tool_calls_per_turn: req.settings.max_tool_calls_per_turn,
  });
}
```

- [ ] **Step 4: Rewrite the route** — `backend/src/domains/chat/routes.ts`

```ts
import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import * as service from './service';
import { chatRequestV2Schema } from './types';
import type { ChatRequestV2 } from './types';

export const chatRouter = Router();

chatRouter.post('/completions', validate(chatRequestV2Schema), async (req, res, next) => {
  try {
    res.json(await service.completeChat(req.body as ChatRequestV2));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors. (The old `chatMessageSchema`/`chatCompletionRequestSchema` exports are gone — Sprint 2 UI code no longer references them server-side.)

- [ ] **Step 6: Manual QA**

Run: `pnpm --dir backend dev`. With a real OpenAI key and `enabled_apps: [4, 6]`:

```powershell
$body = '{"id_app":1,"model":"gpt-4o-mini","api_key":"<VALID_KEY>","messages":[{"role":"user","content":"Say hi"}],"enabled_apps":[4,6],"turn_id":"t1","tool_calls_done_this_turn":0,"settings":{"max_requests_per_day":0,"max_tool_calls_per_turn":1}}'
Invoke-RestMethod -Uri http://localhost:3000/api/chat/completions -Method Post -ContentType 'application/json' -Body $body
```

Expected: `kind: 'reply'` with text. Then prompt `"Send an email to a@b.com about lunch"` → `kind: 'tool_request'` with `tool_name: 'gmail_send_email'`, `app_id: 4`, JSON-string `arguments`. Repeat the same turn with `tool_calls_done_this_turn: 1` and the same prompt → tools are withheld, so `kind: 'reply'` (the model refuses or explains it can't act). OAuth id `{"id_app":4,...}` → 404 `unknown_app`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/domains/chat
git commit -m "feat: add agent loop and tool-aware chat completions endpoint"
```

---

### Task 9: Approve endpoint (Backend 3.4)

**Files:**
- Create: `backend/src/domains/chat/toolService.ts`, `backend/src/domains/chat/toolRoutes.ts`
- Modify: `backend/src/domains/chat/types.ts` (approve schema), `backend/src/server.ts` (mount), `backend/.env.example`

**Interfaces:**
- Consumes: `executeMcpTool` (Task 6), `validate`/`HttpError`, `process.env.GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`
- Produces:
  - `POST /api/chat/tools/approve` — body `{ id: number, id_app: number, tool_name: string, arguments: Record<string, unknown>, turn_id: string, max_tool_calls_per_turn: number, credential?: { access_token: string; refresh_token?: string; expires_at?: number } }` → `{ ok: boolean; result: string }`
  - `export async function approveToolCall(req: ApproveToolRequest): Promise<{ ok: boolean; result: string }>`
  - Per-`turn_id` in-memory cap: when the count already reached `max_tool_calls_per_turn` → 429 `max_tool_calls_exceeded`
  - OAuth refresh: when `credential.expires_at` is in the past and a refresh token + backend secret exist, exchange for a fresh access token; otherwise use `access_token` as-is. The access token is passed to MCP only via `PEW_CREDENTIAL` env.

- [ ] **Step 1: Add the approve schema** — append to `backend/src/domains/chat/types.ts`

```ts
export const approveToolRequestSchema = z
  .object({
    id: z.number().int().positive(),
    id_app: z.number().int().positive(),
    tool_name: z.string().min(1),
    arguments: z.record(z.unknown()),
    turn_id: z.string().min(1),
    max_tool_calls_per_turn: z.number().int().positive().default(5),
    credential: z
      .object({
        access_token: z.string().min(1),
        refresh_token: z.string().optional(),
        expires_at: z.number().optional(),
      })
      .optional(),
  })
  .strict();

export type ApproveToolRequest = z.infer<typeof approveToolRequestSchema>;
```

- [ ] **Step 2: Write the service** — `backend/src/domains/chat/toolService.ts`

```ts
import { HttpError } from '../../shared/middleware/error';
import { executeMcpTool } from '../tools/mcpClient';
import type { ApproveToolRequest } from './types';

const turnCounts = new Map<string, number>();

async function accessToken(credential: {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}): Promise<string> {
  if (!credential.refresh_token || !credential.expires_at || credential.expires_at > Date.now()) {
    return credential.access_token;
  }
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new HttpError(500, 'missing_client_secret');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credential.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new HttpError(500, 'token_refresh_failed');
  const body = (await res.json()) as { access_token?: string };
  return body.access_token ?? credential.access_token;
}

export async function approveToolCall(req: ApproveToolRequest): Promise<{ ok: boolean; result: string }> {
  const count = turnCounts.get(req.turn_id) ?? 0;
  if (count >= req.max_tool_calls_per_turn) {
    throw new HttpError(429, 'max_tool_calls_exceeded');
  }
  turnCounts.set(req.turn_id, count + 1);
  const credential = req.credential ? await accessToken(req.credential) : undefined;
  const { ok, text } = await executeMcpTool({
    tool_name: req.tool_name,
    arguments: req.arguments,
    credential,
  });
  return { ok, result: text };
}
```

- [ ] **Step 3: Write the routes** — `backend/src/domains/chat/toolRoutes.ts`

```ts
import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import * as toolService from './toolService';
import { approveToolRequestSchema } from './types';
import type { ApproveToolRequest } from './types';

export const toolRouter = Router();

toolRouter.post('/approve', validate(approveToolRequestSchema), async (req, res, next) => {
  try {
    res.json(await toolService.approveToolCall(req.body as ApproveToolRequest));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Mount the router + document env vars**

In `backend/src/server.ts`, after the existing routers:

```ts
import { toolRouter } from './domains/chat/toolRoutes';
// ...
app.use('/api/chat/tools', toolRouter);
```

In `backend/.env.example`, append:

```bash
# Gmail OAuth (backend-held client secret for token refresh; keys still come from the phone)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
```

- [ ] **Step 5: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual QA**

Run: `pnpm --dir backend build`, then `pnpm --dir backend dev`. Approve the stub tool (no credential, no Gmail env needed):

```powershell
$body = '{"id":1,"id_app":5,"tool_name":"messenger_send_message","arguments":{"to":"x","text":"hi"},"turn_id":"t1","max_tool_calls_per_turn":5}'
Invoke-RestMethod -Uri http://localhost:3000/api/chat/tools/approve -Method Post -ContentType 'application/json' -Body $body
```

Expected: `{ ok: false, result: 'messenger_send_message is not configured yet.' }`. Repeat the same body 5 times → the 5th returns HTTP 429 `{ error: 'max_tool_calls_exceeded' }`. With a fresh `turn_id` → allowed again. With a real Gmail OAuth token pair + `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` set in `backend/.env` → `{ ok: true, result: 'Email sent to ….' }` and a real message lands in the inbox.

- [ ] **Step 7: Commit**

```bash
git add backend/src/domains/chat backend/src/server.ts backend/.env.example
git commit -m "feat: add tool approve endpoint with per-turn cap and oauth refresh"
```

---

### Task 10: Reject endpoint (Backend 3.5)

**Files:**
- Modify: `backend/src/domains/chat/toolService.ts`, `backend/src/domains/chat/toolRoutes.ts`, `backend/src/domains/chat/types.ts`

**Interfaces:**
- Consumes: `validate`/`HttpError`
- Produces:
  - `POST /api/chat/tools/reject` — body `{ id: number, tool_name: string, turn_id: string }` → `{ ok: false; result: string }`
  - `export async function rejectToolCall(req: RejectToolRequest): Promise<{ ok: false; result: string }>` — fixed payload `'The user rejected this action.'`

- [ ] **Step 1: Add the reject schema** — append to `backend/src/domains/chat/types.ts`

```ts
export const rejectToolRequestSchema = z
  .object({
    id: z.number().int().positive(),
    tool_name: z.string().min(1),
    turn_id: z.string().min(1),
  })
  .strict();

export type RejectToolRequest = z.infer<typeof rejectToolRequestSchema>;
```

- [ ] **Step 2: Add the service** — append to `backend/src/domains/chat/toolService.ts`

```ts
import type { RejectToolRequest } from './types';

export async function rejectToolCall(
  _req: RejectToolRequest
): Promise<{ ok: false; result: string }> {
  return { ok: false, result: 'The user rejected this action.' };
}
```

- [ ] **Step 3: Add the route** — in `backend/src/domains/chat/toolRoutes.ts`, after the approve route:

```ts
import { rejectToolRequestSchema } from './types';
import type { RejectToolRequest } from './types';

toolRouter.post('/reject', validate(rejectToolRequestSchema), async (req, res, next) => {
  try {
    res.json(await toolService.rejectToolCall(req.body as RejectToolRequest));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/chat/tools/reject -Method Post -ContentType 'application/json' -Body '{"id":1,"tool_name":"gmail_send_email","turn_id":"t1"}'
```

Expected: `{ ok: false, result: 'The user rejected this action.' }`. A missing `turn_id` → 400 zod error.

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/chat
git commit -m "feat: add tool reject endpoint with fixed rejection payload"
```

---

### Task 11: Frontend data layer v2 (Frontend 3.1/3.5 data groundwork)

**Files:**
- Modify: `src/store/migrations.ts` (migration v2), `src/domains/chat/types.ts`, `src/domains/chat/store.ts`

**Interfaces:**
- Consumes: `MIGRATIONS` array shape (Sprint 1 Task 6), `getDb`, `listMessages`/`insertMessage` from Sprint 2 Task 3
- Produces (used by Tasks 12–14):
  - Migration v2: `ALTER TABLE messages ADD COLUMN id_tool_call INTEGER REFERENCES tool_calls(id)` + index — mirrors the `backend/schema.sql` change
  - `src/domains/chat/types.ts` additions:
    - `export interface ToolCallRecord { id: number; id_message: number; id_app: number; tool_name: string; request: string; created_at: number; id_status: number | null }`
    - `export interface ChatMessageRow extends ChatMessage { id_tool_call: number | null; tool_calls: ToolCallRecord[] }`
  - `store.ts`:
    - `listMessages(db, chatId): Promise<ChatMessageRow[]>` — v2 shape (joins `tool_calls` + `current_tool_call_status`)
    - `insertMessage(db, chatId, role, content, idToolCall?): Promise<number>` — now returns the new message id; writes a `historique_message_status` (active, status 1) row
    - `insertToolCall(db, messageId, appId, toolName, requestJson): Promise<number>`
    - `setToolCallStatus(db, toolCallId, statusId): Promise<void>` — inserts a `historique_tool_calls_status` row (pending 1 / approved 2 / rejected 3 / completed 4 / failed 5)
    - `getToolCallStatus(db, toolCallId): Promise<number | null>`
    - `getEnabledIntegrationApps(db): Promise<number[]>` — enabled `apps` rows that are NOT providers
    - `getProviderToolCapable(db, idApp): Promise<boolean>` — `providers.supports_tool_calling`

- [ ] **Step 1: Add migration v2** — append to `src/store/migrations.ts` (after the v1 entry)

```ts
{
  version: 2,
  name: 'tool-call message link',
  sql: `
    ALTER TABLE messages ADD COLUMN id_tool_call INTEGER REFERENCES tool_calls(id);
    CREATE INDEX idx_messages_tool_call ON messages(id_tool_call);
  `,
}
```

- [ ] **Step 2: Add v2 types** — append to `src/domains/chat/types.ts`

```ts
export interface ToolCallRecord {
  id: number;
  id_message: number;
  id_app: number;
  tool_name: string;
  request: string;
  created_at: number;
  id_status: number | null;
}

export interface ChatMessageRow extends ChatMessage {
  id_tool_call: number | null;
  tool_calls: ToolCallRecord[];
}
```

- [ ] **Step 3: Rewrite listMessages to the v2 shape** — `src/domains/chat/store.ts`

Replace the Sprint 2 `listMessages` implementation with:

```ts
interface MessageRow {
  id: number;
  id_chat: number;
  content: string | null;
  role: MessageRole;
  created_at: number;
  id_tool_call: number | null;
  tool_id: number | null;
  tool_id_app: number | null;
  tool_tool_name: string | null;
  tool_request: string | null;
  tool_created_at: number | null;
  tool_status: number | null;
}

export async function listMessages(db: SQLiteDatabase, chatId: number): Promise<ChatMessageRow[]> {
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT m.id, m.id_chat, m.content, m.role, m.created_at, m.id_tool_call,
            t.id AS tool_id, t.id_app AS tool_id_app, t.tool_name AS tool_tool_name,
            t.request AS tool_request, t.created_at AS tool_created_at,
            ctc.id_status AS tool_status
     FROM messages m
     LEFT JOIN tool_calls t ON t.id_message = m.id OR t.id = m.id_tool_call
     LEFT JOIN current_tool_call_status ctc ON ctc.id_tool_call = t.id
     WHERE m.id_chat = ?
     ORDER BY m.created_at, m.id`,
    chatId
  );
  const byId = new Map<number, ChatMessageRow>();
  for (const row of rows) {
    let msg = byId.get(row.id);
    if (!msg) {
      msg = {
        id: row.id,
        id_chat: row.id_chat,
        content: row.content,
        role: row.role,
        created_at: row.created_at,
        id_tool_call: row.id_tool_call ?? null,
        tool_calls: [],
      };
      byId.set(row.id, msg);
    }
    if (row.tool_id != null) {
      msg.tool_calls.push({
        id: row.tool_id,
        id_message: row.id,
        id_app: row.tool_id_app ?? 0,
        tool_name: row.tool_tool_name ?? '',
        request: row.tool_request ?? '{}',
        created_at: row.tool_created_at ?? 0,
        id_status: row.tool_status ?? null,
      });
    }
  }
  return [...byId.values()];
}
```

- [ ] **Step 4: Update insertMessage + add tool-call functions** — `src/domains/chat/store.ts`

Replace the Sprint 2 `insertMessage` with:

```ts
export async function insertMessage(
  db: SQLiteDatabase,
  chatId: number,
  role: MessageRole,
  content: string | null,
  idToolCall?: number
): Promise<number> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO messages (id_chat, content, role, id_tool_call, created_at) VALUES (?, ?, ?, ?, ?)',
    chatId,
    content,
    role,
    idToolCall ?? null,
    now
  );
  const messageId = result.lastInsertRowId;
  await db.runAsync(
    'INSERT INTO historique_message_status (id_message, id_status, modified_at) VALUES (?, 1, ?)',
    messageId,
    now
  );
  return messageId;
}
```

Append the tool-call and context functions:

```ts
export async function insertToolCall(
  db: SQLiteDatabase,
  messageId: number,
  appId: number,
  toolName: string,
  requestJson: string
): Promise<number> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO tool_calls (id_message, id_app, tool_name, request, created_at) VALUES (?, ?, ?, ?, ?)',
    messageId,
    appId,
    toolName,
    requestJson,
    now
  );
  const toolCallId = result.lastInsertRowId;
  await db.runAsync(
    'INSERT INTO historique_tool_calls_status (id_tool_call, id_status, modified_at) VALUES (?, 1, ?)',
    toolCallId,
    now
  );
  return toolCallId;
}

export async function setToolCallStatus(
  db: SQLiteDatabase,
  toolCallId: number,
  statusId: number
): Promise<void> {
  await db.runAsync(
    'INSERT INTO historique_tool_calls_status (id_tool_call, id_status, modified_at) VALUES (?, ?, ?)',
    toolCallId,
    statusId,
    Date.now()
  );
}

export async function getToolCallStatus(db: SQLiteDatabase, toolCallId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ id_status: number | null }>(
    'SELECT id_status FROM current_tool_call_status WHERE id_tool_call = ?',
    toolCallId
  );
  return row?.id_status ?? null;
}

export async function getEnabledIntegrationApps(db: SQLiteDatabase): Promise<number[]> {
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT a.id
     FROM apps a
     JOIN current_app_status cas ON cas.id_app = a.id
     WHERE cas.is_enabled = 1
       AND a.id NOT IN (SELECT p.id_app FROM providers p)`
  );
  return rows.map((r) => r.id);
}

export async function getProviderToolCapable(db: SQLiteDatabase, idApp: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ supports_tool_calling: number }>(
    'SELECT supports_tool_calling FROM providers WHERE id_app = ?',
    idApp
  );
  return (row?.supports_tool_calling ?? 0) === 1;
}
```

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. (Callers of `insertMessage` in Sprint 2 code pass 3 args — still valid; callers of `listMessages` now receive `ChatMessageRow[]`, which still satisfies the old `ChatMessage[]` consumer shape until Task 12 updates the send flow.)

- [ ] **Step 6: Manual QA**

Run: `pnpm android`. Relaunch over an existing Sprint 1–2 database → the app migrates to version 2 (check a temp log of `PRAGMA user_version` → `2`) and the existing chats still list and render. Sending a message still works exactly as before (no tool behavior yet — the phone never sends `enabled_apps` until Task 12).

- [ ] **Step 7: Commit**

```bash
git add src/store/migrations.ts src/domains/chat/types.ts src/domains/chat/store.ts
git commit -m "feat: extend chat data layer with tool call records and context builders"
```

---

### Task 12: API v2 + context builder + send flow (Frontend 3.1)

**Files:**
- Modify: `src/domains/chat/api.ts`, `src/domains/chat/hooks.ts`

**Interfaces:**
- Consumes: `api` (Sprint 1), `getApiKey` (Sprint 1), `getDb`, `speakIfEnabled` (Sprint 2), store v2 (Task 11)
- Produces:
  - `export type AgentTurnReply = { kind: 'reply'; reply: string; tokens_input: number; tokens_output: number } | { kind: 'tool_request'; tool_name: string; arguments: string; app_id: number; tokens_input: number; tokens_output: number }`
  - `export interface ChatRequestMessageV2 { role: 'user' | 'ai' | 'tool'; content: string | null; tool_calls?: Array<{ tool_call_id: string; tool_name: string; arguments: string }>; tool_call_id?: string; tool_name?: string }`
  - `sendChatCompletion(params)` — posts the v2 body including `enabled_apps`, `turn_id`, `tool_calls_done_this_turn`, and both settings
  - `approveToolCall(params)` → `Promise<{ ok: boolean; result: string }>`
  - `rejectToolCall(params)` → `Promise<{ ok: boolean; result: string }>`
  - `useSendMessage(chatId)` v2 — inserts the user message, generates a fresh `turn_id`, runs `runTurn`, returns `{ turnId }`
  - `runTurn(chatId, turnId, toolCallsDoneThisTurn)` — shared continuation core: builds history + enabled-apps context, calls the backend, and applies the result (reply → insert `ai` + token usage + speak; tool_request → insert `ai` message with null content + `tool_calls` row pending)
  - `enabled_apps` is only sent when the provider's `supports_tool_calling` is 1

- [ ] **Step 1: Rewrite the API module** — replace `src/domains/chat/api.ts`

```ts
import { api } from '../../services/api';

export type AgentTurnReply =
  | { kind: 'reply'; reply: string; tokens_input: number; tokens_output: number }
  | {
      kind: 'tool_request';
      tool_name: string;
      arguments: string;
      app_id: number;
      tokens_input: number;
      tokens_output: number;
    };

export interface ChatRequestMessageV2 {
  role: 'user' | 'ai' | 'tool';
  content: string | null;
  tool_calls?: Array<{ tool_call_id: string; tool_name: string; arguments: string }>;
  tool_call_id?: string;
  tool_name?: string;
}

export function sendChatCompletion(params: {
  idApp: number;
  model: string;
  apiKey: string;
  messages: ChatRequestMessageV2[];
  enabledApps: number[];
  turnId: string;
  toolCallsDoneThisTurn: number;
  maxRequestsPerDay: number;
  maxToolCallsPerTurn: number;
}): Promise<AgentTurnReply> {
  return api.post<AgentTurnReply>('/chat/completions', {
    id_app: params.idApp,
    model: params.model,
    api_key: params.apiKey,
    messages: params.messages,
    enabled_apps: params.enabledApps,
    turn_id: params.turnId,
    tool_calls_done_this_turn: params.toolCallsDoneThisTurn,
    settings: {
      max_requests_per_day: params.maxRequestsPerDay,
      max_tool_calls_per_turn: params.maxToolCallsPerTurn,
    },
  });
}

export function approveToolCall(params: {
  id: number;
  idApp: number;
  toolName: string;
  arguments: Record<string, unknown>;
  turnId: string;
  maxToolCallsPerTurn: number;
  credential?: { access_token: string; refresh_token: string | null };
}): Promise<{ ok: boolean; result: string }> {
  return api.post<{ ok: boolean; result: string }>('/chat/tools/approve', {
    id: params.id,
    id_app: params.idApp,
    tool_name: params.toolName,
    arguments: params.arguments,
    turn_id: params.turnId,
    max_tool_calls_per_turn: params.maxToolCallsPerTurn,
    ...(params.credential
      ? {
          credential: {
            access_token: params.credential.access_token,
            refresh_token: params.credential.refresh_token ?? undefined,
          },
        }
      : {}),
  });
}

export function rejectToolCall(params: {
  id: number;
  toolName: string;
  turnId: string;
}): Promise<{ ok: boolean; result: string }> {
  return api.post<{ ok: boolean; result: string }>('/chat/tools/reject', {
    id: params.id,
    tool_name: params.toolName,
    turn_id: params.turnId,
  });
}
```

- [ ] **Step 2: Rewrite the send flow** — replace `src/domains/chat/hooks.ts`

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../../store/db';
import { getApiKey, getTokenPair } from '../apps/secureStorage';
import { speakIfEnabled } from '../voice/tts';
import { approveToolCall, rejectToolCall, sendChatCompletion } from './api';
import type { AgentTurnReply, ChatRequestMessageV2 } from './api';
import * as store from './store';
import type { ChatMessageRow, ChatMessage, ToolCallRecord } from './types';

function toWireMessage(m: ChatMessageRow): ChatRequestMessageV2 {
  if (m.role === 'ai') {
    return {
      role: 'ai',
      content: m.content,
      tool_calls: m.tool_calls.map((t) => ({
        tool_call_id: String(t.id),
        tool_name: t.tool_name,
        arguments: t.request,
      })),
    };
  }
  if (m.role === 'tool') {
    const tc = m.tool_calls[0];
    return {
      role: 'tool',
      content: m.content,
      tool_call_id: tc ? String(tc.id) : '',
      tool_name: tc?.tool_name ?? '',
    };
  }
  return { role: 'user', content: m.content };
}

async function runTurn(chatId: number, turnId: string, toolCallsDoneThisTurn: number) {
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
  const daySetting = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'max_requests_per_day'"
  );
  const toolSetting = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'max_tool_calls_per_turn'"
  );
  const maxRequestsPerDay = Number(daySetting?.value ?? 0);
  const maxToolCallsPerTurn = Number(toolSetting?.value ?? 5);
  const toolCapable = await store.getProviderToolCapable(db, model.id_app);
  const enabledApps = toolCapable ? await store.getEnabledIntegrationApps(db) : [];
  const messages = (await store.listMessages(db, chatId)).map(toWireMessage);

  const reply: AgentTurnReply = await sendChatCompletion({
    idApp: model.id_app,
    model: model.raw_name,
    apiKey,
    messages,
    enabledApps,
    turnId,
    toolCallsDoneThisTurn,
    maxRequestsPerDay,
    maxToolCallsPerTurn,
  });

  await store.insertTokenUsage(db, chat.id_model, reply.tokens_input, reply.tokens_output, chatId);
  if (reply.kind === 'reply') {
    await store.insertMessage(db, chatId, 'ai', reply.reply);
    await speakIfEnabled(reply.reply);
  } else {
    const messageId = await store.insertMessage(db, chatId, 'ai', null);
    await store.insertToolCall(db, messageId, reply.app_id, reply.tool_name, reply.arguments);
  }
}

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
      await store.insertMessage(db, chatId, 'user', content);
      await queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      const turnId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      await runTurn(chatId, turnId, 0);
      return { turnId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['token-usage'] });
    },
  });
}

export function useApproveToolCall(chatId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      toolCall,
      turnId,
      toolCallsDoneThisTurn,
    }: {
      toolCall: ToolCallRecord;
      turnId: string;
      toolCallsDoneThisTurn: number;
    }): Promise<{ done: number }> => {
      const db = await getDb();
      await store.setToolCallStatus(db, toolCall.id, 2);
      const tokenPair = await getTokenPair(toolCall.id_app);
      const toolSetting = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'max_tool_calls_per_turn'"
      );
      const maxToolCallsPerTurn = Number(toolSetting?.value ?? 5);
      const approval = await approveToolCall({
        id: toolCall.id,
        idApp: toolCall.id_app,
        toolName: toolCall.tool_name,
        arguments: JSON.parse(toolCall.request),
        turnId,
        maxToolCallsPerTurn,
        credential: tokenPair
          ? { access_token: tokenPair.access_token, refresh_token: tokenPair.refresh_token }
          : undefined,
      });
      await store.setToolCallStatus(db, toolCall.id, approval.ok ? 4 : 5);
      await store.insertMessage(db, chatId, 'tool', approval.result, toolCall.id);
      await queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      await runTurn(chatId, turnId, toolCallsDoneThisTurn + 1);
      return { done: toolCallsDoneThisTurn + 1 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['token-usage'] });
    },
  });
}

export function useRejectToolCall(chatId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      toolCall,
      turnId,
      toolCallsDoneThisTurn,
    }: {
      toolCall: ToolCallRecord;
      turnId: string;
      toolCallsDoneThisTurn: number;
    }): Promise<{ done: number }> => {
      const db = await getDb();
      const rejection = await rejectToolCall({
        id: toolCall.id,
        toolName: toolCall.tool_name,
        turnId,
      });
      await store.setToolCallStatus(db, toolCall.id, 3);
      await store.insertMessage(db, chatId, 'tool', rejection.result, toolCall.id);
      await queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      await runTurn(chatId, turnId, toolCallsDoneThisTurn + 1);
      return { done: toolCallsDoneThisTurn + 1 };
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

(Keep `ChatMessage` imported if still referenced elsewhere; if unused, drop it.)

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `pnpm android` (backend running). Sending a plain message behaves exactly as in Sprint 2 (reply bubble + token bar + voice). With Gmail enabled in the Apps tab, send "send an email to a@b.com saying hi" → the backend log shows `enabled_apps: [4]` in the request and the chat renders an `ai` message with no visible text plus a pending `tool_calls` row (a temp dev log in `runTurn` confirms `insertToolCall` returns a row id; remove afterwards). With Gmail disabled, the request contains `enabled_apps: []`.

- [ ] **Step 5: Commit**

```bash
git add src/domains/chat/api.ts src/domains/chat/hooks.ts
git commit -m "feat: send enabled-apps context and handle tool proposal responses"
```

---

### Task 13: Approval card UI (Frontend 3.2)

**Files:**
- Create: `src/domains/chat/components/ApprovalCard.tsx`

**Interfaces:**
- Consumes: `ToolCallRecord` (Task 11); status ids pending 1 / approved 2 / rejected 3 / completed 4 / failed 5
- Produces:
  - `export function ApprovalCard({ toolCall, busy, onApprove, onReject }: { toolCall: ToolCallRecord; busy: boolean; onApprove: () => void; onReject: () => void })` — renders a distinct card (action label + readable argument lines + Approve/Reject buttons)
  - Tool-name → label map: `gmail_send_email` → "Send email", `messenger_send_message` / `whatsapp_send_message` → "Send message"; unknown tool names fall back to the raw name
  - Status reflects `toolCall.id_status`: pending → buttons enabled; approved → "Approved, running…"; completed → "Completed"; failed → "Failed — Retry"; rejected → "Rejected"

- [ ] **Step 1: Write the card** — `src/domains/chat/components/ApprovalCard.tsx`

```tsx
import { Pressable, Text, View } from 'react-native';
import type { ToolCallRecord } from '../types';

const TOOL_LABELS: Record<string, { title: string; lines: (args: Record<string, unknown>) => Array<[string, string]> }> = {
  gmail_send_email: {
    title: 'Send email',
    lines: (a) => [
      ['To', String(a.to ?? '')],
      ['Subject', String(a.subject ?? '')],
      ['Body', String(a.body ?? '')],
    ],
  },
  messenger_send_message: {
    title: 'Send message',
    lines: (a) => [
      ['To', String(a.to ?? '')],
      ['Message', String(a.text ?? '')],
    ],
  },
  whatsapp_send_message: {
    title: 'Send message',
    lines: (a) => [
      ['To', String(a.to ?? '')],
      ['Message', String(a.text ?? '')],
    ],
  },
};

const STATUS_TEXT: Record<number, string> = {
  1: 'Pending approval',
  2: 'Approved, running…',
  3: 'Rejected',
  4: 'Completed',
  5: 'Failed',
};

export function ApprovalCard({
  toolCall,
  busy,
  onApprove,
  onReject,
}: {
  toolCall: ToolCallRecord;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = TOOL_LABELS[toolCall.tool_name] ?? {
    title: toolCall.tool_name,
    lines: (a: Record<string, unknown>) => Object.entries(a).map(([k, v]) => [k, String(v)]),
  };
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.request) as Record<string, unknown>;
  } catch {
    args = {};
  }
  const isPending = toolCall.id_status === 1;
  const isFailed = toolCall.id_status === 5;
  const isRetryable = isPending || isFailed;

  return (
    <View className="mb-2 max-w-[85%] self-start rounded-2xl border border-accent bg-white p-4">
      <Text className="text-base font-semibold text-gray-900">{meta.title}</Text>
      {meta.lines(args).map(([label, value]) => (
        <Text key={label} className="mt-1 text-sm text-gray-600">
          {label}: {value}
        </Text>
      ))}
      <Text className="mt-2 text-xs font-medium text-accent">
        {STATUS_TEXT[toolCall.id_status ?? 1] ?? 'Unknown'}
      </Text>
      {isRetryable && !busy ? (
        <View className="mt-3 flex-row gap-2">
          <Pressable onPress={onApprove} className="flex-1 rounded-xl bg-primary py-2">
            <Text className="text-center font-semibold text-white">
              {isFailed ? 'Retry' : 'Approve'}
            </Text>
          </Pressable>
          {isPending ? (
            <Pressable onPress={onReject} className="flex-1 rounded-xl border border-gray-300 py-2">
              <Text className="text-center font-semibold text-gray-700">Reject</Text>
            </Pressable>
          ) : null}
        </View>
      ) : busy ? (
        <Text className="mt-3 text-sm text-gray-500">Working…</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA**

Run: `pnpm android`. Render the card directly in a dev-only screen with a fabricated `ToolCallRecord` for `gmail_send_email` and each status 1–5 → label, argument lines, and button/status text render per the matrix above. Remove the dev screen afterwards.

- [ ] **Step 4: Commit**

```bash
git add src/domains/chat/components/ApprovalCard.tsx
git commit -m "feat: add approval card for pending tool calls"
```

---

### Task 14: Approve/reject wiring + status reflection (Frontend 3.3, 3.4, 3.5)

**Files:**
- Modify: `app/chat/[id].tsx`

**Interfaces:**
- Consumes: `useApproveToolCall`, `useRejectToolCall`, `useSendMessage` (Task 12), `ApprovalCard` (Task 13), `ChatMessageRow`/`ToolCallRecord` (Task 11)
- Produces: the full loop — user message → proposal → card → approve/reject → `role='tool'` message → continuation reply. Status ids: pending 1, approved 2, rejected 3, completed 4, failed 5.

- [ ] **Step 1: Rewrite the chat screen** — replace `app/chat/[id].tsx`

```tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { ApprovalCard } from '../../src/domains/chat/components/ApprovalCard';
import { ChatInput } from '../../src/domains/chat/components/ChatInput';
import { MessageBubble } from '../../src/domains/chat/components/MessageBubble';
import { TokenUsageBar } from '../../src/domains/chat/components/TokenUsageBar';
import {
  useApproveToolCall,
  useChat,
  useMessages,
  useRejectToolCall,
  useSendMessage,
} from '../../src/domains/chat/hooks';
import type { ChatMessage, ChatMessageRow } from '../../src/domains/chat/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Number(id);
  const { data: chat } = useChat(chatId);
  const { data: messages, isLoading } = useMessages(chatId);
  const send = useSendMessage(chatId);
  const approve = useApproveToolCall(chatId);
  const reject = useRejectToolCall(chatId);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [turn, setTurn] = useState<{ turnId: string; done: number } | null>(null);

  useEffect(() => {
    if (messages?.length) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    const { turnId } = await send.mutateAsync({ content: text });
    setTurn({ turnId, done: 0 });
  };

  const handleApprove = async (toolCall: ChatMessageRow['tool_calls'][number]) => {
    if (!turn) return;
    const { done } = await approve.mutateAsync({
      toolCall,
      turnId: turn.turnId,
      toolCallsDoneThisTurn: turn.done,
    });
    setTurn({ turnId: turn.turnId, done });
  };

  const handleReject = async (toolCall: ChatMessageRow['tool_calls'][number]) => {
    if (!turn) return;
    const { done } = await reject.mutateAsync({
      toolCall,
      turnId: turn.turnId,
      toolCallsDoneThisTurn: turn.done,
    });
    setTurn({ turnId: turn.turnId, done });
  };

  const renderItem = ({ item }: { item: ChatMessageRow }) => {
    if (item.role === 'ai' && item.tool_calls.length > 0) {
      return (
        <ApprovalCard
          toolCall={item.tool_calls[0]}
          busy={approve.isPending || reject.isPending || send.isPending}
          onApprove={() => handleApprove(item.tool_calls[0])}
          onReject={() => handleReject(item.tool_calls[0])}
        />
      );
    }
    if (item.role === 'tool') {
      return (
        <View className="mb-2 max-w-[85%] self-center rounded-xl bg-gray-100 px-4 py-2">
          <Text className="text-xs text-gray-500">Tool result: {item.content}</Text>
        </View>
      );
    }
    return <MessageBubble message={item} />;
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: chat?.name ?? 'Chat' }} />
      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="p-4"
        renderItem={renderItem}
        ListEmptyComponent={
          isLoading ? (
            <Text className="mt-10 text-center text-gray-500">Loading…</Text>
          ) : (
            <Text className="mt-10 text-center text-gray-500">Say something to get started.</Text>
          )
        }
      />
      {chat ? <TokenUsageBar modelId={chat.id_model} /> : null}
      <ChatInput disabled={send.isPending || approve.isPending || reject.isPending} onSend={handleSend} />
    </View>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA — approve path**

Run: `pnpm android` + `pnpm --dir backend dev` (run `pnpm --dir backend build` once first so `dist/mcp/main.js` exists). With Gmail connected (real OAuth token) and `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` set in `backend/.env`:
1. Send "send an email to a@b.com about lunch" → the AI message has no bubble text; an ApprovalCard appears ("Send email", To/Subject/Body lines, "Pending approval").
2. Tap Approve → card flips to "Approved, running…", the email lands in the inbox, then a `role='tool'` result line ("Email sent to a@b.com.") and the AI's acknowledgment reply appear.
3. Relaunch the app → the card now shows "Completed", the tool-result line, and the AI reply persist.

- [ ] **Step 4: Manual QA — reject + retry + budget paths**

1. Send the email prompt again, tap Reject → card flips to "Rejected", the tool-result line shows "The user rejected this action.", and the AI acknowledges the rejection.
2. Repeat the prompt until `max_tool_calls_per_turn` (5) chained calls are hit → the agent loop stops proposing tools and answers with text (the "I've hit my limit" behavior).
3. With the backend stopped mid-flow, Approve surfaces the inline "Failed to send: …" error in the chat input, and the card remains pending.
4. Kill the app mid-turn, relaunch, and set `max_requests_per_day` to `1` in the seed DB → the next send shows `budget_exceeded`.

- [ ] **Step 5: Commit**

```bash
git add "app/chat/[id].tsx"
git commit -m "feat: wire approval cards into the chat screen with tool outcome continuation"
```

---

## Sprint 3 done-when cross-check

| STEPS.md requirement | Task |
|---|---|
| Frontend 3.1 enabled-apps context builder (replaces 2.5's nothing-sent) | 11, 12 |
| Frontend 3.2 pending tool-call renders as an approval card (action + plain-language summary) | 13, 14 |
| Frontend 3.3 approve action (calls Backend 3.4, inserts `role='tool'`, continues to next reply) | 12, 14 |
| Frontend 3.4 reject action (calls Backend 3.5, inserts synthetic `role='tool'` message) | 12, 14 |
| Frontend 3.5 status reflection via `current_tool_call_status` after every approve/reject | 11, 14 |
| Backend 3.1 tool schema builder (skips apps with no tool integration) | 7 |
| Backend 3.2 action connector layer (own MCP server `pew-actions`, nothing above it talks to third parties) | 5, 6 |
| Backend 3.3 agent loop controller (proposal only — no execution, stores nothing) | 2, 3, 4, 8 |
| Backend 3.4 approve endpoint (executes connector, returns `role='tool'`-ready result) | 9 |
| Backend 3.5 reject endpoint (fixed rejection payload) | 10 |
| Backend 3.6 chained-call guardrail (agent-loop cap + approve-endpoint per-turn cap) | 8, 9 |
| Infra: backend ESM (needed for ESM-only MCP SDK v2) | 1 |
| Infra: Expo Go only — no dev client, no voice-input/STT this sprint | (Sprint 2 revision; constraint only) |

All tasks verified by `npx tsc --noEmit` / `pnpm --dir backend exec tsc --noEmit` plus the manual QA step in each task. Voice input (STT) is deliberately deferred; voice output ships in Sprint 2 under Expo Go.

## Self-review

- **Spec coverage:** every STEPS §3 frontend and backend item maps to a task above. Backend 3.2 is implemented as the self-owned MCP server per the pre-sprint decision (Gmail real; Messenger/WhatsApp stubs). The `messages.id_tool_call` schema change appears both in `backend/schema.sql` (applied to the repo before this sprint) and as the on-device migration v2 (Task 11) — the Sprint 1 "keep both in sync" rule is honored.
- **Placeholder scan:** every adapter (`openai_compatible`, `anthropic`, `gemini`, `cohere`), the MCP server/client, the agent loop, both tool endpoints, and the full approve/reject UI have complete code and a concrete verification step. The three doc-notes (Cohere `message` quirk, MCP SDK v2 name confirmation, Task 2's stub-until-Task-4 note) are confirmation notes against installed artifacts, not "fill in later".
- **Type consistency:** `ToolDefinition`/`CanonicalMessage`/`CanonicalToolCall`/`ChatWithToolsParams`/`ToolRequestResult` are defined once (Task 2) and used identically by Tasks 3/4/8. `AgentTurnResult` (Task 8) and the frontend `AgentTurnReply` (Task 12) match field-for-field (`kind`/`reply`/`tool_name`/`arguments`/`app_id`/`tokens_*`). Backend names match their producers: `runAgentTurn` ← `completeChat` ← route; `buildToolDefs`/`appIdFromToolName` (Task 7) ← `runAgentTurn` (Task 8); `executeMcpTool` (Task 6) ← `approveToolCall` (Task 9); `approveToolCall`/`rejectToolCall` (Task 9/10) ← frontend `approveToolCall`/`rejectToolCall` (Task 12). `insertMessage` returns the new id everywhere it's needed (Task 11 defines it, Tasks 12/14 consume it).
- **Schema ↔ app parity:** every INSERT this sprint touches (`messages` incl. `id_tool_call`, `tool_calls`, `historique_message_status`, `historique_tool_calls_status`, `historique_token_usage`) matches `backend/schema.sql` column-for-column, and tool-call status ids (pending 1 / approved 2 / rejected 3 / completed 4 / failed 5) match `backend/seed.sql`.
- **Statelessness re-check:** the backend's only new memory is `turnCounts` in `toolService.ts`, keyed by the phone-generated `turn_id` and capped by the phone-sent setting — matching the approved "in-memory guardrail" exception, not chat state. `listMcpTools` is defined but not wired anywhere this sprint (YAGNI until the next sprint needs it); `executeMcpTool` is the sole consumer path.
