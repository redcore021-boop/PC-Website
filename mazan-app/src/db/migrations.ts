/**
 * Schema migrations, tracked with SQLite's `PRAGMA user_version`.
 * Each entry upgrades the schema by one version. Never edit a shipped migration; append a new one.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { seedFoods } from './seed';

const MIGRATIONS: string[] = [
  // v1 — settings, foods, diary, water, weight
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE foods (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source     TEXT NOT NULL,              -- seed | custom | off | usda | recipe
    source_id  TEXT,                       -- seed key, barcode, FDC id …
    barcode    TEXT,
    name       TEXT NOT NULL,
    name_he    TEXT,
    brand      TEXT,
    base_unit  TEXT NOT NULL DEFAULT 'g',  -- g | ml | serving
    nutrients  TEXT NOT NULL,              -- JSON, per 100 base units (or per 1 serving)
    servings   TEXT NOT NULL,              -- JSON [{label, labelHe?, amount}]
    favorite   INTEGER NOT NULL DEFAULT 0,
    archived   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX foods_source_id ON foods (source, source_id);
  CREATE INDEX foods_barcode ON foods (barcode);

  CREATE TABLE diary_entries (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    date             TEXT NOT NULL,         -- YYYY-MM-DD (local)
    meal             TEXT NOT NULL,
    food_id          INTEGER REFERENCES foods (id) ON DELETE SET NULL,
    name             TEXT NOT NULL,
    name_he          TEXT,
    brand            TEXT,
    serving_label    TEXT NOT NULL,
    serving_label_he TEXT,
    serving_amount   REAL NOT NULL,
    quantity         REAL NOT NULL,
    base_unit        TEXT NOT NULL,
    nutrients        TEXT NOT NULL,         -- JSON totals for this entry
    logged_at        TEXT NOT NULL,         -- ISO timestamp
    created_at       TEXT NOT NULL
  );
  CREATE INDEX diary_date ON diary_entries (date, meal);
  CREATE INDEX diary_food ON diary_entries (food_id);

  CREATE TABLE water_log (
    date TEXT PRIMARY KEY NOT NULL,
    ml   REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE weights (
    date TEXT PRIMARY KEY NOT NULL,
    kg   REAL NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Run on app start by <SQLiteProvider onInit>. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(sql);
      await tx.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }

  await seedFoods(db);
}
