# Sprint 1 — App & AI Provider Integration (Pew) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user browse the seeded apps/AI-provider registry, search/filter it, connect an API-key app and an OAuth app (with real credential verification for key-based AI providers), and toggle any app's enabled state — with no secret ever touching SQLite.

**Architecture:** Frontend (Expo/RN) owns an on-device SQLite registry (`apps`, `providers`, `ai_models`, history tables, settings) migrated on first launch; credentials live only in Android Keystore via `expo-secure-store`. Backend (Express) is stateless: verification, OAuth exchange, and model discovery endpoints receive a credential per request and persist nothing. Backend endpoints are built before their frontend counterparts.

**Tech Stack:** React Native + Expo SDK 57, expo-router, NativeWind 4, expo-sqlite, expo-secure-store, React Query (frontend); Express 4 + TypeScript, zod, openai SDK, cors, dotenv (backend).

## Global Constraints

- **Build order:** within each sprint, the backend endpoint ships (even stubbed) before the frontend feature that consumes it.
- **No secret ever lives in SQLite** — API keys and OAuth token pairs live only in Android Keystore, keyed `apikey_<appId>` / `oauth_<appId>` (CONCEPTION §4.1).
- **Backend never persists a credential** — it is used for the single request and discarded (CONCEPTION §4.2).
- **Every action requires explicit approval** — not applicable to Sprint 1 (no tool calls yet), but the toggle/connect flow must never auto-enable an app without an explicit user action (CONCEPTION §4.3).
- **App metadata (names, icons, docs URLs) lives in a constants file, not the database** (CONCEPTION §4.6).
- **Settings that affect backend behavior are sent per-request**, never read by the backend from a phone DB (CONCEPTION §4.5).
- **Brand colors:** primary `#22C55E`, accent `#38BDF8` (already defined in `tailwind.config.js`).
- **TypeScript `strict: true`** in both packages.
- **Verification commands:** root `npx tsc --noEmit`; backend `pnpm --dir backend exec tsc --noEmit`.
- **No automated test framework** (user decision) — every task's verification is typecheck + a concrete manual QA step.
- **No code comments** (AGENTS.md code style).
- **Package manager:** pnpm. Backend port `3000`, binds `0.0.0.0` so the phone can reach it over LAN.
- **Canonical schema source:** `backend/schema.sql` (already reviewed, trailing-comma bug fixed). The app's migration (`src/store/migrations.ts`) must mirror it exactly; keep both in sync.
- **Commit only when the user asks** (`.agent/config.yml` `auto_commit: false`); commit messages follow `feat:`/`chore:` style used in the repo.
- **Execution context:** run this in an isolated worktree created via superpowers:using-git-worktrees at execution time.

## File Structure

**Backend (create):**
- `backend/src/server.ts` — Express bootstrap, middleware, route mounting, LAN listen
- `backend/src/shared/utils/logger.ts` — leveled logger
- `backend/src/shared/middleware/error.ts` — `HttpError`, notFound + error handlers
- `backend/src/shared/middleware/validate.ts` — zod body-parse middleware
- `backend/src/domains/apps/types.ts` — verify + oauth exchange zod schemas/types
- `backend/src/domains/apps/service.ts` — verify + exchange service functions
- `backend/src/domains/apps/routes.ts` — `POST /api/apps/verify`, `POST /api/apps/oauth/exchange`
- `backend/src/domains/providers/types.ts` — model list request schema/types
- `backend/src/domains/providers/clients.ts` — per-provider verification/model-listing clients
- `backend/src/domains/providers/service.ts` — model discovery service function
- `backend/src/domains/providers/routes.ts` — `POST /api/providers/models`

**Frontend (create):**
- `src/constants/apps.ts` — seed apps/providers/statuses/settings + help URLs
- `src/store/db.ts` — singleton DB open + migration runner + seed call
- `src/store/migrations.ts` — migration v1 = schema.sql mirror
- `src/services/api.ts` — typed fetch client against `EXPO_PUBLIC_API_URL`
- `src/services/toast.ts` — transient toast helper (ToastAndroid/Alert)
- `src/domains/apps/types.ts` — `AppWithStatus`, `TokenPair`, `VerifyResult`, `ModelInfo`
- `src/domains/apps/secureStorage.ts` — Keystore wrapper
- `src/domains/apps/seed.ts` — inserts statuses, settings, apps, providers, initial statuses
- `src/domains/apps/store.ts` — DB access: `listApps`, `setAppEnabled`, `cacheProviderModels`
- `src/domains/apps/api.ts` — `verifyCredential`, `exchangeOAuth`
- `src/domains/apps/filterApps.ts` — pure search/filter function
- `src/domains/apps/hooks.ts` — React Query hooks
- `src/domains/providers/api.ts` — `discoverModels`
- `src/domains/apps/components/AppList.tsx`, `AppToggle.tsx`, `CredentialModal.tsx`, `FilterBar.tsx`

**Frontend (modify):**
- `app/_layout.tsx` — Providers + global.css import + Stack
- `app/(tabs)/_layout.tsx` — Tabs
- `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx` — placeholders
- `app/(tabs)/apps.tsx` — apps list screen
- `app/apps/[appsId].tsx` — app detail screen

**Untouched in this sprint:** `backend/src/shared/db.ts` (backend stays stateless — YAGNI), `backend/src/domains/chat/*`, `backend/src/domains/settings/*`, all `src/domains/chat/*`, `src/domains/voice/*`, `src/domains/settings/*`, `src/domains/providers/store.ts`/`hooks.ts`.

---

### Task 1: App shell wiring

**Files:**
- Modify: `app/_layout.tsx` (empty stub)
- Modify: `app/(tabs)/_layout.tsx` (empty stub)
- Modify: `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx` (empty stubs)

**Interfaces:**
- Consumes: `src/providers.tsx` (already implemented — exports `Providers`)
- Produces: a rendering root so every later screen can be QA'd in Expo Go

- [ ] **Step 1: Write root layout** — `app/_layout.tsx`

```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { Providers } from '../src/providers';

export default function RootLayout() {
  return (
    <Providers>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="apps/[appsId]" options={{ title: 'App' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
      </Stack>
    </Providers>
  );
}
```

- [ ] **Step 2: Write tab layout** — `app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#22C55E' }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="apps" options={{ title: 'Apps' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Write placeholder screens** — `app/(tabs)/index.tsx` and `app/(tabs)/settings.tsx`

```tsx
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Pew</Text>
      <Text className="mt-2 text-accent">Your AI assistant</Text>
    </View>
  );
}
```

(`settings.tsx` is identical except the heading text `Settings`.)

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. If tsc flags `process` or `global.css`, confirm `nativewind-env.d.ts` exists at repo root (it does) and that Expo types resolve env vars.

- [ ] **Step 5: Manual QA**

Run: `pnpm android`
Expected: the app opens on Home with "Pew" title in green/blue, and bottom tabs Home / Apps / Settings render and navigate. If blank screen, check the Metro log for the `global.css` import — NativeWind will not apply without it.

- [ ] **Step 6: Commit** (only if the user asked to commit)

```bash
git add app/_layout.tsx "app/(tabs)/_layout.tsx" "app/(tabs)/index.tsx" "app/(tabs)/settings.tsx"
git commit -m "feat: wire app shell with providers and nativewind"
```

---

### Task 2: Backend bootstrap (logger, middleware, health endpoint)

**Files:**
- Create: `backend/src/server.ts`, `backend/src/shared/utils/logger.ts`, `backend/src/shared/middleware/error.ts`, `backend/src/shared/middleware/validate.ts`

**Interfaces:**
- Consumes: `PORT` env (optional, default 3000), `cors`, `express`, `zod` (all in `backend/package.json`)
- Produces:
  - `GET /api/health` → `{ "status": "ok" }`
  - `export class HttpError extends Error` with `status: number`
  - `export function validate<T>(schema: ZodSchema<T>)` → Express middleware that 400s on bad body and writes the parsed data back to `req.body`
  - `export const logger` with `info`/`warn`/`error`

- [ ] **Step 1: Write logger** — `backend/src/shared/utils/logger.ts`

```ts
function write(level: 'info' | 'warn' | 'error', message: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  if (level === 'error') console.error(line, meta ?? '');
  else console.log(line, meta ?? '');
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
```

- [ ] **Step 2: Write error middleware** — `backend/src/shared/middleware/error.ts`

```ts
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'not_found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'internal_error';
  if (status >= 500) logger.error('Unhandled error', err);
  res.status(status).json({ error: message });
}
```

- [ ] **Step 3: Write validate middleware** — `backend/src/shared/middleware/validate.ts`

```ts
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ZodError(result.error.issues));
      return;
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 4: Write server entry** — `backend/src/server.ts`

```ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './shared/middleware/error';
import { logger } from './shared/utils/logger';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, '0.0.0.0', () => {
  logger.info(`Pew backend listening on :${port}`);
});
```

- [ ] **Step 5: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual QA**

Run: `pnpm --dir backend dev`, then in another terminal:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/health
```

Expected: `status ok`. Then `Invoke-RestMethod -Uri http://localhost:3000/nope` → 404 `{ error: 'not_found' }`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/server.ts backend/src/shared
git commit -m "feat: bootstrap express server with error handling and health endpoint"
```

---

### Task 3: Credential verification endpoint (Backend 1.1)

**Files:**
- Create: `backend/src/domains/apps/types.ts`, `backend/src/domains/apps/service.ts`, `backend/src/domains/apps/routes.ts`, `backend/src/domains/providers/clients.ts`
- Modify: `backend/src/server.ts` (mount router)

**Interfaces:**
- Consumes: `validate`, `HttpError` from Task 2; `openai` SDK (in `backend/package.json`)
- Produces:
  - `POST /api/apps/verify` — body `{ id_app: number, api_key: string }` → `{ ok: boolean, note?: string }`
  - `export function verifyApiKey(idApp: number, apiKey: string): Promise<{ ok: boolean; note?: string }>` (in `clients.ts`)
  - OAuth app ids `4, 5, 6` → `{ ok: true, note: 'oauth_verification_not_available' }` (stub, per decision)
  - Provider app ids `1, 2, 3, 7, 8, 9, 10, 11` → real one-call verification (list models)
  - Unknown app id → 404 `unknown_app`

- [ ] **Step 1: Write types** — `backend/src/domains/apps/types.ts`

```ts
import { z } from 'zod';

export const verifyRequestSchema = z.object({
  id_app: z.number().int().positive(),
  api_key: z.string().min(1),
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

export const verifyResultSchema = z.object({
  ok: z.boolean(),
  note: z.string().optional(),
});
export type VerifyResult = z.infer<typeof verifyResultSchema>;
```

- [ ] **Step 2: Write provider clients** — `backend/src/domains/providers/clients.ts`

```ts
import OpenAI from 'openai';
import { HttpError } from '../../shared/middleware/error';
import type { ModelInfo } from './types';

type ProviderKind = 'openai_compatible' | 'anthropic' | 'gemini' | 'cohere';

interface ProviderConfig {
  kind: ProviderKind;
  baseUrl: string;
}

const PROVIDER_CONFIGS: Record<number, ProviderConfig> = {
  1: { kind: 'openai_compatible', baseUrl: 'https://api.openai.com/v1' },
  2: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  3: { kind: 'openai_compatible', baseUrl: 'https://api.deepseek.com/v1' },
  7: { kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  8: { kind: 'openai_compatible', baseUrl: 'https://api.groq.com/openai/v1' },
  9: { kind: 'openai_compatible', baseUrl: 'https://api.mistral.ai/v1' },
  10: { kind: 'openai_compatible', baseUrl: 'https://openrouter.ai/api/v1' },
  11: { kind: 'cohere', baseUrl: 'https://api.cohere.com/v1' },
};

const OAUTH_APP_IDS = new Set([4, 5, 6]);

async function listOpenAiCompatible(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  const page = await client.models.list();
  return page.data.map((m) => ({ raw_name: m.id, display_name: m.id }));
}

async function listAnthropic(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const body = (await res.json()) as { data: Array<{ id: string; display_name?: string }> };
  return body.data.map((m) => ({ raw_name: m.id, display_name: m.display_name ?? m.id }));
}

async function listGemini(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const body = (await res.json()) as { models: Array<{ name: string; displayName?: string }> };
  return body.models.map((m) => {
    const raw = m.name.replace(/^models\//, '');
    return { raw_name: raw, display_name: m.displayName ?? raw };
  });
}

async function listCohere(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.cohere.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`cohere ${res.status}`);
  const body = (await res.json()) as { models: Array<{ name: string; display_name?: string }> };
  return body.models.map((m) => ({ raw_name: m.name, display_name: m.display_name ?? m.name }));
}

export async function listModelsForProvider(idApp: number, apiKey: string): Promise<ModelInfo[]> {
  const config = PROVIDER_CONFIGS[idApp];
  if (!config) throw new HttpError(404, 'unknown_app');
  switch (config.kind) {
    case 'openai_compatible':
      return listOpenAiCompatible(config.baseUrl, apiKey);
    case 'anthropic':
      return listAnthropic(apiKey);
    case 'gemini':
      return listGemini(apiKey);
    case 'cohere':
      return listCohere(apiKey);
  }
}

export async function verifyApiKey(idApp: number, apiKey: string): Promise<{ ok: boolean; note?: string }> {
  if (OAUTH_APP_IDS.has(idApp)) {
    return { ok: true, note: 'oauth_verification_not_available' };
  }
  if (!(idApp in PROVIDER_CONFIGS)) {
    throw new HttpError(404, 'unknown_app');
  }
  try {
    await listModelsForProvider(idApp, apiKey);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 3: Write provider types** — `backend/src/domains/providers/types.ts`

```ts
import { z } from 'zod';

export const modelListRequestSchema = z.object({
  id_app: z.number().int().positive(),
  api_key: z.string().min(1),
});
export type ModelListRequest = z.infer<typeof modelListRequestSchema>;

export const modelInfoSchema = z.object({
  raw_name: z.string(),
  display_name: z.string(),
});
export type ModelInfo = z.infer<typeof modelInfoSchema>;
```

- [ ] **Step 4: Write service** — `backend/src/domains/apps/service.ts`

```ts
import { verifyApiKey } from '../providers/clients';
import type { VerifyRequest, VerifyResult } from './types';

export async function verifyCredential(req: VerifyRequest): Promise<VerifyResult> {
  return verifyApiKey(req.id_app, req.api_key);
}
```

- [ ] **Step 5: Write routes** — `backend/src/domains/apps/routes.ts`

```ts
import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { verifyRequestSchema } from './types';
import type { VerifyRequest } from './types';
import * as service from './service';

export const appsRouter = Router();

appsRouter.post('/verify', validate(verifyRequestSchema), async (req, res, next) => {
  try {
    res.json(await service.verifyCredential(req.body as VerifyRequest));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 6: Mount router in server** — modify `backend/src/server.ts`

Add after the health endpoint:

```ts
import { appsRouter } from './domains/apps/routes';
// ...
app.use('/api/apps', appsRouter);
```

- [ ] **Step 7: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual QA**

Run: `pnpm --dir backend dev`, then:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/apps/verify -Method Post -ContentType 'application/json' -Body '{"id_app":1,"api_key":"sk-invalid"}'
```

Expected: `{ ok: False }` (OpenAI rejects the fake key). With a real OpenAI key: `{ ok: True }`. OAuth app:
`{"id_app":4,"api_key":"x"}` → `{ ok: True, note: 'oauth_verification_not_available' }`. Unknown: `{"id_app":999,"api_key":"x"}` → 404 `{ error: 'unknown_app' }`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/domains/apps backend/src/domains/providers backend/src/server.ts
git commit -m "feat: add credential verification endpoint with per-provider clients"
```

---

### Task 4: OAuth exchange endpoint (Backend 1.2, stubbed)

**Files:**
- Modify: `backend/src/domains/apps/types.ts`, `backend/src/domains/apps/service.ts`, `backend/src/domains/apps/routes.ts`

**Interfaces:**
- Consumes: `validate`, `HttpError` from Task 2
- Produces:
  - `POST /api/apps/oauth/exchange` — body `{ id_app: number, code: string }` → `{ access_token: string, refresh_token: string | null }`
  - `export interface TokenPair { access_token: string; refresh_token: string | null }`
  - Stub behavior (no real client secrets exist for Sprint 1 — documented, not a placeholder): returns deterministic fake tokens for any `id_app` in `4, 5, 6`; unknown id → 404

- [ ] **Step 1: Add exchange types** — `backend/src/domains/apps/types.ts`

```ts
export const oauthExchangeRequestSchema = z.object({
  id_app: z.number().int().positive(),
  code: z.string().min(1),
});
export type OAuthExchangeRequest = z.infer<typeof oauthExchangeRequestSchema>;

export interface TokenPair {
  access_token: string;
  refresh_token: string | null;
}
```

- [ ] **Step 2: Add exchange service** — `backend/src/domains/apps/service.ts`

```ts
import { HttpError } from '../../shared/middleware/error';
import { verifyApiKey } from '../providers/clients';
import type { OAuthExchangeRequest, TokenPair, VerifyRequest, VerifyResult } from './types';

const OAUTH_APP_IDS = new Set([4, 5, 6]);

export async function verifyCredential(req: VerifyRequest): Promise<VerifyResult> {
  return verifyApiKey(req.id_app, req.api_key);
}

export async function exchangeOAuth(req: OAuthExchangeRequest): Promise<TokenPair> {
  if (!OAUTH_APP_IDS.has(req.id_app)) {
    throw new HttpError(404, 'unknown_app');
  }
  return {
    access_token: `stub_access_${req.id_app}_${req.code}`,
    refresh_token: `stub_refresh_${req.id_app}_${req.code}`,
  };
}
```

- [ ] **Step 3: Add exchange route** — `backend/src/domains/apps/routes.ts`

```ts
appsRouter.post('/oauth/exchange', validate(oauthExchangeRequestSchema), async (req, res, next) => {
  try {
    res.json(await service.exchangeOAuth(req.body as OAuthExchangeRequest));
  } catch (err) {
    next(err);
  }
});
```

(plus the imports `oauthExchangeRequestSchema` and `OAuthExchangeRequest`)

- [ ] **Step 4: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/apps/oauth/exchange -Method Post -ContentType 'application/json' -Body '{"id_app":4,"code":"abc"}'
```

Expected: `{ access_token: 'stub_access_4_abc', refresh_token: 'stub_refresh_4_abc' }`. Bad body → 400.

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/apps
git commit -m "feat: add stubbed oauth exchange endpoint"
```

---

### Task 5: Model discovery endpoint (Backend 1.3)

**Files:**
- Create: `backend/src/domains/providers/service.ts`, `backend/src/domains/providers/routes.ts`
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `listModelsForProvider` from Task 3 (`clients.ts`), `modelListRequestSchema` from Task 3 (`types.ts`), `validate`
- Produces:
  - `POST /api/providers/models` — body `{ id_app: number, api_key: string }` → `{ models: Array<{ raw_name: string; display_name: string }> }`
  - Real model list for provider ids `1, 2, 3, 7, 8, 9, 10, 11`; OAuth ids `4, 5, 6` → 404 `unknown_app` (not in `PROVIDER_CONFIGS`); unknown → 404

- [ ] **Step 1: Write service** — `backend/src/domains/providers/service.ts`

```ts
import { listModelsForProvider } from './clients';
import type { ModelInfo, ModelListRequest } from './types';

export async function listModels(req: ModelListRequest): Promise<ModelInfo[]> {
  return listModelsForProvider(req.id_app, req.api_key);
}
```

- [ ] **Step 2: Write routes** — `backend/src/domains/providers/routes.ts`

```ts
import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { modelListRequestSchema } from './types';
import type { ModelListRequest } from './types';
import * as service from './service';

export const providersRouter = Router();

providersRouter.post('/models', validate(modelListRequestSchema), async (req, res, next) => {
  try {
    const models = await service.listModels(req.body as ModelListRequest);
    res.json({ models });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 3: Mount router** — modify `backend/src/server.ts`

```ts
import { providersRouter } from './domains/providers/routes';
// ...
app.use('/api/providers', providersRouter);
```

- [ ] **Step 4: Verify types**

Run: `pnpm --dir backend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/providers/models -Method Post -ContentType 'application/json' -Body '{"id_app":1,"api_key":"sk-invalid"}'
```

Expected: HTTP 500 → `{ error: '...' }` from OpenAI auth failure. With a valid key: `{ models: [{ raw_name: 'gpt-...', display_name: 'gpt-...' }, ...] }`. OAuth id `4` → 404 `{ error: 'unknown_app' }`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/domains/providers backend/src/server.ts
git commit -m "feat: add model discovery endpoint"
```

---

### Task 6: Local database setup (Frontend 1.1)

**Files:**
- Create: `src/store/migrations.ts`, `src/store/db.ts`

**Interfaces:**
- Consumes: `expo-sqlite` (in `package.json`)
- Produces:
  - `export const MIGRATIONS: Array<{ version: number; name: string; sql: string }>` — version 1 mirrors `backend/schema.sql`
  - `export function getDb(): Promise<SQLiteDatabase>` — opens `pew.db`, runs pending migrations in order via `PRAGMA user_version`, then returns the db (seeding is Task 7)

- [ ] **Step 1: Write migrations** — `src/store/migrations.ts`

The `sql` string is the full DDL from `backend/schema.sql` (the reviewed, corrected source), with `PRAGMA foreign_keys` omitted (it is set in `db.ts`).

```ts
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
CREATE TABLE status_chat (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('active','archived','deleted'))
);

CREATE TABLE status_message (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('active','deleted'))
);

CREATE TABLE status_tool_call (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL CHECK(label IN ('pending','approved','rejected','completed','failed'))
);

CREATE TABLE apps (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  auth_type TEXT NOT NULL CHECK(auth_type IN ('api_key','oauth'))
);

CREATE TABLE historique_apps_status (
  id INTEGER PRIMARY KEY,
  id_app INTEGER NOT NULL REFERENCES apps(id),
  is_enabled BOOLEAN NOT NULL CHECK(is_enabled IN (0,1)),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_historique_apps_status_app ON historique_apps_status(id_app);

CREATE TABLE providers (
  id INTEGER PRIMARY KEY,
  id_app INTEGER NOT NULL UNIQUE REFERENCES apps(id),
  api_base_url TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE ai_models (
  id INTEGER PRIMARY KEY,
  id_provider INTEGER NOT NULL REFERENCES providers(id),
  raw_name TEXT NOT NULL,
  display_name TEXT,
  is_available BOOLEAN DEFAULT 1,
  fetched_at INTEGER NOT NULL,
  UNIQUE(id_provider, raw_name)
);

CREATE TABLE chat (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  id_model INTEGER NOT NULL REFERENCES ai_models(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE historique_chat_status (
  id INTEGER PRIMARY KEY,
  id_chat INTEGER NOT NULL REFERENCES chat(id),
  id_status INTEGER NOT NULL REFERENCES status_chat(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_chat_status_chat ON historique_chat_status(id_chat);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  id_chat INTEGER NOT NULL REFERENCES chat(id),
  content TEXT,
  role TEXT NOT NULL CHECK(role IN ('user','ai','tool')),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_chat ON messages(id_chat);

CREATE TABLE historique_message_status (
  id INTEGER PRIMARY KEY,
  id_message INTEGER NOT NULL REFERENCES messages(id),
  id_status INTEGER NOT NULL REFERENCES status_message(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_msg_status_msg ON historique_message_status(id_message);

CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY,
  id_message INTEGER NOT NULL REFERENCES messages(id),
  id_app INTEGER NOT NULL REFERENCES apps(id),
  tool_name TEXT NOT NULL,
  request JSON NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_tool_calls_message ON tool_calls(id_message);

CREATE TABLE historique_tool_calls_status (
  id INTEGER PRIMARY KEY,
  id_tool_call INTEGER NOT NULL REFERENCES tool_calls(id),
  id_status INTEGER NOT NULL REFERENCES status_tool_call(id),
  modified_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_tool_call_status ON historique_tool_calls_status(id_tool_call);

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY,
  id_message INTEGER NOT NULL REFERENCES messages(id),
  file_name TEXT NOT NULL
);
CREATE INDEX idx_attachments_message ON attachments(id_message);

CREATE TABLE historique_token_usage (
  id INTEGER PRIMARY KEY,
  id_model INTEGER NOT NULL REFERENCES ai_models(id),
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  id_chat INTEGER REFERENCES chat(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  value TEXT NOT NULL,
  modified_at INTEGER NOT NULL
);

CREATE VIEW current_app_status AS
SELECT a.id_app, a.is_enabled
FROM historique_apps_status a
WHERE a.modified_at = (
  SELECT MAX(modified_at) FROM historique_apps_status a2 WHERE a2.id_app = a.id_app
);

CREATE VIEW current_chat_status AS
SELECT h.id_chat, h.id_status
FROM historique_chat_status h
WHERE h.modified_at = (
  SELECT MAX(modified_at) FROM historique_chat_status h2 WHERE h2.id_chat = h.id_chat
);

CREATE VIEW current_message_status AS
SELECT h.id_message, h.id_status
FROM historique_message_status h
WHERE h.modified_at = (
  SELECT MAX(modified_at) FROM historique_message_status h2 WHERE h2.id_message = h.id_message
);

CREATE VIEW current_tool_call_status AS
SELECT h.id_tool_call, h.id_status
FROM historique_tool_calls_status h
WHERE h.modified_at = (
  SELECT MAX(modified_at) FROM historique_tool_calls_status h2 WHERE h2.id_tool_call = h.id_tool_call
);
`,
  },
];
```

- [ ] **Step 2: Write db module** — `src/store/db.ts`

```ts
import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('pew.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current + 1; version <= MIGRATIONS.length; version++) {
    const migration = MIGRATIONS[version - 1];
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
    });
    await db.execAsync(`PRAGMA user_version = ${version};`);
  }
  if (__DEV__) {
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    console.log('[db] migrated tables:', tables.map((t) => t.name).join(', '));
  }
  return db;
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. (`__DEV__` is globally typed by Expo.)

- [ ] **Step 4: Manual QA**

Run: `pnpm android`. In the Metro console expect `[db] migrated tables: historique_apps_status, ai_models, apps, ...` — proving schema applied exactly once. Kill and relaunch the app: the log still shows one run (idempotent via `user_version`).

- [ ] **Step 5: Commit**

```bash
git add src/store/db.ts src/store/migrations.ts
git commit -m "feat: add expo-sqlite migration runner for the local schema"
```

---

### Task 7: Registry constants + seed (Frontend 1.2)

**Files:**
- Create: `src/constants/apps.ts`, `src/domains/apps/seed.ts`
- Modify: `src/store/db.ts` (call seed after migrate)

**Interfaces:**
- Consumes: `SEED_APPS` ids/auth types from `backend/seed.sql` (the canonical registry), `getDb` from Task 6
- Produces:
  - `src/constants/apps.ts` exports `SEED_APPS` (apps + `helpUrl`), `SEED_PROVIDERS`, `STATUS_SEED`, `SETTINGS_SEED`
  - `export function seedDatabase(db: SQLiteDatabase): Promise<void>` — inserts statuses, settings, apps, providers, and one disabled `historique_apps_status` row per app; no-ops if `apps` already has rows
  - `getDb()` seeds once right after migration

- [ ] **Step 1: Write constants** — `src/constants/apps.ts`

Mirror the 11 rows from `backend/seed.sql` (ids, names, descriptions, icons, `auth_type`), plus per-app `helpUrl`. Providers come from seed.sql's `providers` block (ids, `id_app`, `api_base_url`). Statuses and settings also come from seed.sql.

```ts
export interface SeedApp {
  id: number;
  name: string;
  description: string;
  icon: string;
  auth_type: 'api_key' | 'oauth';
  helpUrl: string;
}

export interface SeedProvider {
  id: number;
  id_app: number;
  api_base_url: string;
}

export interface SeedSetting {
  key: string;
  label: string;
  description: string;
  value: string;
}

export const SEED_APPS: SeedApp[] = [
  { id: 1, name: 'OpenAI', description: 'GPT models', icon: 'openai', auth_type: 'api_key', helpUrl: 'https://platform.openai.com/api-keys' },
  { id: 2, name: 'Anthropic', description: 'Claude models', icon: 'anthropic', auth_type: 'api_key', helpUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 3, name: 'DeepSeek', description: 'DeepSeek models', icon: 'deepseek', auth_type: 'api_key', helpUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 4, name: 'Gmail', description: 'Send and read email', icon: 'gmail', auth_type: 'oauth', helpUrl: 'https://developers.google.com/gmail/api/auth' },
  { id: 5, name: 'Messenger', description: 'Send messages', icon: 'messenger', auth_type: 'oauth', helpUrl: 'https://developers.facebook.com/docs/messenger-platform' },
  { id: 6, name: 'WhatsApp', description: 'Send messages', icon: 'whatsapp', auth_type: 'oauth', helpUrl: 'https://developers.facebook.com/docs/whatsapp' },
  { id: 7, name: 'Google Gemini', description: 'Gemini models, free tier available', icon: 'gemini', auth_type: 'api_key', helpUrl: 'https://aistudio.google.com/apikey' },
  { id: 8, name: 'Groq', description: 'Fast inference, generous free tier', icon: 'groq', auth_type: 'api_key', helpUrl: 'https://console.groq.com/keys' },
  { id: 9, name: 'Mistral AI', description: 'Mistral models, free tier available', icon: 'mistral', auth_type: 'api_key', helpUrl: 'https://console.mistral.ai/api-keys' },
  { id: 10, name: 'OpenRouter', description: 'Aggregates many free + paid models', icon: 'openrouter', auth_type: 'api_key', helpUrl: 'https://openrouter.ai/keys' },
  { id: 11, name: 'Cohere', description: 'Command models, free trial key', icon: 'cohere', auth_type: 'api_key', helpUrl: 'https://dashboard.cohere.com/api-keys' },
];

export const SEED_PROVIDERS: SeedProvider[] = [
  { id: 1, id_app: 1, api_base_url: 'https://api.openai.com/v1' },
  { id: 2, id_app: 2, api_base_url: 'https://api.anthropic.com/v1' },
  { id: 3, id_app: 3, api_base_url: 'https://api.deepseek.com/v1' },
  { id: 4, id_app: 7, api_base_url: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 5, id_app: 8, api_base_url: 'https://api.groq.com/openai/v1' },
  { id: 6, id_app: 9, api_base_url: 'https://api.mistral.ai/v1' },
  { id: 7, id_app: 10, api_base_url: 'https://openrouter.ai/api/v1' },
  { id: 8, id_app: 11, api_base_url: 'https://api.cohere.com/v1' },
];

export const STATUS_SEED = {
  chat: [
    { id: 1, label: 'active' },
    { id: 2, label: 'archived' },
    { id: 3, label: 'deleted' },
  ],
  message: [
    { id: 1, label: 'active' },
    { id: 2, label: 'deleted' },
  ],
  tool_call: [
    { id: 1, label: 'pending' },
    { id: 2, label: 'approved' },
    { id: 3, label: 'rejected' },
    { id: 4, label: 'completed' },
    { id: 5, label: 'failed' },
  ],
};

export const SETTINGS_SEED: SeedSetting[] = [
  { key: 'require_confirmation', label: 'Require confirmation before actions', description: 'Ask for approval before the AI performs any action in a connected app.', value: 'true' },
  { key: 'max_tool_calls_per_turn', label: 'Max chained actions per message', description: 'Upper limit on how many tool calls the AI can chain in a single turn.', value: '5' },
  { key: 'max_requests_per_day', label: 'Daily request limit', description: 'Upper limit on chat requests per day, used as a budget guardrail.', value: '200' },
  { key: 'voice_output_enabled', label: 'Read replies aloud', description: 'Whether the assistant speaks its replies using on-device text-to-speech.', value: 'true' },
];
```

- [ ] **Step 2: Write seed** — `src/domains/apps/seed.ts`

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { SEED_APPS, SEED_PROVIDERS, SETTINGS_SEED, STATUS_SEED } from '../../constants/apps';

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM apps');
  if ((row?.c ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    for (const s of STATUS_SEED.chat) {
      await db.runAsync('INSERT INTO status_chat (id, label) VALUES (?, ?)', s.id, s.label);
    }
    for (const s of STATUS_SEED.message) {
      await db.runAsync('INSERT INTO status_message (id, label) VALUES (?, ?)', s.id, s.label);
    }
    for (const s of STATUS_SEED.tool_call) {
      await db.runAsync('INSERT INTO status_tool_call (id, label) VALUES (?, ?)', s.id, s.label);
    }
    for (const app of SEED_APPS) {
      await db.runAsync(
        'INSERT INTO apps (id, name, description, icon, auth_type) VALUES (?, ?, ?, ?, ?)',
        app.id, app.name, app.description, app.icon, app.auth_type
      );
    }
    for (const p of SEED_PROVIDERS) {
      await db.runAsync(
        'INSERT INTO providers (id, id_app, api_base_url, created_at) VALUES (?, ?, ?, ?)',
        p.id, p.id_app, p.api_base_url, Date.now()
      );
    }
    for (const app of SEED_APPS) {
      await db.runAsync(
        'INSERT INTO historique_apps_status (id_app, is_enabled, modified_at) VALUES (?, 0, ?)',
        app.id, Date.now()
      );
    }
    for (const s of SETTINGS_SEED) {
      await db.runAsync(
        'INSERT INTO settings (key, label, description, value, modified_at) VALUES (?, ?, ?, ?, ?)',
        s.key, s.label, s.description, s.value, Date.now()
      );
    }
  });
}
```

- [ ] **Step 3: Wire seed into getDb** — modify `src/store/db.ts`

```ts
import { seedDatabase } from '../domains/apps/seed';
// in openAndMigrate(), after the migration loop, before the dev log:
await seedDatabase(db);
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

Add temporarily (dev-only, removed before commit):

```ts
const counts = await db.getFirstAsync<{ apps: number; providers: number }>(
  'SELECT (SELECT COUNT(*) FROM apps) AS apps, (SELECT COUNT(*) FROM providers) AS providers'
);
console.log('[db] seeded:', counts);
```

Run: `pnpm android`. Expected log: `[db] seeded: { apps: 11, providers: 8 }`. Restart the app → seed does not duplicate (count stays 11).

- [ ] **Step 6: Commit**

```bash
git add src/constants/apps.ts src/domains/apps/seed.ts src/store/db.ts
git commit -m "feat: seed apps registry and status tables on first launch"
```

---

### Task 8: Secure storage wrapper (Frontend 1.3)

**Files:**
- Create: `src/domains/apps/secureStorage.ts`

**Interfaces:**
- Consumes: `expo-secure-store` (in `package.json`)
- Produces (exported names used by Tasks 14–15):
  - `saveApiKey(appId: number, apiKey: string): Promise<void>`
  - `getApiKey(appId: number): Promise<string | null>`
  - `deleteApiKey(appId: number): Promise<void>`
  - `saveTokenPair(appId: number, tokens: TokenPair): Promise<void>`
  - `getTokenPair(appId: number): Promise<TokenPair | null>`
  - `deleteTokenPair(appId: number): Promise<void>`
  - Keystore key convention `apikey_<appId>` / `oauth_<appId>`

- [ ] **Step 1: Write the module**

```ts
import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from './types';

function keyName(appId: number, kind: 'apikey' | 'oauth') {
  return `${kind}_${appId}`;
}

export async function saveApiKey(appId: number, apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(keyName(appId, 'apikey'), apiKey);
}

export async function getApiKey(appId: number): Promise<string | null> {
  return SecureStore.getItemAsync(keyName(appId, 'apikey'));
}

export async function deleteApiKey(appId: number): Promise<void> {
  await SecureStore.deleteItemAsync(keyName(appId, 'apikey'));
}

export async function saveTokenPair(appId: number, tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(keyName(appId, 'oauth'), JSON.stringify(tokens));
}

export async function getTokenPair(appId: number): Promise<TokenPair | null> {
  const raw = await SecureStore.getItemAsync(keyName(appId, 'oauth'));
  return raw ? (JSON.parse(raw) as TokenPair) : null;
}

export async function deleteTokenPair(appId: number): Promise<void> {
  await SecureStore.deleteItemAsync(keyName(appId, 'oauth'));
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. (This requires `src/domains/apps/types.ts` to exist; create `TokenPair` there in Task 9 first — see ordering note below.)

> Ordering note: Task 8 imports `TokenPair` from `./types`. Implement Task 9's `types.ts` first so this compiles cleanly. Either order works as long as `TokenPair` is defined before typecheck.

- [ ] **Step 3: Manual QA**

Run: `pnpm android`. Not user-visible yet; correctness is exercised in Tasks 14–15. Sanity-check via the Metro console by temporarily logging `getApiKey(1)` → expect `null` on fresh install.

- [ ] **Step 4: Commit**

```bash
git add src/domains/apps/secureStorage.ts
git commit -m "feat: add secure storage wrapper for api keys and token pairs"
```

---

### Task 9: API client + domain types (Frontend 1.3 prerequisite plumbing)

**Files:**
- Create: `src/services/api.ts`, `src/domains/apps/types.ts`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_API_URL` (from `.env`, see `.env.example`)
- Produces:
  - `export const api = { get<T>(path): Promise<T>; post<T>(path, body): Promise<T> }` — base URL from `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`, JSON headers, throws `Error` with the backend's `error` field on non-2xx
  - `export type AuthType = 'api_key' | 'oauth'`
  - `export interface AppWithStatus { id: number; name: string; description: string | null; icon: string; auth_type: AuthType; is_enabled: boolean; is_ai: boolean }`
  - `export interface TokenPair { access_token: string; refresh_token: string | null }`
  - `export interface VerifyResult { ok: boolean; note?: string }`
  - `export interface ModelInfo { raw_name: string; display_name: string }`

- [ ] **Step 1: Write api client** — `src/services/api.ts`

```ts
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};
```

- [ ] **Step 2: Write domain types** — `src/domains/apps/types.ts`

```ts
export type AuthType = 'api_key' | 'oauth';

export interface AppWithStatus {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  auth_type: AuthType;
  is_enabled: boolean;
  is_ai: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string | null;
}

export interface VerifyResult {
  ok: boolean;
  note?: string;
}

export interface ModelInfo {
  raw_name: string;
  display_name: string;
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. If tsc reports `Cannot find name 'process'`, check that Expo SDK 57 env typing resolves (it is built into `expo/tsconfig.base`); if it still fails, report the exact error before moving on.

- [ ] **Step 4: Manual QA**

Nothing to see on device yet. Verify the client end-to-end by temporarily calling `api.get<{ status: string }>('/health')` in a dev screen; delete the call afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts src/domains/apps/types.ts
git commit -m "feat: add typed api client and app domain types"
```

---

### Task 10: Apps store + API + list/toggle hooks (Frontend 1.4 data layer)

**Files:**
- Create: `src/domains/apps/store.ts`, `src/domains/apps/api.ts`, `src/domains/apps/hooks.ts`

**Interfaces:**
- Consumes: `getDb` (Task 6), `api` (Task 9), types (Task 9)
- Produces:
  - `export async function listApps(db: SQLiteDatabase): Promise<AppWithStatus[]>` — apps joined with `current_app_status` and `providers`
  - `export async function setAppEnabled(db: SQLiteDatabase, appId: number, enabled: boolean): Promise<void>` — inserts a `historique_apps_status` row with `Date.now()`
  - `export async function cacheProviderModels(db: SQLiteDatabase, appId: number, models: ModelInfo[]): Promise<void>` — upserts into `ai_models` for the app's provider row
  - `export function verifyCredential(idApp: number, apiKey: string): Promise<VerifyResult>`
  - `export function exchangeOAuth(idApp: number, code: string): Promise<TokenPair>`
  - `export function useAppsList()` → React Query result of `AppWithStatus[]`
  - `export function useToggleApp()` → mutation `{ appId, enabled }`, invalidates `['apps']`
  - (connect mutations are added in Tasks 14 and 16, and `discoverModels` lives in `src/domains/providers/api.ts` in Task 16)

- [ ] **Step 1: Write store** — `src/domains/apps/store.ts`

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { AppWithStatus, ModelInfo } from './types';

export async function listApps(db: SQLiteDatabase): Promise<AppWithStatus[]> {
  return db.getAllAsync<AppWithStatus>(
    `SELECT a.id, a.name, a.description, a.icon, a.auth_type,
            COALESCE(cas.is_enabled, 0) AS is_enabled,
            CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS is_ai
     FROM apps a
     LEFT JOIN current_app_status cas ON cas.id_app = a.id
     LEFT JOIN providers p ON p.id_app = a.id
     ORDER BY a.id`
  );
}

export async function setAppEnabled(db: SQLiteDatabase, appId: number, enabled: boolean): Promise<void> {
  await db.runAsync(
    'INSERT INTO historique_apps_status (id_app, is_enabled, modified_at) VALUES (?, ?, ?)',
    appId, enabled ? 1 : 0, Date.now()
  );
}

export async function cacheProviderModels(db: SQLiteDatabase, appId: number, models: ModelInfo[]): Promise<void> {
  const provider = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM providers WHERE id_app = ?',
    appId
  );
  if (!provider) return;
  for (const m of models) {
    await db.runAsync(
      `INSERT INTO ai_models (id_provider, raw_name, display_name, is_available, fetched_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(id_provider, raw_name) DO UPDATE SET
         display_name = excluded.display_name,
         is_available = 1,
         fetched_at = excluded.fetched_at`,
      provider.id, m.raw_name, m.display_name, Date.now()
    );
  }
}
```

- [ ] **Step 2: Write domain api** — `src/domains/apps/api.ts`

```ts
import { api } from '../../services/api';
import type { TokenPair, VerifyResult } from './types';

export function verifyCredential(idApp: number, apiKey: string): Promise<VerifyResult> {
  return api.post<VerifyResult>('/apps/verify', { id_app: idApp, api_key: apiKey });
}

export function exchangeOAuth(idApp: number, code: string): Promise<TokenPair> {
  return api.post<TokenPair>('/apps/oauth/exchange', { id_app: idApp, code });
}
```

- [ ] **Step 3: Write hooks** — `src/domains/apps/hooks.ts`

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../../store/db';
import { listApps, setAppEnabled } from './store';

export function useAppsList() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: async () => {
      const db = await getDb();
      return listApps(db);
    },
  });
}

export function useToggleApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, enabled }: { appId: number; enabled: boolean }) => {
      const db = await getDb();
      await setAppEnabled(db, appId, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

Nothing user-visible yet; the hooks are exercised from Task 11 onward. Sanity: temporarily render `JSON.stringify(data)` from `useAppsList()` in the Apps tab and confirm 11 rows with correct `is_ai`/`is_enabled`; remove afterwards.

- [ ] **Step 6: Commit**

```bash
git add src/domains/apps/store.ts src/domains/apps/api.ts src/domains/apps/hooks.ts
git commit -m "feat: add apps list, toggle, and store queries"
```

---

### Task 11: Apps list screen (Frontend 1.4)

**Files:**
- Create: `src/domains/apps/components/AppList.tsx`
- Modify: `app/(tabs)/apps.tsx` (empty stub)

**Interfaces:**
- Consumes: `useAppsList` (Task 10), `AppWithStatus` (Task 9), expo-router `router.push`
- Produces: `export function AppList({ items, isLoading }: { items: AppWithStatus[]; isLoading: boolean })` — FlatList of rows (icon, name, description, AI badge, enabled pill) that navigate to `/apps/<id>`

- [ ] **Step 1: Write AppList component** — `src/domains/apps/components/AppList.tsx`

```tsx
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { AppWithStatus } from '../types';

export function AppList({ items, isLoading }: { items: AppWithStatus[]; isLoading: boolean }) {
  const router = useRouter();
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
          className="mb-3 flex-row items-center rounded-2xl border border-gray-100 bg-white p-4"
          onPress={() => router.push(`/apps/${item.id}`)}
        >
          <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <Text className="text-xl font-bold text-gray-700">{item.icon[0].toUpperCase()}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
            <Text className="text-sm text-gray-500" numberOfLines={1}>
              {item.description}
            </Text>
          </View>
          <View className="mr-2 rounded-full bg-blue-50 px-2 py-1">
            <Text className="text-xs font-medium text-accent">{item.is_ai ? 'AI' : 'App'}</Text>
          </View>
          <View className={`rounded-full px-2 py-1 ${item.is_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Text className={`text-xs font-medium ${item.is_enabled ? 'text-primary' : 'text-gray-500'}`}>
              {item.is_enabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}
```

- [ ] **Step 2: Write Apps screen** — `app/(tabs)/apps.tsx`

```tsx
import { View } from 'react-native';
import { AppList } from '../../src/domains/apps/components/AppList';
import { useAppsList } from '../../src/domains/apps/hooks';

export default function AppsScreen() {
  const { data, isLoading } = useAppsList();
  return (
    <View className="flex-1 bg-gray-50">
      <AppList items={data ?? []} isLoading={isLoading} />
    </View>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `pnpm android`, open the Apps tab. Expected: 11 rows (OpenAI, Anthropic, DeepSeek, Gmail, Messenger, WhatsApp, Google Gemini, Groq, Mistral AI, OpenRouter, Cohere), each with an AI/App badge and a gray "Disabled" pill. Tapping a row navigates to `/apps/<id>` (the detail screen is Task 13; it may be blank — fine).

- [ ] **Step 5: Commit**

```bash
git add src/domains/apps/components/AppList.tsx "app/(tabs)/apps.tsx"
git commit -m "feat: add apps list screen with status badges"
```

---

### Task 12: Search and filter logic (Frontend 1.5)

**Files:**
- Create: `src/domains/apps/filterApps.ts`, `src/domains/apps/components/FilterBar.tsx`
- Modify: `app/(tabs)/apps.tsx`

**Interfaces:**
- Consumes: `AppWithStatus` (Task 9)
- Produces:
  - `export interface AppFilters { enabled: 'all' | 'enabled' | 'disabled'; kind: 'all' | 'ai' | 'app' }`
  - `export function filterApps(list: AppWithStatus[], query: string, filters: AppFilters): AppWithStatus[]` — pure, in-memory, case-insensitive on `name` + `description`
  - `export function FilterBar({ value, onChange }: { value: AppFilters; onChange: (f: AppFilters) => void })` — chips for kind and enabled state

- [ ] **Step 1: Write the pure function**

```ts
import type { AppWithStatus } from './types';

export interface AppFilters {
  enabled: 'all' | 'enabled' | 'disabled';
  kind: 'all' | 'ai' | 'app';
}

export function filterApps(
  list: AppWithStatus[],
  query: string,
  filters: AppFilters
): AppWithStatus[] {
  const q = query.trim().toLowerCase();
  return list.filter((app) => {
    if (filters.kind === 'ai' && !app.is_ai) return false;
    if (filters.kind === 'app' && app.is_ai) return false;
    if (filters.enabled === 'enabled' && !app.is_enabled) return false;
    if (filters.enabled === 'disabled' && app.is_enabled) return false;
    if (q && !`${app.name} ${app.description ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
```

- [ ] **Step 2: Write FilterBar** — `src/domains/apps/components/FilterBar.tsx`

```tsx
import { Pressable, ScrollView, Text } from 'react-native';
import type { AppFilters } from '../filterApps';

const KIND_OPTIONS: Array<{ value: AppFilters['kind']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'app', label: 'Apps' },
];

const ENABLED_OPTIONS: Array<{ value: AppFilters['enabled']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
    </Pressable>
  );
}

export function FilterBar({
  value,
  onChange,
}: {
  value: AppFilters;
  onChange: (filters: AppFilters) => void;
}) {
  return (
    <ScrollView horizontal className="px-4 py-2" showsHorizontalScrollIndicator={false}>
      {KIND_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          active={value.kind === o.value}
          onPress={() => onChange({ ...value, kind: o.value })}
        />
      ))}
      {ENABLED_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          active={value.enabled === o.value}
          onPress={() => onChange({ ...value, enabled: o.value })}
        />
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Wire into Apps screen** — modify `app/(tabs)/apps.tsx`

```tsx
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppList } from '../../src/domains/apps/components/AppList';
import { FilterBar } from '../../src/domains/apps/components/FilterBar';
import { filterApps } from '../../src/domains/apps/filterApps';
import type { AppFilters } from '../../src/domains/apps/filterApps';
import { useAppsList } from '../../src/domains/apps/hooks';

const DEFAULT_FILTERS: AppFilters = { enabled: 'all', kind: 'all' };

export default function AppsScreen() {
  const { data, isLoading } = useAppsList();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AppFilters>(DEFAULT_FILTERS);
  const visible = filterApps(data ?? [], query, filters);
  return (
    <View className="flex-1 bg-gray-50">
      <TextInput
        className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
        placeholder="Search apps…"
        placeholderTextColor="#9CA3AF"
        value={query}
        onChangeText={setQuery}
      />
      <FilterBar value={filters} onChange={setFilters} />
      <AppList items={visible} isLoading={isLoading} />
    </View>
  );
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

Run: `pnpm android`. Type "gmail" → only Gmail. Tap "AI" chip → only the 8 AI rows. Tap "Enabled" chip → empty (nothing enabled yet). All in-memory; no new queries per keystroke (Metro network tab shows no DB calls).

- [ ] **Step 6: Commit**

```bash
git add src/domains/apps/filterApps.ts src/domains/apps/components/FilterBar.tsx "app/(tabs)/apps.tsx"
git commit -m "feat: add in-memory search and filter for apps list"
```

---

### Task 13: App detail view + toggle (Frontend 1.6)

**Files:**
- Create: `src/domains/apps/components/AppToggle.tsx`
- Modify: `app/apps/[appsId].tsx` (empty stub)

**Interfaces:**
- Consumes: `useAppsList`, `useToggleApp` (Task 10), `SEED_APPS` (Task 7), `AppWithStatus`
- Produces:
  - `export function AppToggle({ app }: { app: AppWithStatus })` — Switch bound to `app.is_enabled` via `useToggleApp`
  - The detail screen renders name, description, "How to enable this?" link (from `SEED_APPS.helpUrl`, opened via `Linking`), the toggle, and a Connect button (wired in Tasks 14–15)

- [ ] **Step 1: Write AppToggle** — `src/domains/apps/components/AppToggle.tsx`

```tsx
import { Switch, Text, View } from 'react-native';
import { useToggleApp } from '../hooks';
import type { AppWithStatus } from '../types';

export function AppToggle({ app }: { app: AppWithStatus }) {
  const toggle = useToggleApp();
  return (
    <View className="mt-6 flex-row items-center justify-between">
      <Text className="text-base font-medium text-gray-900">Enabled</Text>
      <Switch
        value={app.is_enabled}
        onValueChange={(value) => toggle.mutate({ appId: app.id, enabled: value })}
        trackColor={{ true: '#22C55E' }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Write detail screen** — `app/apps/[appsId].tsx`

```tsx
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { AppToggle } from '../../src/domains/apps/components/AppToggle';
import { SEED_APPS } from '../../src/constants/apps';
import { useAppsList } from '../../src/domains/apps/hooks';

export default function AppDetailScreen() {
  const { appsId } = useLocalSearchParams<{ appsId: string }>();
  const id = Number(appsId);
  const { data } = useAppsList();
  const app = data?.find((a) => a.id === id);
  const meta = SEED_APPS.find((a) => a.id === id);

  if (!app || !meta) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">App not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold text-gray-900">{app.name}</Text>
      <Text className="mt-1 text-gray-500">{app.description}</Text>
      {meta.helpUrl ? (
        <Pressable onPress={() => Linking.openURL(meta.helpUrl)}>
          <Text className="mt-2 font-medium text-accent">How to enable this?</Text>
        </Pressable>
      ) : null}
      <AppToggle app={app} />
    </View>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `pnpm android`. Open OpenAI from the list. Flip "Enabled" on → pill in the list becomes green/Enabled on return. Toggle again → disabled. Help link opens the browser.

- [ ] **Step 5: Commit**

```bash
git add src/domains/apps/components/AppToggle.tsx "app/apps/[appsId].tsx"
git commit -m "feat: add app detail screen with enable toggle and help link"
```

---

### Task 14: Credential modal + API-key connect flow (Frontend 1.7–1.10)

**Files:**
- Create: `src/services/toast.ts`, `src/domains/apps/components/CredentialModal.tsx`
- Modify: `src/domains/apps/hooks.ts` (add `useConnectApiKey`), `app/apps/[appsId].tsx` (render modal + Connect button)

**Interfaces:**
- Consumes: `verifyCredential` (Task 10), `saveApiKey` (Task 8), `setAppEnabled` (Task 10), `getDb` (Task 6)
- Produces:
  - `export function showToast(message: string)` — Android `ToastAndroid`/iOS `Alert`
  - `export function useConnectApiKey()` — mutation `{ appId: number; apiKey: string }`; on `ok` saves the key, enables the app, invalidates `['apps']`, returns the result; throws `Error('invalid_credentials')` when verification fails (nothing stored)
  - `export function CredentialModal({ appId, open, onClose }: { appId: number; open: boolean; onClose: () => void })` — secure text input, Connect button with loading state, inline error message on failure
  - Detail screen shows "Connect" (API-key apps) which opens the modal; success → toast "Connected"; failure → inline message, nothing stored

- [ ] **Step 1: Write toast helper** — `src/services/toast.ts`

```ts
import { Alert, Platform, ToastAndroid } from 'react-native';

export function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
}
```

- [ ] **Step 2: Add connect mutation** — modify `src/domains/apps/hooks.ts`

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb } from '../../store/db';
import { verifyCredential } from './api';
import * as secureStorage from './secureStorage';
import { listApps, setAppEnabled } from './store';

export function useConnectApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, apiKey }: { appId: number; apiKey: string }) => {
      const result = await verifyCredential(appId, apiKey);
      if (!result.ok) {
        throw new Error('invalid_credentials');
      }
      await secureStorage.saveApiKey(appId, apiKey);
      const db = await getDb();
      await setAppEnabled(db, appId, true);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}
```

- [ ] **Step 3: Write CredentialModal** — `src/domains/apps/components/CredentialModal.tsx`

```tsx
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useConnectApiKey } from '../hooks';
import { showToast } from '../../../services/toast';

export function CredentialModal({
  appId,
  open,
  onClose,
}: {
  appId: number;
  open: boolean;
  onClose: () => void;
}) {
  const connect = useConnectApiKey();
  const [apiKey, setApiKey] = useState('');

  const handleConnect = async () => {
    try {
      await connect.mutateAsync({ appId, apiKey });
      setApiKey('');
      onClose();
      showToast('Connected');
    } catch (err) {
      setApiKey('');
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40">
        <View className="w-4/5 rounded-2xl bg-white p-6">
          <Text className="text-lg font-semibold text-gray-900">Enter API key</Text>
          <TextInput
            className="mt-4 rounded-xl border border-gray-200 px-4 py-3 text-gray-900"
            placeholder="sk-..."
            placeholderTextColor="#9CA3AF"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {connect.isError ? (
            <Text className="mt-2 text-sm text-red-500">
              Verify your credentials and try again.
            </Text>
          ) : null}
          <View className="mt-6 flex-row justify-end gap-3">
            <Pressable onPress={onClose} disabled={connect.isPending}>
              <Text className="px-4 py-2 text-gray-500">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConnect}
              disabled={connect.isPending || apiKey.trim().length === 0}
              className="rounded-xl bg-primary px-5 py-2"
            >
              {connect.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-semibold text-white">Connect</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Wire into detail screen** — modify `app/apps/[appsId].tsx`

Add state + Connect button + modal. For `auth_type === 'api_key'` apps render:

```tsx
const [modalOpen, setModalOpen] = useState(false);
// ...inside the main View, after <AppToggle app={app} />:
{app.auth_type === 'api_key' ? (
  <Pressable
    className="mt-6 rounded-xl bg-primary py-3"
    onPress={() => setModalOpen(true)}
  >
    <Text className="text-center font-semibold text-white">Connect</Text>
  </Pressable>
) : null}
<CredentialModal appId={app.id} open={modalOpen} onClose={() => setModalOpen(false)} />
```

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual QA**

Run: `pnpm android` (backend `pnpm --dir backend dev` running). Open OpenAI → Connect → enter `sk-invalid` → inline "Verify your credentials" error, list still shows Disabled. Enter a real OpenAI key → toast "Connected", list shows Enabled. Confirm via the Keystore: relaunch app, reopen OpenAI → still Enabled without re-entering the key.

- [ ] **Step 7: Commit**

```bash
git add src/services/toast.ts src/domains/apps/components/CredentialModal.tsx src/domains/apps/hooks.ts "app/apps/[appsId].tsx"
git commit -m "feat: add api-key connect flow with verification and inline errors"
```

---

### Task 15: OAuth connect flow (Frontend 1.11, stub exchange)

**Files:**
- Modify: `src/domains/apps/hooks.ts` (add `useConnectOAuth`), `app/apps/[appsId].tsx` (OAuth Connect button)

**Interfaces:**
- Consumes: `exchangeOAuth` (Task 10), `saveTokenPair` (Task 8), `setAppEnabled` (Task 10)
- Produces: `export function useConnectOAuth()` — mutation `{ appId: number }`; calls the stub exchange, stores the returned token pair in Keystore, enables the app, invalidates `['apps']`
- Deviation note (user chose "stub OAuth"): real browser-consent + redirect capture is deferred until backend client secrets exist. The Sprint 1 flow calls `POST /api/apps/oauth/exchange` directly with a fixed stub code, so the loop is fully testable end-to-end.

- [ ] **Step 1: Add OAuth mutation** — modify `src/domains/apps/hooks.ts`

```ts
import { exchangeOAuth } from './api';
import * as secureStorage from './secureStorage';

export function useConnectOAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId }: { appId: number }) => {
      const tokens = await exchangeOAuth(appId, 'stub-oauth-code');
      await secureStorage.saveTokenPair(appId, tokens);
      const db = await getDb();
      await setAppEnabled(db, appId, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}
```

- [ ] **Step 2: Wire OAuth button** — modify `app/apps/[appsId].tsx`

```tsx
import { useConnectOAuth } from '../../src/domains/apps/hooks';

function ConnectOAuthButton({ appId }: { appId: number }) {
  const connect = useConnectOAuth();
  return (
    <Pressable
      className="mt-6 rounded-xl bg-primary py-3"
      onPress={() => connect.mutate({ appId })}
      disabled={connect.isPending}
    >
      <Text className="text-center font-semibold text-white">
        {connect.isPending ? 'Connecting…' : 'Connect'}
      </Text>
    </Pressable>
  );
}
```

And render `{app.auth_type === 'oauth' ? <ConnectOAuthButton appId={app.id} /> : null}` in the detail view, plus a `useConnectOAuth`-driven success toast — reuse the Task 14 pattern: wrap `mutateAsync` and `showToast('Connected')`.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `pnpm android` (backend running). Open Gmail → Connect → toast "Connected", Enabled pill green. Relaunch app → still Enabled (token pair persisted in Keystore, not SQLite).

- [ ] **Step 5: Commit**

```bash
git add src/domains/apps/hooks.ts "app/apps/[appsId].tsx"
git commit -m "feat: add oauth connect flow via stub exchange"
```

---

### Task 16: Model sync on AI connect (Backend 1.3 → frontend cache)

**Files:**
- Create: `src/domains/providers/api.ts`
- Modify: `src/domains/apps/hooks.ts` (model sync in `useConnectApiKey`)

**Interfaces:**
- Consumes: `discoverModels` (below), `cacheProviderModels` (Task 10), `getApiKey` (Task 8)
- Produces:
  - `export function discoverModels(idApp: number, apiKey: string): Promise<ModelInfo[]>` — POST `/providers/models`, returns `.models`
  - `useConnectApiKey` now caches the fetched model list into `ai_models` right after a successful connect for AI apps

- [ ] **Step 1: Write providers api** — `src/domains/providers/api.ts`

```ts
import { api } from '../../services/api';
import type { ModelInfo } from '../apps/types';

export function discoverModels(idApp: number, apiKey: string): Promise<ModelInfo[]> {
  return api
    .post<{ models: ModelInfo[] }>('/providers/models', { id_app: idApp, api_key: apiKey })
    .then((r) => r.models);
}
```

- [ ] **Step 2: Sync models in connect hook** — modify `src/domains/apps/hooks.ts`

```ts
import { discoverModels } from '../providers/api';
// inside useConnectApiKey mutationFn, after setAppEnabled(db, appId, true):
if (result.note == null) {
  const models = await discoverModels(appId, apiKey).catch(() => []);
  await cacheProviderModels(db, appId, models);
}
```

(`result.note == null` means it was a real provider verification, not the OAuth stub.)

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Run: `pnpm android` (backend running). Connect OpenAI with a valid key. In Metro console (temporary dev log in `cacheProviderModels`, removed before commit) expect a few model rows written to `ai_models`. Query check:

```ts
const m = await db.getAllAsync<{ raw_name: string }>('SELECT raw_name FROM ai_models');
console.log('[db] cached models:', m.length);
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/providers/api.ts src/domains/apps/hooks.ts
git commit -m "feat: cache discovered models after provider connect"
```

---

## Sprint 1 done-when cross-check

| STEPS.md requirement | Task |
|---|---|
| 1.1 local DB setup (migration runner) | 6 |
| 1.2 seed apps registry from constants | 7 |
| 1.3 secure storage wrapper | 8 |
| 1.4 apps list (apps + status + providers) | 10, 11 |
| 1.5 search/filter in memory | 12 |
| 1.6 app detail (toggle, help link, connect) | 13 |
| 1.7 credential modal (api_key vs oauth) | 14, 15 |
| 1.8 verification flow before anything else | 14 |
| 1.9 success → store credential + enable + toast | 14 |
| 1.10 failure → inline error, nothing stored | 14 |
| 1.11 OAuth exchange → store token pair | 15 |
| Backend 1.1 verify endpoint | 3 |
| Backend 1.2 OAuth exchange | 4 |
| Backend 1.3 model discovery | 5 |
| ai_models populated (CONCEPTION §5 live cache) | 16 |

All tasks verified by `npx tsc --noEmit` / `pnpm --dir backend exec tsc --noEmit` plus the manual QA step in each task.

## Self-review

- **Spec coverage:** every STEPS §1 frontend and backend item maps to a task above. Task 1 (shell) and Task 16 (model caching) are the only additions beyond STEPS; Task 1 is required scaffolding, Task 16 is required by CONCEPTION §5 (`ai_models` is a live cache).
- **Placeholder scan:** Task 6's migration contains the full schema DDL verbatim from `backend/schema.sql` — no ellipses, no "copy later". Every task has real code and a concrete verification step.
- **Type consistency:** `AppWithStatus`, `TokenPair`, `VerifyResult`, `ModelInfo`, `AppFilters` are defined once (Task 9 / Task 12) and referenced identically across all consuming tasks. Backend route/service names match their producers (`verifyCredential`, `exchangeOAuth`, `listModels`, `listModelsForProvider`, `verifyApiKey`).
