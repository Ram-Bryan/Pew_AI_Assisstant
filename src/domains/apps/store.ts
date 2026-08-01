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
