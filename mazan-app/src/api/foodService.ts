/**
 * Glue between the APIs, the response cache and the local food table.
 * Screens call these instead of the API clients directly.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { foodByBarcode, upsertFood, type NewFood } from '@/db/repo/foods';

import { cached, DAY, readCache, writeCache } from './cache';
import { ApiError, errorKind, type ApiErrorKind } from './http';
import { barcodeVariants, fetchOffProduct, searchOff } from './openFoodFacts';
import { searchUsda } from './usda';

export type BarcodeResult =
  | { kind: 'found'; foodId: number; fromCache: boolean }
  | { kind: 'incomplete'; code: string; name: string; brand: string | null }
  | { kind: 'missing'; code: string }
  | { kind: 'error'; code: string; error: ApiErrorKind };

/**
 * Find a product by barcode: this phone first (works offline, and includes foods the user created or
 * corrected), then Open Food Facts. A product found online is saved locally for next time.
 */
export async function lookupBarcode(db: SQLiteDatabase, raw: string): Promise<BarcodeResult> {
  const variants = barcodeVariants(raw);
  const code = variants[0];

  const local = await foodByBarcode(db, variants);
  if (local) return { kind: 'found', foodId: local.id, fromCache: true };

  // Remember misses for a day so re-scanning an unknown product does not hit the network again.
  const missKey = `off:missing:${code}`;
  const miss = await readCache<true>(db, missKey);
  if (miss && miss.age < DAY) return { kind: 'missing', code };

  try {
    for (const v of variants) {
      const r = await fetchOffProduct(v);
      if (r.kind === 'found') {
        const foodId = await upsertFood(db, { ...r.food, barcode: code });
        return { kind: 'found', foodId, fromCache: false };
      }
      if (r.kind === 'incomplete') return { kind: 'incomplete', code, name: r.name, brand: r.brand };
    }
    await writeCache(db, missKey, true);
    return { kind: 'missing', code };
  } catch (e) {
    return { kind: 'error', code, error: errorKind(e) };
  }
}

export interface SourceResult {
  foods: NewFood[];
  /** Set when the request failed; `foods` may still hold an older cached copy. */
  error?: ApiErrorKind;
  stale?: boolean;
}

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

export async function searchOffCached(db: SQLiteDatabase, query: string): Promise<SourceResult> {
  try {
    const r = await cached(db, `off:search:${norm(query)}`, 3 * DAY, () => searchOff(norm(query)));
    return { foods: r.data, stale: r.stale };
  } catch (e) {
    return { foods: [], error: errorKind(e) };
  }
}

export async function searchUsdaCached(db: SQLiteDatabase, query: string, apiKey: string): Promise<SourceResult> {
  // USDA is English-only; skip the request for Hebrew queries.
  if (/[֐-׿]/.test(query)) return { foods: [] };
  try {
    const r = await cached(db, `usda:search:${norm(query)}`, 7 * DAY, () => searchUsda(norm(query), apiKey));
    return { foods: r.data, stale: r.stale };
  } catch (e) {
    return { foods: [], error: e instanceof ApiError ? e.kind : 'offline' };
  }
}

/**
 * Save an online result to the food table (or refresh it) and return its id.
 * A product the user already has under the same barcode (for example one they corrected) wins.
 */
export async function saveRemoteFood(db: SQLiteDatabase, f: NewFood): Promise<number> {
  if (f.barcode) {
    const local = await foodByBarcode(db, barcodeVariants(f.barcode));
    if (local && local.source !== 'off') return local.id;
  }
  return upsertFood(db, f);
}
