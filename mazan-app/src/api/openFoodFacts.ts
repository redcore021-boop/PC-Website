/**
 * Open Food Facts: barcode lookup and product search. Free, no key, crowd-sourced —
 * values can be wrong, which is why every product can be edited after it is saved.
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
import type { NewFood } from '@/db/repo/foods';
import { cleanNutrients, type Nutrients } from '@/domain/nutrients';
import type { BaseUnit, Serving } from '@/domain/types';

import { ApiError, getJson, USER_AGENT } from './http';

const PRODUCT_FIELDS =
  'code,product_name,product_name_he,product_name_en,generic_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments,countries_tags';

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_he?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string | string[];
  quantity?: string;
  product_quantity?: number | string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
  countries_tags?: string[];
}

const HEBREW = /[֐-׿]/;

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** OFF stores per-100 values in grams; convert to the unit Mazan uses for each nutrient. */
export function offNutrients(n: OffProduct['nutriments'] = {}): Nutrients {
  const g = (k: string, factor = 1) => {
    const v = num(n[`${k}_100g`]);
    return v == null ? undefined : v * factor;
  };
  let kcal = g('energy-kcal');
  if (kcal == null) {
    const kj = g('energy-kj') ?? g('energy');
    if (kj != null) kcal = kj / 4.184;
  }
  let sodium = g('sodium', 1000);
  if (sodium == null) {
    const salt = g('salt');
    if (salt != null) sodium = (salt / 2.5) * 1000;
  }
  return cleanNutrients({
    kcal,
    protein: g('proteins'),
    carbs: g('carbohydrates'),
    fat: g('fat'),
    fiber: g('fiber'),
    sugar: g('sugars'),
    satFat: g('saturated-fat'),
    transFat: g('trans-fat'),
    cholesterol: g('cholesterol', 1000),
    sodium,
    potassium: g('potassium', 1000),
    calcium: g('calcium', 1000),
    iron: g('iron', 1000),
    vitA: g('vitamin-a', 1e6),
    vitC: g('vitamin-c', 1000),
    vitD: g('vitamin-d', 1e6),
  });
}

export function offNames(p: OffProduct): { name: string; nameHe: string | null; brand: string | null } {
  const main = (p.product_name ?? '').trim();
  const he = (p.product_name_he ?? '').trim() || (HEBREW.test(main) ? main : '');
  const en = (p.product_name_en ?? '').trim() || main || he || (p.generic_name ?? '').trim();
  const brands = Array.isArray(p.brands) ? p.brands : (p.brands ?? '').split(',');
  return { name: en, nameHe: he || null, brand: brands.map((b) => b.trim()).find(Boolean) ?? null };
}

/** Map an OFF product to a Mazan food. Returns null when it has no calorie data. */
export function offToFood(p: OffProduct, code: string): NewFood | null {
  const nutrients = offNutrients(p.nutriments);
  if (nutrients.kcal == null) return null;
  const { name, nameHe, brand } = offNames(p);
  // Drinks are labelled per 100 ml.
  // A number followed by ml/cl/l, or the Hebrew words for litre / ml (\b does not work next to Hebrew).
  const liquid = /\d\s*(ml|cl|l)\b|ליטר|מ["״]ל/i.test(`${p.quantity ?? ''} ${p.serving_size ?? ''}`);
  const baseUnit: BaseUnit = liquid ? 'ml' : 'g';
  const unit = liquid ? { en: 'ml', he: 'מ"ל' } : { en: 'g', he: "ג'" };

  const servings: Serving[] = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0 && sq < 2000) servings.push({ label: p.serving_size?.trim() || `1 serving`, labelHe: 'מנה', amount: sq });
  const pq = num(p.product_quantity);
  if (pq && pq > 0 && pq <= 3000 && pq !== sq) servings.push({ label: 'Whole package', labelHe: 'אריזה שלמה', amount: pq });
  servings.push({ label: `100 ${unit.en}`, labelHe: `100 ${unit.he}`, amount: 100 });
  servings.push({ label: unit.en, labelHe: unit.he, amount: 1 });

  return {
    source: 'off',
    sourceId: code,
    barcode: code,
    name: name || nameHe || `Product ${code}`,
    nameHe,
    brand,
    baseUnit,
    nutrients,
    servings,
  };
}

export type OffLookup = { kind: 'found'; food: NewFood } | { kind: 'incomplete'; name: string; brand: string | null } | { kind: 'missing' };

/** Look up one barcode. Throws ApiError on network problems. */
export async function fetchOffProduct(code: string): Promise<OffLookup> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS}`;
  let res: { status?: number; product?: OffProduct };
  try {
    res = await getJson(url, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: 12_000 });
  } catch (e) {
    // OFF answers 404 for unknown barcodes.
    if (e instanceof ApiError && e.kind === 'notFound') return { kind: 'missing' };
    throw e;
  }
  if (res.status !== 1 || !res.product) return { kind: 'missing' };
  const food = offToFood(res.product, code);
  if (food) return { kind: 'found', food };
  const n = offNames(res.product);
  return { kind: 'incomplete', name: n.nameHe ?? n.name, brand: n.brand };
}

/** Full-text search. Israeli products come first. */
export async function searchOff(query: string): Promise<NewFood[]> {
  const url =
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}` +
    `&langs=he,en&page_size=30&fields=${PRODUCT_FIELDS}`;
  const res = await getJson<{ hits?: OffProduct[] }>(url, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: 12_000 });
  const israeli = (p: OffProduct) => (p.countries_tags ?? []).includes('en:israel') || (p.code ?? '').startsWith('729');
  return (res.hits ?? [])
    .filter((p) => p.code)
    .sort((a, b) => Number(israeli(b)) - Number(israeli(a)))
    .map((p) => offToFood(p, p.code!))
    .filter((f): f is NewFood => f != null);
}

/** EAN-13 and UPC-A spellings of the same product. */
export function barcodeVariants(code: string): string[] {
  const c = code.replace(/\D/g, '');
  const out = [c];
  if (c.length === 12) out.push(`0${c}`);
  if (c.length === 13 && c.startsWith('0')) out.push(c.slice(1));
  return out;
}
