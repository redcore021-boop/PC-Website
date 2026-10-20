/**
 * USDA FoodData Central: generic foods (fruit, vegetables, meat, cooked dishes) with full nutrients.
 * Needs an api.data.gov key. DEMO_KEY works but is shared and runs out quickly; a personal key is
 * free at https://fdc.nal.usda.gov/api-key-signup and can be set in More → Online food data.
 */
import type { NewFood } from '@/db/repo/foods';
import { cleanNutrients, type NutrientKey, type Nutrients } from '@/domain/nutrients';
import type { Serving } from '@/domain/types';

import { getJson } from './http';

export const USDA_SIGNUP_URL = 'https://fdc.nal.usda.gov/api-key-signup';

/** FDC nutrient ids → Mazan keys. FDC units already match ours (g, mg, µg, kcal). */
const NUTRIENT_IDS: Record<number, NutrientKey> = {
  1008: 'kcal',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
  2000: 'sugar',
  1258: 'satFat',
  1257: 'transFat',
  1253: 'cholesterol',
  1093: 'sodium',
  1092: 'potassium',
  1087: 'calcium',
  1089: 'iron',
  1106: 'vitA',
  1162: 'vitC',
  1114: 'vitD',
};
/** Foundation foods often report energy only as Atwater factors. */
const ENERGY_FALLBACK_IDS = [2047, 2048];

interface FdcNutrient {
  nutrientId?: number;
  value?: number;
  unitName?: string;
}
interface FdcMeasure {
  disseminationText?: string;
  gramWeight?: number;
}
export interface FdcFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  foodNutrients?: FdcNutrient[];
  foodMeasures?: FdcMeasure[];
}

export function fdcNutrients(list: FdcNutrient[] = []): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    const key = n.nutrientId != null ? NUTRIENT_IDS[n.nutrientId] : undefined;
    if (key && n.value != null && (key !== 'kcal' || n.unitName?.toUpperCase() !== 'KJ')) out[key] = n.value;
  }
  if (out.kcal == null) {
    const e = list.find((n) => n.nutrientId != null && ENERGY_FALLBACK_IDS.includes(n.nutrientId) && n.value != null);
    if (e) out.kcal = e.value;
  }
  return cleanNutrients(out);
}

/** "Bananas, raw" → "Bananas, raw"; "CHEDDAR CHEESE" → "Cheddar cheese". */
function tidyName(s: string): string {
  const t = s.trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

export function fdcToFood(f: FdcFood): NewFood | null {
  const nutrients = fdcNutrients(f.foodNutrients);
  if (nutrients.kcal == null) return null;
  const servings: Serving[] = [];
  const seen = new Set<string>();
  for (const m of f.foodMeasures ?? []) {
    const label = m.disseminationText?.trim();
    if (!label || !m.gramWeight || m.gramWeight <= 0 || /quantity not specified/i.test(label) || seen.has(label)) continue;
    seen.add(label);
    servings.push({ label, amount: Math.round(m.gramWeight * 10) / 10 });
    if (servings.length >= 6) break;
  }
  servings.push({ label: '100 g', labelHe: "100 ג'", amount: 100 }, { label: 'g', labelHe: "ג'", amount: 1 });
  return {
    source: 'usda',
    sourceId: String(f.fdcId),
    name: tidyName(f.description),
    brand: f.brandOwner ?? null,
    baseUnit: 'g',
    nutrients,
    servings,
  };
}

export async function searchUsda(query: string, apiKey: string): Promise<NewFood[]> {
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey || 'DEMO_KEY')}` +
    `&query=${encodeURIComponent(query)}&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS)')}&pageSize=25`;
  const res = await getJson<{ foods?: FdcFood[] }>(url, { timeoutMs: 12_000 });
  return (res.foods ?? []).map(fdcToFood).filter((f): f is NewFood => f != null);
}
