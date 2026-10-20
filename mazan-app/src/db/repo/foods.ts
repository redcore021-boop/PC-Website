/** Food catalogue: local seed foods, custom foods and (stage 2) cached API results. */
import type { SQLiteDatabase } from 'expo-sqlite';

import { cleanNutrients, type Nutrients } from '@/domain/nutrients';
import type { BaseUnit, Food, FoodSource, Serving } from '@/domain/types';

import { emit } from '../events';

interface FoodRow {
  id: number;
  source: FoodSource;
  source_id: string | null;
  barcode: string | null;
  name: string;
  name_he: string | null;
  brand: string | null;
  base_unit: BaseUnit;
  nutrients: string;
  servings: string;
  favorite: number;
}

function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function rowToFood(r: FoodRow): Food {
  const servings = parseJson<Serving[]>(r.servings, []);
  return {
    id: r.id,
    source: r.source,
    sourceId: r.source_id,
    barcode: r.barcode,
    name: r.name,
    nameHe: r.name_he,
    brand: r.brand,
    baseUnit: r.base_unit,
    nutrients: parseJson<Nutrients>(r.nutrients, {}),
    servings: servings.length ? servings : [{ label: '1 serving', labelHe: 'מנה', amount: r.base_unit === 'serving' ? 1 : 100 }],
    favorite: r.favorite === 1,
  };
}

export async function getFood(db: SQLiteDatabase, id: number): Promise<Food | null> {
  const r = await db.getFirstAsync<FoodRow>('SELECT * FROM foods WHERE id = ?', id);
  return r ? rowToFood(r) : null;
}

/** Local search across English and Hebrew names and brands; favourites and often-logged foods first. */
export async function searchLocalFoods(db: SQLiteDatabase, query: string, limit = 50): Promise<Food[]> {
  const q = `%${query.trim()}%`;
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT f.*, (SELECT COUNT(*) FROM diary_entries d WHERE d.food_id = f.id) AS uses
       FROM foods f
      WHERE f.archived = 0 AND (f.name LIKE ? OR f.name_he LIKE ? OR f.brand LIKE ? OR f.barcode = ?)
      ORDER BY f.favorite DESC, uses DESC, length(f.name) ASC
      LIMIT ?`,
    q,
    q,
    q,
    query.trim(),
    limit,
  );
  return rows.map(rowToFood);
}

export async function recentFoods(db: SQLiteDatabase, limit = 40): Promise<Food[]> {
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT f.* FROM foods f
       JOIN (SELECT food_id, MAX(logged_at) AS last FROM diary_entries WHERE food_id IS NOT NULL GROUP BY food_id) d
         ON d.food_id = f.id
      WHERE f.archived = 0
      ORDER BY d.last DESC LIMIT ?`,
    limit,
  );
  return rows.map(rowToFood);
}

/** Most logged foods over the last 90 days. */
export async function frequentFoods(db: SQLiteDatabase, limit = 40): Promise<Food[]> {
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT f.* FROM foods f
       JOIN (SELECT food_id, COUNT(*) AS n FROM diary_entries
              WHERE food_id IS NOT NULL AND date >= date('now', '-90 days')
              GROUP BY food_id) d
         ON d.food_id = f.id
      WHERE f.archived = 0
      ORDER BY d.n DESC LIMIT ?`,
    limit,
  );
  return rows.map(rowToFood);
}

export async function favoriteFoods(db: SQLiteDatabase): Promise<Food[]> {
  const rows = await db.getAllAsync<FoodRow>('SELECT * FROM foods WHERE favorite = 1 AND archived = 0 ORDER BY name');
  return rows.map(rowToFood);
}

export async function myFoods(db: SQLiteDatabase): Promise<Food[]> {
  const rows = await db.getAllAsync<FoodRow>(
    "SELECT * FROM foods WHERE source IN ('custom', 'recipe') AND archived = 0 ORDER BY updated_at DESC",
  );
  return rows.map(rowToFood);
}

export async function setFavorite(db: SQLiteDatabase, id: number, favorite: boolean): Promise<void> {
  await db.runAsync('UPDATE foods SET favorite = ?, updated_at = ? WHERE id = ?', favorite ? 1 : 0, new Date().toISOString(), id);
  emit('foods');
}

export interface NewFood {
  source: FoodSource;
  sourceId?: string | null;
  barcode?: string | null;
  name: string;
  nameHe?: string | null;
  brand?: string | null;
  baseUnit: BaseUnit;
  nutrients: Nutrients;
  servings: Serving[];
}

/** Insert a food, or update it when (source, sourceId) already exists. Returns its id. */
export async function upsertFood(db: SQLiteDatabase, f: NewFood): Promise<number> {
  const now = new Date().toISOString();
  const params = [
    f.source,
    f.sourceId ?? null,
    f.barcode ?? null,
    f.name.trim(),
    f.nameHe?.trim() || null,
    f.brand?.trim() || null,
    f.baseUnit,
    JSON.stringify(cleanNutrients(f.nutrients)),
    JSON.stringify(f.servings),
    now,
    now,
  ] as const;
  const res = await db.runAsync(
    `INSERT INTO foods (source, source_id, barcode, name, name_he, brand, base_unit, nutrients, servings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (source, source_id) DO UPDATE SET
       barcode = excluded.barcode, name = excluded.name, name_he = excluded.name_he, brand = excluded.brand,
       base_unit = excluded.base_unit, nutrients = excluded.nutrients, servings = excluded.servings,
       archived = 0, updated_at = excluded.updated_at`,
    ...params,
  );
  let id = res.lastInsertRowId;
  if (f.sourceId) {
    // On conflict, lastInsertRowId is not the existing row; look it up.
    const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM foods WHERE source = ? AND source_id = ?', f.source, f.sourceId);
    if (row) id = row.id;
  }
  emit('foods');
  return id;
}

/** Foods matching any of the barcode spellings; the user's own version first. */
export async function foodByBarcode(db: SQLiteDatabase, variants: string[]): Promise<Food | null> {
  if (!variants.length) return null;
  const marks = variants.map(() => '?').join(', ');
  const r = await db.getFirstAsync<FoodRow>(
    `SELECT * FROM foods WHERE archived = 0 AND barcode IN (${marks})
      ORDER BY CASE source WHEN 'custom' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`,
    ...variants,
  );
  return r ? rowToFood(r) : null;
}

/**
 * Overwrite a food's details. The row becomes the user's own ('custom', no source id), so a later
 * Open Food Facts refresh can never undo the correction.
 */
export async function updateFood(db: SQLiteDatabase, id: number, f: Omit<NewFood, 'source'>): Promise<void> {
  await db.runAsync(
    `UPDATE foods SET source = 'custom', source_id = NULL,
            barcode = ?, name = ?, name_he = ?, brand = ?, base_unit = ?, nutrients = ?, servings = ?, updated_at = ?
      WHERE id = ?`,
    f.barcode ?? null,
    f.name.trim(),
    f.nameHe?.trim() || null,
    f.brand?.trim() || null,
    f.baseUnit,
    JSON.stringify(cleanNutrients(f.nutrients)),
    JSON.stringify(f.servings),
    new Date().toISOString(),
    id,
  );
  emit('foods');
}

/** Foods are archived rather than deleted so past diary entries keep their link. */
export async function archiveFood(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE foods SET archived = 1, favorite = 0, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
  emit('foods');
}

/** The serving and quantity used the last time this food was logged, for one-tap re-logging. */
export async function lastPortion(db: SQLiteDatabase, foodId: number): Promise<{ servingAmount: number; servingLabel: string; quantity: number } | null> {
  const r = await db.getFirstAsync<{ serving_amount: number; serving_label: string; quantity: number }>(
    'SELECT serving_amount, serving_label, quantity FROM diary_entries WHERE food_id = ? ORDER BY logged_at DESC LIMIT 1',
    foodId,
  );
  return r ? { servingAmount: r.serving_amount, servingLabel: r.serving_label, quantity: r.quantity } : null;
}
