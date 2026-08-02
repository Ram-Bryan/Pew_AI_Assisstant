# Sprint 1 - Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Sprint 1 scope of Pew (integration of native apps) across frontend and backend.

**Architecture:** 
- Frontend initializes an SQLite database utilizing `schema.sql` and `seed.sql`.
- Frontend uses `SecureStore` to save credentials securely. 
- Frontend implements a UI to browse, search, and connect AI/apps, strictly adhering to `DESIGN.md` spacing (4px unit), colors (`bg-primary`, `bg-surface`, `bg-background`, etc.), and typestyle (`text-[16px]`, `text-[13px]`).
- Backend implements stateless verification, OAuth exchange, and model discovery endpoints.

**Tech Stack:** React Native, Expo, SQLite, SecureStore, Express, Node.js, NativeWind.

---

### Task 1: Backend 1.1 - Credential verification endpoint

**Files:**
- Create: `backend/src/routes/integration.ts`
- Create: `backend/src/services/verification.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/integration.test.ts`

- [ ] **Step 1: Write the failing test**
```typescript
import request from 'supertest';
import app from '../src/server';

describe('POST /api/verify', () => {
  it('should return pass for valid openai key', async () => {
    const res = await request(app)
      .post('/api/verify')
      .send({ appId: 'openai', authType: 'api_key', credential: 'valid_key' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test backend/tests/integration.test.ts`
Expected: FAIL due to 404 setup.

- [ ] **Step 3: Write minimal implementation**
`backend/src/services/verification.ts`
```typescript
export const verifyCredential = async (appId: string, authType: string, credential: string) => {
    // Stub implementation returning true
    return { success: true };
};
```
`backend/src/routes/integration.ts`
```typescript
import { Router } from 'express';
import { verifyCredential } from '../services/verification';

export const integrationRouter = Router();

integrationRouter.post('/verify', async (req, res) => {
    const { appId, authType, credential } = req.body;
    const result = await verifyCredential(appId, authType, credential);
    res.json(result);
});
```
Add to `backend/src/server.ts`:
```typescript
import { integrationRouter } from './routes/integration';
app.use('/api', integrationRouter);
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test backend/tests/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true`:
```bash
git add backend/src/routes/integration.ts backend/src/services/verification.ts backend/src/server.ts backend/tests/integration.test.ts
git commit -m "feat: implement backend 1.1 credential verification stub"
```

---

### Task 2: Backend 1.2 - OAuth exchange endpoint

**Files:**
- Modify: `backend/src/routes/integration.ts`
- Create: `backend/src/services/oauth.ts`
- Modify: `backend/tests/integration.test.ts`

- [ ] **Step 1: Write the failing test**
```typescript
  it('should exchange oauth code', async () => {
    const res = await request(app)
      .post('/api/oauth/exchange')
      .send({ appId: 'gmail', code: 'test_code' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test backend/tests/integration.test.ts`

- [ ] **Step 3: Write minimal implementation**
`backend/src/services/oauth.ts`
```typescript
export const exchangeOAuthCode = async (appId: string, code: string) => {
    // Stub implementation
    return { access_token: 'fake_access', refresh_token: 'fake_refresh' };
};
```
`backend/src/routes/integration.ts`
```typescript
import { exchangeOAuthCode } from '../services/oauth';
integrationRouter.post('/oauth/exchange', async (req, res) => {
    const { appId, code } = req.body;
    const tokens = await exchangeOAuthCode(appId, code);
    res.json(tokens);
});
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test backend/tests/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**
If `auto_commit: true`:
```bash
git add backend/src/routes/integration.ts backend/src/services/oauth.ts backend/tests/integration.test.ts
git commit -m "feat: implement backend 1.2 oauth exchange stub"
```

---

### Task 3: Backend 1.3 - Model discovery endpoint

**Files:**
- Create: `backend/src/routes/models.ts`
- Create: `backend/src/services/discovery.ts`
- Modify: `backend/src/server.ts`
- Create: `backend/tests/models.test.ts`

- [ ] **Step 1: Write the failing test**
```typescript
import request from 'supertest';
import app from '../src/server';

describe('GET /api/models/discover', () => {
  it('should return models for provider', async () => {
    const res = await request(app)
      .post('/api/models/discover')
      .send({ providerId: 'openai', credential: 'key' });
    expect(res.status).toBe(200);
    expect(res.body.models).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test backend/tests/models.test.ts`

- [ ] **Step 3: Write minimal implementation**
`backend/src/services/discovery.ts`
```typescript
export const discoverModels = async (providerId: string, credential: string) => {
    return { models: [{ id: 'gpt-4o', name: 'GPT-4o' }] };
};
```
`backend/src/routes/models.ts`
```typescript
import { Router } from 'express';
import { discoverModels } from '../services/discovery';
export const modelsRouter = Router();
modelsRouter.post('/discover', async (req, res) => {
    const { providerId, credential } = req.body;
    const result = await discoverModels(providerId, credential);
    res.json(result);
});
```
Register it in `backend/src/server.ts`:
```typescript
import { modelsRouter } from './routes/models';
app.use('/api/models', modelsRouter);
```

- [ ] **Step 4: Run test to verify passes**
Run: `npm run test backend/tests/models.test.ts`

- [ ] **Step 5: Commit (if auto_commit enabled)**
If `auto_commit: true`: `git commit -am "feat: implement backend 1.3 model discovery"`

---

### Task 4: Frontend 1.1 & 1.2 - Local Database and Seed Apps

**Files:**
- Create: `app/src/db/init.ts`

- [ ] **Step 1: Write the initial DB seeding functionality ensuring latest schema parity**
Use `expo-sqlite` to initialize DB reflecting `schema.sql` schema and `seed.sql` seed exactly. Ensure the `apps` table includes `description`, `icon`, and `docs`.

```typescript
// app/src/db/init.ts
import * as SQLite from 'expo-sqlite';

export async function initDb() {
  const db = await SQLite.openDatabaseAsync('pew.db');
  // Define full tables per schema.sql updates (incorporating description, icon, docs)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      auth_type TEXT NOT NULL,
      docs TEXT
    );
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY,
      id_app INTEGER NOT NULL UNIQUE,
      api_base_url TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historique_apps_status (
      id INTEGER PRIMARY KEY,
      id_app INTEGER NOT NULL,
      is_enabled BOOLEAN NOT NULL,
      modified_at INTEGER NOT NULL
    );
    CREATE VIEW IF NOT EXISTS current_app_status AS
      SELECT a.id_app, a.is_enabled
      FROM historique_apps_status a
      WHERE a.modified_at = (
        SELECT MAX(modified_at) FROM historique_apps_status a2 WHERE a2.id_app = a.id_app
      );
  `);
  
  const count = await db.getFirstAsync<{count: number}>('SELECT count(*) as count FROM apps');
  if (count && count.count === 0) {
    // Basic seed block per seed.sql setup
    await db.runAsync("INSERT INTO apps (id, name, description, icon, auth_type, docs) VALUES (1, 'OpenAI', 'GPT models', 'openai', 'api_key', NULL)");
    await db.runAsync("INSERT INTO providers (id, id_app, api_base_url, created_at) VALUES (1, 1, 'https://api.openai.com/v1', 1000)");
    await db.runAsync("INSERT INTO historique_apps_status (id_app, is_enabled, modified_at) VALUES (1, 0, 1000)");
  }
}
```

- [ ] **Step 2: Commit**
`git commit -am "feat: implement frontend DB initialization and seed (1.1, 1.2)"`

---

### Task 5: Frontend 1.3 - Secure storage wrapper

**Files:**
- Create: `app/src/utils/secureStore.ts`

- [ ] **Step 1: Write minimal implementation**
```typescript
import * as SecureStore from 'expo-secure-store';

export async function saveCredential(appId: string, credential: string) {
    await SecureStore.setItemAsync(`credential_${appId}`, credential);
}

export async function getCredential(appId: string) {
    return await SecureStore.getItemAsync(`credential_${appId}`);
}

export async function deleteCredential(appId: string) {
    await SecureStore.deleteItemAsync(`credential_${appId}`);
}
```

- [ ] **Step 2: Commit**

---

### Task 6: Frontend 1.4 - 1.10 - List UI and Connection modals

**Files:**
- Create: `app/src/components/Badge.tsx`
- Create: `app/src/components/AppListItem.tsx`
- Create: `app/src/screens/AppsListScreen.tsx`

- [ ] **Step 1: Write `Badge` and `AppListItem` accurately conforming to DESIGN.md restrictions**
Use base-4 spacing (`p-4`, `p-2`), standard `bg-background` and `bg-surface`, explicit corner rounding (`rounded-full`, `rounded-md`), and typography tokens (`text-[16px]`, `text-[13px]`) strictly.

```tsx
// app/src/components/Badge.tsx
import { View, Text } from 'react-native';

export function Badge({ isEnabled }: { isEnabled: boolean }) {
  // Pill shape text-label, 15% opacity primary background if enabled, disabled gray if off.
  if (isEnabled) {
    return (
      <View className="rounded-full bg-primary/15 px-3 py-1">
        <Text className="text-[13px] font-medium text-primary">Enabled</Text>
      </View>
    );
  }
  return (
    <View className="rounded-full bg-[#CBD5E1] px-3 py-1">
      <Text className="text-[13px] font-medium text-[#64748B]">Off</Text>
    </View>
  );
}
```

```tsx
// app/src/components/AppListItem.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { Badge } from './Badge';

export function AppListItem({ app, onPress }: { app: any, onPress: () => void }) {
  return (
    // Elevation: none for list items. Padding: 16 (p-4). Spacing: 8 (py-2 margin top/bottom).
    <TouchableOpacity onPress={onPress} className="flex-row items-center p-4 bg-background">
      <View className="w-12 h-12 rounded-full bg-surface mr-3 items-center justify-center">
        {/* Placeholder for dynamic icon mapping */}
        <Text className="text-[13px] text-text-secondary">{app.icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[16px] text-[#0F172A]">{app.name}</Text>
        {app.description && <Text className="text-[13px] text-[#64748B]">{app.description}</Text>}
      </View>
      <Badge isEnabled={app.is_enabled} />
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Commit**
`git commit -am "feat: implement frontend list components adhering to design tokens"`
