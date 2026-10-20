/**
 * Core domain types shared by the database layer and the UI.
 * Nutrient amounts use grams unless the nutrient definition says otherwise (see nutrients.ts).
 */
import type { Nutrients } from './nutrients';

export type Lang = 'en' | 'he';
export type LangSetting = Lang | 'system';
export type ThemeSetting = 'system' | 'light' | 'dark';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  /** Weight at onboarding; the weight log (stage 3) supersedes it once it has entries. */
  weightKg: number;
  activity: ActivityLevel;
  goal: GoalType;
  /** Always positive; the direction comes from `goal`. */
  rateKgPerWeek: number;
  targetWeightKg?: number;
}

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
}

export interface Goals {
  /** Daily calorie target. When `autoKcal` is true it follows the profile calculation. */
  kcal: number;
  autoKcal: boolean;
  /** How macro targets are expressed. */
  mode: 'pct' | 'grams';
  pct: MacroSplit;
  grams: MacroSplit;
  waterMl: number;
}

export interface Prefs {
  netCarbs: boolean;
}

/** What the amounts of a food are measured in. Nutrients are stored per 100 g/ml, or per 1 serving. */
export type BaseUnit = 'g' | 'ml' | 'serving';
export type FoodSource = 'seed' | 'custom' | 'off' | 'usda' | 'recipe';

export interface Serving {
  label: string;
  labelHe?: string;
  /** Size of this serving in the food's base unit (grams, ml, or 1 for a plain serving). */
  amount: number;
}

export interface Food {
  id: number;
  source: FoodSource;
  sourceId: string | null;
  barcode: string | null;
  name: string;
  nameHe: string | null;
  brand: string | null;
  baseUnit: BaseUnit;
  nutrients: Nutrients;
  servings: Serving[];
  favorite: boolean;
}

export interface DiaryEntry {
  id: number;
  date: string;
  meal: Meal;
  foodId: number | null;
  name: string;
  nameHe: string | null;
  brand: string | null;
  servingLabel: string;
  servingLabelHe: string | null;
  servingAmount: number;
  quantity: number;
  baseUnit: BaseUnit;
  /** Totals for this entry (already multiplied by portion). */
  nutrients: Nutrients;
  /** ISO timestamp of when the food was eaten. */
  loggedAt: string;
}
