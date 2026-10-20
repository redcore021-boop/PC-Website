/**
 * Energy expenditure and goal calculations.
 * BMR uses the Mifflin–St Jeor equation; 1 kg of body fat ≈ 7,700 kcal.
 */
import type { ActivityLevel, Goals, MacroSplit, Profile } from './types';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const KCAL_PER_KG = 7700;
export const DEFAULT_SPLIT: MacroSplit = { carbs: 50, protein: 20, fat: 30 };

/** Lowest daily target the app will suggest on its own. */
export function calorieFloor(sex: Profile['sex']): number {
  return sex === 'male' ? 1500 : 1200;
}

export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm'>, weightKg: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export function tdee(p: Profile, weightKg: number): number {
  return bmr(p, weightKg) * ACTIVITY_FACTORS[p.activity];
}

export interface Plan {
  bmr: number;
  tdee: number;
  /** Daily deficit (negative) or surplus (positive) implied by the weekly rate. */
  adjustment: number;
  target: number;
  /** True when the target was raised to the safety floor. */
  floored: boolean;
}

export function calculatePlan(p: Profile, weightKg = p.weightKg): Plan {
  const b = bmr(p, weightKg);
  const t = b * ACTIVITY_FACTORS[p.activity];
  const sign = p.goal === 'lose' ? -1 : p.goal === 'gain' ? 1 : 0;
  const adjustment = (sign * p.rateKgPerWeek * KCAL_PER_KG) / 7;
  const raw = Math.round((t + adjustment) / 10) * 10;
  const floor = calorieFloor(p.sex);
  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    adjustment: Math.round(adjustment),
    target: Math.max(raw, floor),
    floored: raw < floor,
  };
}

/** Macro targets in grams for a calorie target. Protein/carbs = 4 kcal/g, fat = 9 kcal/g. */
export function macroGrams(goals: Pick<Goals, 'kcal' | 'mode' | 'pct' | 'grams'>): MacroSplit {
  if (goals.mode === 'grams') return goals.grams;
  return {
    protein: Math.round((goals.kcal * goals.pct.protein) / 100 / 4),
    carbs: Math.round((goals.kcal * goals.pct.carbs) / 100 / 4),
    fat: Math.round((goals.kcal * goals.pct.fat) / 100 / 9),
  };
}

export function defaultGoals(target: number): Goals {
  return {
    kcal: target,
    autoKcal: true,
    mode: 'pct',
    pct: { ...DEFAULT_SPLIT },
    grams: macroGrams({ kcal: target, mode: 'pct', pct: DEFAULT_SPLIT, grams: DEFAULT_SPLIT }),
    waterMl: 2500,
  };
}
