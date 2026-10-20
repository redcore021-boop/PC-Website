/**
 * Calendar days are stored as local 'YYYY-MM-DD' keys so a diary day never shifts with time zones.
 */
import type { Lang, Meal } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export const today = () => dayKey();

const locale = (lang: Lang) => (lang === 'he' ? 'he-IL' : 'en-US');

export function formatDayLong(key: string, lang: Lang): string {
  return parseDay(key).toLocaleDateString(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDayShort(key: string, lang: Lang): string {
  return parseDay(key).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short' });
}

export function formatTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
}

/** The meal most people would be logging at this hour. */
export function mealForNow(d: Date = new Date()): Meal {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snacks';
}

/**
 * A timestamp for an entry logged on `date`: now for today, otherwise the same clock time on that day
 * so entries added to past days still sort sensibly.
 */
export function timestampFor(date: string): string {
  const now = new Date();
  if (date === dayKey(now)) return now.toISOString();
  const d = parseDay(date);
  d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return d.toISOString();
}
