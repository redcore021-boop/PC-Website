/** Portion math: turning a food + serving + quantity into nutrient totals. */
import { scaleNutrients, type Nutrients } from './nutrients';
import type { BaseUnit, Food, Lang, Serving } from './types';

/** Nutrients are stored per 100 g/ml, or per 1 unit for serving-based foods. */
export function baseDivisor(unit: BaseUnit): number {
  return unit === 'serving' ? 1 : 100;
}

export function portionNutrients(food: Pick<Food, 'nutrients' | 'baseUnit'>, servingAmount: number, quantity: number): Nutrients {
  return scaleNutrients(food.nutrients, (servingAmount * quantity) / baseDivisor(food.baseUnit));
}

export function servingLabel(s: Pick<Serving, 'label' | 'labelHe'>, lang: Lang): string {
  return lang === 'he' && s.labelHe ? s.labelHe : s.label;
}

export function foodName(f: { name: string; nameHe: string | null }, lang: Lang): string {
  return lang === 'he' && f.nameHe ? f.nameHe : f.name;
}

/** "1 cup (160 g)" — appends the weight when the serving is not itself a weight. */
export function servingDescription(s: Serving, unit: BaseUnit, lang: Lang): string {
  const label = servingLabel(s, lang);
  // Skip the suffix when the label already states the amount ("100 g", "40 g").
  if (unit === 'serving' || s.amount === 1 || label.includes(String(Math.round(s.amount)))) return label;
  const u = unit === 'ml' ? (lang === 'he' ? 'מ"ל' : 'ml') : lang === 'he' ? "ג'" : 'g';
  return `${label} (${Math.round(s.amount)} ${u})`;
}
