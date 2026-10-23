import type { CardType, DayLog, Progress, ReviewEntry, Settings } from '../types';
import { addDays, dayKey } from './dates';
import { db } from './db';
import { applyAnswer, newProgress, type AnswerOutcome } from './srs';

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  reviewsPerDay: 150,
  accent: 'en-US',
  showHebrew: false,
  theme: 'dark',
  autoplayAudio: false,
  reminderTime: '20:00',
};

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await db.kv.put({ key: 'settings', value: next });
  return next;
}

export async function todayCounts(now = new Date()) {
  const day = dayKey(now);
  const rows = await db.reviews.where('day').equals(day).toArray();
  const newWords = await db.progress.filter((p) => dayKey(p.introducedAt) === day).count();
  const graded = rows.filter((r) => r.review);
  return {
    newWords,
    reviews: graded.length,
    answered: rows.length,
    correct: rows.filter((r) => r.correct).length,
  };
}

/** First time a word is shown: it gets an FSRS card that is due immediately. */
export async function introduceWord(wordId: string, now = new Date()): Promise<Progress> {
  const existing = await db.progress.get(wordId);
  if (existing) return existing;
  const p = newProgress(wordId, now);
  await db.progress.put(p);
  return p;
}

export async function recordAnswer(
  wordId: string,
  cardType: CardType,
  outcome: AnswerOutcome,
  graded: boolean,
  enabled: CardType[],
  now = new Date(),
): Promise<{ progress: Progress; levelUp: boolean }> {
  return db.transaction('rw', db.progress, db.reviews, db.days, async () => {
    const before = (await db.progress.get(wordId)) ?? newProgress(wordId, now);
    const wasReview = before.card.reps > 0;
    let after = before;
    if (graded) {
      after = applyAnswer(before, cardType, outcome, enabled, now);
    } else if (!outcome.correct) {
      after = { ...before, mistakes: before.mistakes + 1 };
    }
    await db.progress.put(after);
    const entry: ReviewEntry = {
      wordId,
      at: now.getTime(),
      day: dayKey(now),
      cardType,
      correct: outcome.correct,
      rating: graded ? (outcome.selfRating ?? (outcome.correct ? (outcome.hard ? 2 : 3) : 1)) : 0,
      review: graded && wasReview,
    };
    await db.reviews.add(entry);
    const day = entry.day;
    const log = (await db.days.get(day)) ?? { day, answered: 0, newWords: 0, goalMet: false };
    await db.days.put({ ...log, answered: log.answered + 1 });
    return { progress: after, levelUp: after.level > before.level };
  });
}

/** Number of earlier days with any study — drives the warm-up of new words. */
export async function daysStudiedBefore(now = new Date()): Promise<number> {
  const today = dayKey(now);
  return db.days.filter((d) => d.day < today && d.answered > 0).count();
}

export async function markGoalMet(now = new Date()) {
  const day = dayKey(now);
  const log = (await db.days.get(day)) ?? { day, answered: 0, newWords: 0, goalMet: false };
  await db.days.put({ ...log, goalMet: true });
}

/** Consecutive days with the daily goal met, ending today (or yesterday if today isn't done yet). */
export function computeStreak(days: DayLog[], now = new Date()): { current: number; best: number; todayDone: boolean } {
  const met = new Set(days.filter((d) => d.goalMet).map((d) => d.day));
  const today = dayKey(now);
  const todayDone = met.has(today);
  let current = 0;
  let cursor = todayDone ? today : addDays(today, -1);
  while (met.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...met].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, todayDone };
}

/** The last `n` study days, oldest first, with whether the daily goal was met on each. */
export function recentDays(days: DayLog[], n = 7, now = new Date()): { day: string; met: boolean; today: boolean }[] {
  const met = new Set(days.filter((d) => d.goalMet).map((d) => d.day));
  const today = dayKey(now);
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return { day, met: met.has(day), today: day === today };
  });
}
