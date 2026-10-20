/**
 * Nutrient catalogue and arithmetic helpers.
 * Every nutrient value in the app is stored in the unit listed here.
 */

export const NUTRIENT_KEYS = [
  'kcal',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'satFat',
  'transFat',
  'cholesterol',
  'sodium',
  'potassium',
  'calcium',
  'iron',
  'vitA',
  'vitC',
  'vitD',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type Nutrients = Partial<Record<NutrientKey, number>>;

export const NUTRIENT_UNITS: Record<NutrientKey, 'kcal' | 'g' | 'mg' | 'µg'> = {
  kcal: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
  sugar: 'g',
  satFat: 'g',
  transFat: 'g',
  cholesterol: 'mg',
  sodium: 'mg',
  potassium: 'mg',
  calcium: 'mg',
  iron: 'mg',
  vitA: 'µg',
  vitC: 'mg',
  vitD: 'µg',
};

/** Multiply every nutrient by `factor`. */
export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const k of NUTRIENT_KEYS) {
    const v = n[k];
    if (v != null && Number.isFinite(v)) out[k] = v * factor;
  }
  return out;
}

/** Sum a list of nutrient records. A key is present in the result if any input has it. */
export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const k of NUTRIENT_KEYS) {
      const v = n[k];
      if (v != null && Number.isFinite(v)) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** Net carbs = total carbs − fiber (never below zero). */
export function netCarbs(n: Nutrients): number {
  return Math.max(0, (n.carbs ?? 0) - (n.fiber ?? 0));
}

/** Drop empty and invalid values, rounding to sensible precision for storage. */
export function cleanNutrients(n: Nutrients): Nutrients {
  const out: Nutrients = {};
  for (const k of NUTRIENT_KEYS) {
    const v = n[k];
    if (v != null && Number.isFinite(v) && v >= 0) out[k] = Math.round(v * 1000) / 1000;
  }
  return out;
}
