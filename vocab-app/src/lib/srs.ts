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

/** Level 3 is the production stage: every card type from 3 up. */
export const PRODUCTION_LEVEL = 3;

/**
 * Pick the card type for a scheduled review. Words climb from recognition (1) to
 * the gap-fill (2) to the production stage, which works through typing (3),
 * precision (4) and writing a sentence (5) in that order, then keeps rotating.
 */
export function chooseCardType(p: Progress, available: CardType[]): CardType {
  const sorted = [...available].sort((a, b) => a - b);
  const production = sorted.filter((t) => t >= PRODUCTION_LEVEL);
  if (p.level >= PRODUCTION_LEVEL && production.length) {
    // easiest first: typing, then precision, then writing; a type repeats until it's answered correctly
    return production[p.production % production.length];
  }
  const atOrBelow = sorted.filter((t) => t <= p.level);
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
  const top = Math.min(PRODUCTION_LEVEL, Math.max(...enabled)) as CardType;
  const stage = Math.min(cardType, PRODUCTION_LEVEL);
  let level = Math.min(p.level, PRODUCTION_LEVEL) as CardType;
  if (good) {
    // climbs only when the word was asked at its current stage
    if (stage >= level) level = Math.min(top, stage + 1) as CardType;
  } else {
    // a production mistake sends the word back to the gap-fill
    level = Math.max(1, Math.min(level, stage) - 1) as CardType;
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
