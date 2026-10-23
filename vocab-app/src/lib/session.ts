import type { CardType, Progress, Settings, WordEntry } from '../types';
import { endOfStudyDay } from './dates';
import { availableTypes, chooseCardType, retrievability } from './srs';
import { introOrder } from './words';

export interface QueueItem {
  key: string;
  wordId: string;
  kind: 'intro' | 'quiz';
  cardType: CardType;
  /** First attempt of the day for this word: updates FSRS. Repeats after a mistake do not. */
  graded: boolean;
  isNew: boolean;
  /** First quizzes of a word use clearly different wrong options */
  easy: boolean;
  repeat: number;
}

export interface TodayCounts {
  newWords: number;
  reviews: number;
}

export type SessionMode = 'daily' | 'quick';

export const QUICK_SESSION_MS = 10 * 60 * 1000;
export const MAX_REPEATS = 3;
const QUICK_NEW_CAP = 5;

/** Warm-up: the first study days introduce fewer new words, building up to the chosen pace. */
export const WARMUP_START = 5;
export const WARMUP_STEP = 2;

export function effectiveNewPerDay(newPerDay: number, daysStudied: number): number {
  return Math.min(newPerDay, WARMUP_START + WARMUP_STEP * daysStudied);
}

let counter = 0;
const key = () => `q${Date.now().toString(36)}${(counter++).toString(36)}`;

export function dueProgress(progress: Progress[], now = new Date()): Progress[] {
  const cutoff = endOfStudyDay(now).getTime();
  return progress
    .filter((p) => !p.suspended && new Date(p.card.due).getTime() <= cutoff)
    .sort((a, b) => retrievability(a.card, now) - retrievability(b.card, now) || +new Date(a.card.due) - +new Date(b.card.due));
}

export function unseenWords(words: WordEntry[], progressById: Map<string, Progress>): WordEntry[] {
  return introOrder(words.filter((w) => !progressById.has(w.id)));
}

export interface BuildArgs {
  words: WordEntry[];
  progress: Progress[];
  settings: Settings;
  today: TodayCounts;
  enabled: CardType[];
  mode: SessionMode;
  now?: Date;
}

/**
 * Today's queue: due reviews first (weakest first), with new words woven in.
 * Each new word gets an intro card and, a few cards later, its first quiz.
 */
export function buildQueue({ words, progress, settings, today, enabled, mode, now = new Date() }: BuildArgs): QueueItem[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  const progressById = new Map(progress.map((p) => [p.wordId, p]));
  const reviewsLeft = Math.max(0, settings.reviewsPerDay - today.reviews);
  let newLeft = Math.max(0, settings.newPerDay - today.newWords);
  if (mode === 'quick') newLeft = Math.min(newLeft, QUICK_NEW_CAP);

  const reviews: QueueItem[] = dueProgress(progress, now)
    .filter((p) => byId.has(p.wordId))
    .slice(0, reviewsLeft)
    .map((p) => {
      const w = byId.get(p.wordId)!;
      return {
        key: key(),
        wordId: p.wordId,
        kind: 'quiz',
        cardType: chooseCardType(p, availableTypes(enabled, !!w.prec)),
        graded: true,
        isNew: false,
        easy: p.card.reps < 2,
        repeat: 0,
      };
    });

  const fresh = unseenWords(words, progressById).slice(0, newLeft);

  const out: QueueItem[] = [];
  const pending: { item: QueueItem; readyAt: number }[] = [];
  let r = 0;
  let n = 0;
  const flushReady = () => {
    for (let i = 0; i < pending.length; i++) {
      if (pending[i].readyAt <= out.length) {
        out.push(pending[i].item);
        pending.splice(i, 1);
        i--;
      }
    }
  };
  while (r < reviews.length || n < fresh.length) {
    // two reviews, then one new word
    for (let k = 0; k < 2 && r < reviews.length; k++) {
      out.push(reviews[r++]);
      flushReady();
    }
    if (n < fresh.length) {
      const w = fresh[n++];
      out.push({ key: key(), wordId: w.id, kind: 'intro', cardType: 1, graded: false, isNew: true, easy: true, repeat: 0 });
      pending.push({
        item: { key: key(), wordId: w.id, kind: 'quiz', cardType: 1, graded: true, isNew: true, easy: true, repeat: 0 },
        readyAt: out.length + 3,
      });
      flushReady();
    }
  }
  for (const p of pending) out.push(p.item);
  return out;
}

/** After a wrong answer, schedule another try a few cards later (or at the end). */
export function requeueAfterMistake(queue: QueueItem[], index: number, rnd = Math.random): QueueItem[] {
  const item = queue[index];
  if (item.repeat >= MAX_REPEATS) return queue;
  const gap = 3 + Math.floor(rnd() * 3);
  const at = Math.min(queue.length, index + 1 + gap);
  const copy: QueueItem = { ...item, key: key(), graded: false, repeat: item.repeat + 1 };
  return [...queue.slice(0, at), copy, ...queue.slice(at)];
}

/** Words that are hardest for the learner: most mistakes first, then lowest recall probability. */
export function weakestProgress(progress: Progress[], now = new Date(), n = 10): Progress[] {
  return progress
    .filter((p) => !p.suspended && p.card.reps > 0)
    .map((p) => ({ p, r: retrievability(p.card, now) }))
    .filter(({ p, r }) => p.mistakes > 0 || r < 0.85)
    .sort((a, b) => b.p.mistakes - a.p.mistakes || a.r - b.r)
    .slice(0, n)
    .map(({ p }) => p);
}

/**
 * Extra practice on weak words. Ungraded, so it never distorts the FSRS schedule;
 * mistakes still count and still come back within the session.
 */
export function buildWeakQueue(words: WordEntry[], progress: Progress[], enabled: CardType[], now = new Date()): QueueItem[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  return weakestProgress(progress, now)
    .filter((p) => byId.has(p.wordId))
    .map((p) => ({
      key: key(),
      wordId: p.wordId,
      kind: 'quiz' as const,
      cardType: chooseCardType(p, availableTypes(enabled, !!byId.get(p.wordId)!.prec)),
      graded: false,
      isNew: false,
      easy: false,
      repeat: 0,
    }));
}
