import type { CardType, WordEntry } from '../types';
import { shuffle } from './random';
import { splitGap } from './words';

export type Question =
  | { type: 1; word: WordEntry; options: string[] }
  | { type: 2; word: WordEntry; before: string; after: string; form: string; options: string[] }
  | { type: 3; word: WordEntry; hint: string }
  | { type: 4; word: WordEntry; before: string; after: string; options: string[]; answer: string; why: string }
  | { type: 5; word: WordEntry };

export function posGroup(pos: string): string {
  const p = pos.toLowerCase();
  if (p.includes('phrasal')) return 'phrasal';
  if (p.includes('idiom') || p.includes('phrase')) return 'idiom';
  return p.split(/[\s/,]/)[0];
}

function isSynonymPair(a: WordEntry, b: WordEntry): boolean {
  const aw = a.word.toLowerCase();
  const bw = b.word.toLowerCase();
  return a.syn.some((s) => s.toLowerCase() === bw) || b.syn.some((s) => s.toLowerCase() === aw);
}

/**
 * Plausible wrong options from the deck: same part of speech first, then related
 * theme or root. True synonyms are excluded so every question has one right answer.
 */
export function pickDistractors(
  target: WordEntry,
  all: WordEntry[],
  n = 3,
  rnd = Math.random,
  opts: { themeBonus?: boolean; easy?: boolean } = { themeBonus: true },
): WordEntry[] {
  const group = posGroup(target.pos);
  const scored = all
    .filter((w) => w.id !== target.id && w.word.toLowerCase() !== target.word.toLowerCase() && !isSynonymPair(target, w))
    .map((w) => {
      let score = rnd() * 1.5;
      if (posGroup(w.pos) === group) score += 4;
      const sharesTheme = w.themes.some((t) => target.themes.includes(t));
      if (opts.easy) {
        // first encounters: same part of speech, but from a different area of meaning
        if (!sharesTheme) score += 1.5;
        if (w.custom) score -= 2;
      } else {
        if (opts.themeBonus && sharesTheme) score += 1.5;
        if (w.root && w.root === target.root) score += 1;
        if (w.tier === target.tier) score += 0.5;
      }
      return { w, score };
    })
    .sort((a, b) => b.score - a.score);
  const pool = scored.slice(0, Math.max(n * 3, n)).map((s) => s.w);
  return shuffle(pool, rnd).slice(0, n);
}

/**
 * "k___ s______ a_ a___'s l_____" style hint: the first letter of each word, plus
 * `extra` more letters revealed from the start when the learner asks for help.
 */
export function typingHint(word: string, extra = 0): string {
  let budget = extra;
  return word
    .split(' ')
    .map((part) => {
      let firstShown = false;
      return [...part]
        .map((ch) => {
          if (!/[a-z]/i.test(ch)) return ch;
          if (!firstShown) {
            firstShown = true;
            return ch;
          }
          if (budget > 0) {
            budget--;
            return ch;
          }
          return '_';
        })
        .join('');
    })
    .join('  ');
}

/** How many extra letters can be revealed before the hint gives the whole word away. */
export function maxHints(word: string): number {
  const letters = word.replace(/[^a-z]/gi, '').length;
  const words = word.split(' ').length;
  return Math.max(0, letters - words - 1);
}

export function buildQuestion(word: WordEntry, type: CardType, all: WordEntry[], rnd = Math.random, easy = false): Question {
  switch (type) {
    case 1: {
      const options = shuffle([word.word, ...pickDistractors(word, all, 3, rnd, { themeBonus: true, easy }).map((w) => w.word)], rnd);
      return { type, word, options };
    }
    case 2: {
      const examples = word.ex.map(splitGap).filter((x): x is [string, string, string] => !!x);
      if (!examples.length) return buildQuestion(word, 1, all, rnd, easy);
      const [before, form, after] = examples[Math.floor(rnd() * examples.length)];
      const distractors = pickDistractors(word, all, 3, rnd, { themeBonus: false, easy });
      const options = shuffle([word.word, ...distractors.map((w) => w.word)], rnd);
      return { type, word, before, after, form, options };
    }
    case 3:
      return { type, word, hint: typingHint(word.word) };
    case 4: {
      if (!word.prec) return buildQuestion(word, 3, all, rnd);
      const parts = word.prec.s.split(/_{2,}/);
      // the blank may need an inflected form ("juxtaposes"), so the right option is shown as written
      const answer = word.prec.ans ?? word.word;
      const options = shuffle([answer, ...word.prec.opts], rnd);
      return { type, word, before: parts[0] ?? '', after: parts.slice(1).join('___'), options, answer, why: word.prec.why };
    }
    case 5:
      return { type, word };
  }
}
