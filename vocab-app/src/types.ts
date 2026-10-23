import type { Card } from 'ts-fsrs';

export type Register = 'formal' | 'neutral' | 'informal' | 'literary' | 'academic';

/** One word entry, as authored in src/data/words/*.json (or added by the user). */
export interface WordEntry {
  id: string;
  word: string;
  /** IPA without slashes, US pronunciation */
  ipa: string;
  pos: string;
  /** Dictionary-style definition (shown under "more about this word") */
  def: string;
  /** Plain, everyday English definition — simpler than the word itself */
  simple?: string;
  /** Hebrew translation, possibly with alternatives */
  he: string;
  /** 1–3 word Hebrew translation shown first */
  hs?: string;
  /** Short, natural example with the target in [brackets] — the one shown first */
  easy?: string;
  family: string[];
  /** Example sentences; the target form is wrapped in [brackets] */
  ex: string[];
  col: string[];
  reg: Register;
  syn: string[];
  nuance: string;
  ety: string;
  /** Key into roots.json */
  root?: string;
  /** 1 = most useful, 3 = rare / literary */
  tier: 1 | 2 | 3;
  themes: string[];
  /** Precision card: a sentence where this word is the best fit among near-synonyms */
  prec?: { s: string; opts: string[]; why: string; ans?: string };
  /** Present on words the user added themselves */
  custom?: boolean;
  batch?: string;
}

export interface Root {
  key: string;
  form: string;
  meaning: string;
  /** Meaning in Hebrew, for the interface */
  he: string;
  origin: string;
}

export interface Theme {
  key: string;
  label: string;
  he: string;
}

/** Card types in rising difficulty */
export type CardType = 1 | 2 | 3 | 4 | 5;

export interface Progress {
  wordId: string;
  card: Card;
  /** Highest card type the word has reached (1–5) */
  level: CardType;
  /** Successful production answers (card types 3–5) */
  production: number;
  /** Total wrong answers ever */
  mistakes: number;
  introducedAt: number;
  lastReviewedAt?: number;
  mastered: boolean;
  /** User has suspended this word */
  suspended?: boolean;
}

export interface ReviewEntry {
  id?: number;
  wordId: string;
  at: number;
  day: string;
  cardType: CardType;
  correct: boolean;
  rating: number;
  /** True when this was a scheduled review (not a new word or an in-session repeat) */
  review: boolean;
}

export interface Settings {
  newPerDay: number;
  reviewsPerDay: number;
  accent: 'en-US' | 'en-GB';
  showHebrew: boolean;
  theme: 'dark' | 'light' | 'system';
  autoplayAudio: boolean;
}

export interface UserSentence {
  id?: number;
  wordId: string;
  text: string;
  at: number;
  rating: number;
}

export interface DayLog {
  day: string;
  answered: number;
  newWords: number;
  goalMet: boolean;
}
