/** Diary entries: what was eaten, when, and how much. */
import type { SQLiteDatabase } from 'expo-sqlite';

import { cleanNutrients, scaleNutrients, sumNutrients, type Nutrients } from '@/domain/nutrients';
import { portionNutrients } from '@/domain/portion';
import type { BaseUnit, DiaryEntry, Food, Meal, Serving } from '@/domain/types';
import { timestampFor } from '@/domain/dates';

import { emit } from '../events';

interface EntryRow {
  id: number;
  date: string;
  meal: Meal;
  food_id: number | null;
  name: string;
  name_he: string | null;
  brand: string | null;
  serving_label: string;
  serving_label_he: string | null;
  serving_amount: number;
  quantity: number;
  base_unit: BaseUnit;
  nutrients: string;
  logged_at: string;
}

function rowToEntry(r: EntryRow): DiaryEntry {
  let nutrients: Nutrients = {};
  try {
    nutrients = JSON.parse(r.nutrients);
  } catch {
    // keep empty; a corrupt row should not break the whole day
  }
  return {
    id: r.id,
    date: r.date,
    meal: r.meal,
    foodId: r.food_id,
    name: r.name,
    nameHe: r.name_he,
    brand: r.brand,
    servingLabel: r.serving_label,
    servingLabelHe: r.serving_label_he,
    servingAmount: r.serving_amount,
    quantity: r.quantity,
    baseUnit: r.base_unit,
    nutrients,
    loggedAt: r.logged_at,
  };
}

export async function entriesForDate(db: SQLiteDatabase, date: string): Promise<DiaryEntry[]> {
  const rows = await db.getAllAsync<EntryRow>('SELECT * FROM diary_entries WHERE date = ? ORDER BY logged_at, id', date);
  return rows.map(rowToEntry);
}

export async function getEntry(db: SQLiteDatabase, id: number): Promise<DiaryEntry | null> {
  const r = await db.getFirstAsync<EntryRow>('SELECT * FROM diary_entries WHERE id = ?', id);
  return r ? rowToEntry(r) : null;
}

export function totals(entries: DiaryEntry[]): Nutrients {
  return sumNutrients(entries.map((e) => e.nutrients));
}

interface InsertArgs {
  date: string;
  meal: Meal;
  foodId: number | null;
  name: string;
  nameHe?: string | null;
  brand?: string | null;
  servingLabel: string;
  servingLabelHe?: string | null;
  servingAmount: number;
  quantity: number;
  baseUnit: BaseUnit;
  nutrients: Nutrients;
  loggedAt?: string;
}

async function insertEntry(db: SQLiteDatabase, a: InsertArgs): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO diary_entries
       (date, meal, food_id, name, name_he, brand, serving_label, serving_label_he, serving_amount, quantity, base_unit, nutrients, logged_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    a.date,
    a.meal,
    a.foodId,
    a.name,
    a.nameHe ?? null,
    a.brand ?? null,
    a.servingLabel,
    a.servingLabelHe ?? null,
    a.servingAmount,
    a.quantity,
    a.baseUnit,
    JSON.stringify(cleanNutrients(a.nutrients)),
    a.loggedAt ?? timestampFor(a.date),
    new Date().toISOString(),
  );
  return res.lastInsertRowId;
}

/** Log a catalogue food. */
export async function logFood(
  db: SQLiteDatabase,
  args: { date: string; meal: Meal; food: Food; serving: Serving; quantity: number; loggedAt?: string },
): Promise<number> {
  const { food, serving, quantity } = args;
  const id = await insertEntry(db, {
    date: args.date,
    meal: args.meal,
    foodId: food.id,
    name: food.name,
    nameHe: food.nameHe,
    brand: food.brand,
    servingLabel: serving.label,
    servingLabelHe: serving.labelHe ?? null,
    servingAmount: serving.amount,
    quantity,
    baseUnit: food.baseUnit,
    nutrients: portionNutrients(food, serving.amount, quantity),
    loggedAt: args.loggedAt,
  });
  emit('diary');
  return id;
}

/** Log raw calories/macros without a catalogue food. */
export async function quickAdd(
  db: SQLiteDatabase,
  args: { date: string; meal: Meal; name: string; nutrients: Nutrients },
): Promise<number> {
  const id = await insertEntry(db, {
    date: args.date,
    meal: args.meal,
    foodId: null,
    name: args.name,
    servingLabel: 'Quick add',
    servingLabelHe: 'הוספה מהירה',
    servingAmount: 1,
    quantity: 1,
    baseUnit: 'serving',
    nutrients: args.nutrients,
  });
  emit('diary');
  return id;
}

/**
 * Change an entry's portion. With a catalogue food the totals are recomputed from it;
 * otherwise (quick add, or a deleted food) the stored totals are scaled by the size ratio.
 */
export async function updateEntryPortion(
  db: SQLiteDatabase,
  entry: DiaryEntry,
  change: { meal: Meal; quantity: number; serving?: Serving; food?: Food | null; loggedAt?: string; nutrients?: Nutrients },
): Promise<void> {
  const serving = change.serving ?? { label: entry.servingLabel, labelHe: entry.servingLabelHe ?? undefined, amount: entry.servingAmount };
  let nutrients: Nutrients;
  if (change.nutrients) nutrients = change.nutrients;
  else if (change.food) nutrients = portionNutrients(change.food, serving.amount, change.quantity);
  else {
    const oldSize = entry.servingAmount * entry.quantity;
    nutrients = oldSize > 0 ? scaleNutrients(entry.nutrients, (serving.amount * change.quantity) / oldSize) : entry.nutrients;
  }
  await db.runAsync(
    `UPDATE diary_entries SET meal = ?, serving_label = ?, serving_label_he = ?, serving_amount = ?, quantity = ?, nutrients = ?, logged_at = ?
      WHERE id = ?`,
    change.meal,
    serving.label,
    serving.labelHe ?? null,
    serving.amount,
    change.quantity,
    JSON.stringify(cleanNutrients(nutrients)),
    change.loggedAt ?? entry.loggedAt,
    entry.id,
  );
  emit('diary');
}

export async function deleteEntry(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM diary_entries WHERE id = ?', id);
  emit('diary');
}

/** Copy every entry of one meal on `fromDate` into the same meal on `toDate`. Returns how many were copied. */
export async function copyMeal(db: SQLiteDatabase, fromDate: string, toDate: string, meal: Meal, toMeal: Meal = meal): Promise<number> {
  const rows = await db.getAllAsync<EntryRow>('SELECT * FROM diary_entries WHERE date = ? AND meal = ? ORDER BY logged_at', fromDate, meal);
  if (!rows.length) return 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const r of rows) {
      await insertEntry(tx, {
        date: toDate,
        meal: toMeal,
        foodId: r.food_id,
        name: r.name,
        nameHe: r.name_he,
        brand: r.brand,
        servingLabel: r.serving_label,
        servingLabelHe: r.serving_label_he,
        servingAmount: r.serving_amount,
        quantity: r.quantity,
        baseUnit: r.base_unit,
        nutrients: JSON.parse(r.nutrients),
      });
    }
  });
  emit('diary');
  return rows.length;
}

/** Calories per day for a date range (inclusive), for streaks and charts. */
export async function dailyCalories(db: SQLiteDatabase, from: string, to: string): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ date: string; nutrients: string }>(
    'SELECT date, nutrients FROM diary_entries WHERE date BETWEEN ? AND ?',
    from,
    to,
  );
  const out: Record<string, number> = {};
  for (const r of rows) {
    try {
      out[r.date] = (out[r.date] ?? 0) + (JSON.parse(r.nutrients).kcal ?? 0);
    } catch {
      // ignore corrupt row
    }
  }
  return out;
}
