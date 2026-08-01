import * as SQLite from 'expo-sqlite';
import { seedDatabase } from '../domains/apps/seed';
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
  await seedDatabase(db);
  if (__DEV__) {
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    console.log('[db] migrated tables:', tables.map((t) => t.name).join(', '));
  }
  return db;
}
