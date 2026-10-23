import type { Progress, WordEntry } from '../types';
import { pickDistractors } from './cards';
import { shuffle } from './random';
import { allExamples, shortHe, simpleDef, splitGap } from './words';

/**
 * Tests and games are extra practice on words already met in lessons.
 * They never change the review schedule.
 */

export const MIN_GAME_WORDS = 4;

/** Words the learner has started (not suspended), most recently introduced first. */
export function gamePool(words: WordEntry[], progress: Progress[]): WordEntry[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  return progress
    .filter((p) => !p.suspended && byId.has(p.wordId))
    .sort((a, b) => b.introducedAt - a.introducedAt)
    .map((p) => byId.get(p.wordId)!);
}

export type QuizKind = 'he' | 'def' | 'gap' | 'meaning';

export interface QuizQuestion {
  kind: QuizKind;
  word: WordEntry;
  /** Hebrew prompt (he), Simple English (def), the word itself (meaning) */
  prompt: string;
  before?: string;
  after?: string;
  options: string[];
  answer: string;
  /** Language of the options, for direction and fonts */
  lang: 'en' | 'he';
}

export const QUIZ_KIND_LABEL: Record<QuizKind, string> = {
  he: 'איזו מילה מתאימה לתרגום?',
  def: 'איזו מילה מתאימה להסבר?',
  gap: 'איזו מילה משלימה את המשפט?',
  meaning: 'מה הפירוש של המילה?',
};

/** Up to `n` other words' short Hebrew meanings, all different from each other and from the answer. */
function hebrewDistractors(word: WordEntry, all: WordEntry[], n: number, rnd: () => number): string[] {
  const answer = shortHe(word);
  const out: string[] = [];
  for (const w of [...pickDistractors(word, all, n * 3, rnd), ...shuffle(all, rnd)]) {
    const he = shortHe(w);
    if (w.id === word.id || he === answer || out.includes(he)) continue;
    out.push(he);
    if (out.length === n) break;
  }
  return out;
}

export function quizQuestion(word: WordEntry, kind: QuizKind, all: WordEntry[], rnd = Math.random): QuizQuestion {
  const english = () => shuffle([word.word, ...pickDistractors(word, all, 3, rnd).map((w) => w.word)], rnd);
  switch (kind) {
    case 'he':
      return { kind, word, prompt: shortHe(word), options: english(), answer: word.word, lang: 'en' };
    case 'def':
      return { kind, word, prompt: simpleDef(word), options: english(), answer: word.word, lang: 'en' };
    case 'gap': {
      const gaps = allExamples(word)
        .map(splitGap)
        .filter((x): x is [string, string, string] => !!x);
      if (!gaps.length) return quizQuestion(word, 'def', all, rnd);
      const [before, , after] = gaps[Math.floor(rnd() * gaps.length)];
      return { kind, word, prompt: '', before, after, options: english(), answer: word.word, lang: 'en' };
    }
    case 'meaning': {
      const answer = shortHe(word);
      return { kind, word, prompt: word.word, options: shuffle([answer, ...hebrewDistractors(word, all, 3, rnd)], rnd), answer, lang: 'he' };
    }
  }
}

/** A mixed test: each word once, question kinds rotated so no two in a row are the same. */
export function buildQuiz(pool: WordEntry[], all: WordEntry[], n: number, rnd = Math.random): QuizQuestion[] {
  const kinds: QuizKind[] = shuffle(['he', 'def', 'gap', 'meaning'] as QuizKind[], rnd);
  return shuffle(pool, rnd)
    .slice(0, n)
    .map((w, i) => quizQuestion(w, kinds[i % kinds.length], all, rnd));
}

/** Listening: hear the word, pick its Hebrew meaning. */
export function buildListening(pool: WordEntry[], all: WordEntry[], n: number, rnd = Math.random): QuizQuestion[] {
  return shuffle(pool, rnd)
    .slice(0, n)
    .map((w) => ({ ...quizQuestion(w, 'meaning', all, rnd), prompt: '' }));
}

/** Matching pairs: `n` words whose Hebrew meanings are all different. */
export function pickPairs(pool: WordEntry[], n: number, rnd = Math.random): WordEntry[] {
  const out: WordEntry[] = [];
  const seen = new Set<string>();
  for (const w of shuffle(pool, rnd)) {
    const he = shortHe(w);
    if (seen.has(he)) continue;
    seen.add(he);
    out.push(w);
    if (out.length === n) break;
  }
  return out;
}

export interface TrueFalseItem {
  word: WordEntry;
  /** The Hebrew meaning shown — the word's own, or another word's */
  shown: string;
  isMatch: boolean;
}

/** True or false: is this the right Hebrew meaning? Roughly half are. */
export function trueFalseItem(pool: WordEntry[], all: WordEntry[], rnd = Math.random, last?: string): TrueFalseItem {
  const choices = pool.length > 1 ? pool.filter((w) => w.id !== last) : pool;
  const word = choices[Math.floor(rnd() * choices.length)];
  if (rnd() < 0.5) return { word, shown: shortHe(word), isMatch: true };
  const [wrong] = hebrewDistractors(word, all, 1, rnd);
  return wrong ? { word, shown: wrong, isMatch: false } : { word, shown: shortHe(word), isMatch: true };
}

export function quizVerdict(pct: number): string {
  if (pct === 100) return 'מושלם! כל התשובות נכונות.';
  if (pct >= 90) return 'מצוין! כמעט הכול נכון.';
  if (pct >= 70) return 'יפה מאוד. עוד קצת חזרה וזה שם.';
  if (pct >= 50) return 'התחלה טובה. כדאי לעבור על הטעויות.';
  return 'המילים האלה עוד חדשות — זה בדיוק הזמן לתרגל.';
}

export type GameKey = 'quiz' | 'match' | 'speed' | 'listen';

export const BEST_KEY = 'gameBest';
export type BestScores = Partial<Record<GameKey, number>>;

/** Higher is better for every game except matching, where it's the time in seconds. */
export function isBetter(game: GameKey, score: number, best: number | undefined): boolean {
  if (best === undefined) return true;
  return game === 'match' ? score < best : score > best;
}
