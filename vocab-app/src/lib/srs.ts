import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { CardType, Progress } from '../types';

/**
 * FSRS with short-term steps disabled: intervals are whole days, and in-session
 * repetition of mistakes is handled by the session queue instead.
 */
export const scheduler = fsrs(
  generatorParameters({ request_retention: 0.9, maximum_interval: 365 * 3, enable_fuzz: true, enable_short_term: false }),
);

export { Rating, State };

export const PRODUCTION_TYPES: CardType[] = [3, 4, 5];
export const MASTERY_PRODUCTION = 2;
export const MASTERY_STABILITY_DAYS = 14;

export function newProgress(wordId: string, now = new Date()): Progress {
  return {
    wordId,
    card: createEmptyCard(now),
    level: 1,
    production: 0,
    mistakes: 0,
    introducedAt: now.getTime(),
    mastered: false,
  };
}

export interface AnswerOutcome {
  correct: boolean;
  /** Correct but with a small typo, or self-rated "hard" */
  hard?: boolean;
  /** Explicit self-rating (card type 5) */
  selfRating?: Grade;
}

export function gradeFor(outcome: AnswerOutcome): Grade {
  if (outcome.selfRating) return outcome.selfRating;
  if (!outcome.correct) return Rating.Again;
  return outcome.hard ? Rating.Hard : Rating.Good;
}

/** Card types the word can be asked with right now, given what is enabled and what data it has. */
export function availableTypes(enabled: CardType[], hasPrecision: boolean): CardType[] {
  return enabled.filter((t) => t !== 4 || hasPrecision);
}

/**
 * Pick the card type for a scheduled review. Words climb one type per success;
 * once they reach production, rotate among the production types, favouring the
 * one asked least recently (approximated by a seeded pick).
 */
export function chooseCardType(p: Progress, available: CardType[], seed = Math.random()): CardType {
  const sorted = [...available].sort((a, b) => a - b);
  const top = sorted[sorted.length - 1];
  const level = Math.min(p.level, top) as CardType;
  const production = sorted.filter((t) => t >= 3 && t <= level);
  if (level >= 3 && production.length > 1) {
    return production[Math.floor(seed * production.length) % production.length];
  }
  // fall back to the nearest available type at or below the level
  const atOrBelow = sorted.filter((t) => t <= level);
  return atOrBelow[atOrBelow.length - 1] ?? sorted[0];
}

/** Apply a graded first attempt to a word's progress (FSRS + level + mastery). Pure. */
export function applyAnswer(
  p: Progress,
  cardType: CardType,
  outcome: AnswerOutcome,
  enabled: CardType[],
  now = new Date(),
): Progress {
  const grade = gradeFor(outcome);
  const { card } = scheduler.next(p.card, now, grade);
  const good = grade !== Rating.Again;
  const maxLevel = Math.max(...enabled) as CardType;
  let level = p.level;
  if (good) {
    // level only climbs when the word was asked at its current level
    if (cardType >= p.level) level = Math.min(maxLevel, cardType + 1) as CardType;
  } else {
    level = Math.max(1, Math.min(p.level, cardType) - 1) as CardType;
  }
  const production = p.production + (good && PRODUCTION_TYPES.includes(cardType) ? 1 : 0);
  const next: Progress = {
    ...p,
    card,
    level,
    production,
    mistakes: p.mistakes + (good ? 0 : 1),
    lastReviewedAt: now.getTime(),
  };
  next.mastered = isMastered(next);
  return next;
}

export function isMastered(p: Progress): boolean {
  return (
    p.production >= MASTERY_PRODUCTION &&
    p.card.state === State.Review &&
    p.card.stability >= MASTERY_STABILITY_DAYS
  );
}

export function retrievability(card: Card, now = new Date()): number {
  if (card.state === State.New) return 0;
  return scheduler.get_retrievability(card, now, false);
}

/** Restore Date fields after JSON round-trips (backups). */
export function reviveCard(c: Card): Card {
  return {
    ...c,
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  };
}
