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
        'INSERT INTO providers (id, id_app, api_base_url, supports_tool_calling, created_at) VALUES (?, ?, ?, ?, ?)',
        p.id, p.id_app, p.api_base_url, p.supports_tool_calling ? 1 : 0, Date.now()
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
