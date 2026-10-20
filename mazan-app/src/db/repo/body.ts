/** Weight and water logs. Stage 3 adds charts, measurements and photos on top of these tables. */
import type { SQLiteDatabase } from 'expo-sqlite';

import { emit } from '../events';

export async function setWeight(db: SQLiteDatabase, date: string, kg: number): Promise<void> {
  await db.runAsync('INSERT INTO weights (date, kg) VALUES (?, ?) ON CONFLICT (date) DO UPDATE SET kg = excluded.kg', date, kg);
  emit('weight');
}

export async function latestWeight(db: SQLiteDatabase): Promise<{ date: string; kg: number } | null> {
  return db.getFirstAsync<{ date: string; kg: number }>('SELECT date, kg FROM weights ORDER BY date DESC LIMIT 1');
}

export async function waterFor(db: SQLiteDatabase, date: string): Promise<number> {
  const r = await db.getFirstAsync<{ ml: number }>('SELECT ml FROM water_log WHERE date = ?', date);
  return r?.ml ?? 0;
}

export async function setWater(db: SQLiteDatabase, date: string, ml: number): Promise<void> {
  await db.runAsync(
    'INSERT INTO water_log (date, ml) VALUES (?, ?) ON CONFLICT (date) DO UPDATE SET ml = excluded.ml',
    date,
    Math.max(0, ml),
  );
  emit('water');
}
