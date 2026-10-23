import type { WordEntry } from '../types';
import { familyForms } from './words';

const FILLERS = new Set(['someone', "someone's", 'something', 'one', "one's", 'a', 'an', 'the', 'to', 'of', 'on', 'in', 'at', 'with', 'up', 'out', 'off', 'down', 'over', 'as', 'for', 'from', 'into', 'and', 'by', 'that', 'we', 'it', 'when', 'come']);

// irregular forms of verbs that appear in the phrasal verbs and idioms
const IRREGULAR: Record<string, string[]> = {
  take: ['took', 'taken'], come: ['came'], fall: ['fell', 'fallen'], bear: ['bore', 'borne', 'born'],
  bite: ['bit', 'bitten'], get: ['got', 'gotten'], go: ['went', 'gone'], keep: ['kept'], pay: ['paid'],
  throw: ['threw', 'thrown'], make: ['made'], beat: ['beaten'], cut: ['cut'], hit: ['hit'], lead: ['led'],
};

const tokens = (s: string) => s.toLowerCase().replace(/[’']/g, "'").match(/[a-z']+/g) ?? [];

/** Rough stem: enough of the word to match its inflections (mitigat-, ubiquit-, wan-). */
function stem(w: string): string {
  const base = w.replace(/(e|y|es|ed|ing|s)$/, '');
  return base.length >= 3 ? base.slice(0, Math.max(3, Math.min(base.length, 7))) : w;
}

/**
 * Does a learner's sentence seem to use the word (any inflection or family form)?
 * Only used for a gentle reminder — the learner rates their own sentence.
 */
export function usesWord(sentence: string, word: WordEntry): boolean {
  const have = tokens(sentence);
  const matchesForm = (form: string) => {
    const parts = tokens(form).filter((t) => !FILLERS.has(t));
    if (!parts.length) return false;
    return parts.every((p) => have.some((h) => h.startsWith(stem(p)) || (IRREGULAR[p] ?? []).includes(h)));
  };
  return [word.word, ...familyForms(word)].some(matchesForm);
}
