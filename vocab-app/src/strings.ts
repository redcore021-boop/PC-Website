import type { CardType, Register } from './types';

/** Hebrew interface labels shared across screens. Learning content stays in English. */

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  1: 'בחרו את המילה',
  2: 'השלימו את המשפט',
  3: 'הקלידו את המילה',
  4: 'המילה המדויקת',
  5: 'שימוש במשפט',
};

export const REGISTER_LABEL: Record<Register, string> = {
  formal: 'רשמי',
  neutral: 'ניטרלי',
  informal: 'לא רשמי',
  literary: 'ספרותי',
  academic: 'אקדמי',
};

export const TIER_LABEL = { 1: 'שימושי מאוד', 2: 'מתקדם', 3: 'נדיר / ספרותי' } as const;

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

export function formatDate(d: Date | number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Date(d).toLocaleDateString('he-IL', opts);
}
