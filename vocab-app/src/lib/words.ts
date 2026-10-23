import type { Root, Theme, WordEntry } from '../types';
import rootsJson from '../data/roots.json';
import themesJson from '../data/themes.json';

interface BatchFile {
  batch: string;
  title: string;
  words: Omit<WordEntry, 'id'>[];
}

// Every file in data/words is a batch. Adding a batch = dropping in a new JSON file.
const files = import.meta.glob<BatchFile>('../data/words/*.json', { eager: true, import: 'default' });

export function slug(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const batches = Object.keys(files)
  .sort()
  .map((path) => files[path]);

export const builtInWords: WordEntry[] = batches.flatMap((b) =>
  b.words.map((w) => ({ ...w, id: slug(w.word), batch: b.batch }) as WordEntry),
);

export const roots: Root[] = rootsJson as Root[];
export const themes: Theme[] = themesJson as Theme[];
export const rootByKey = new Map(roots.map((r) => [r.key, r]));
export const themeByKey = new Map(themes.map((t) => [t.key, t]));

/** Stable pseudo-random number from a string, so new-word order is mixed but repeatable. */
export function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const REGISTER_EFFORT: Record<string, number> = { informal: 0, neutral: 0, formal: 1, academic: 1.5, literary: 2.5 };

/**
 * How hard a word is to start with (lower = easier): rarer tier, literary or academic
 * register and long words come later; everyday phrasal verbs and idioms come early.
 */
export function wordEffort(w: WordEntry): number {
  let e = w.tier * 4 + (REGISTER_EFFORT[w.reg] ?? 1);
  const len = w.word.replace(/^(a|an|the) /i, '').length;
  if (!w.word.includes(' ')) e += len > 11 ? 1.5 : len > 8 ? 0.75 : 0;
  return e;
}

const kindOf = (w: WordEntry) => (/phrasal/i.test(w.pos) ? 'phrasal' : /idiom/i.test(w.pos) ? 'idiom' : 'word');
// two single words, a phrasal verb, a single word, an idiom — so each day has some variety
const PATTERN = ['word', 'word', 'phrasal', 'word', 'idiom'] as const;

/**
 * Order in which unseen words are introduced: user-added first, then easiest first,
 * interleaving single words, phrasal verbs and idioms.
 */
export function introOrder(words: WordEntry[]): WordEntry[] {
  // a little stable jitter so consecutive days mix themes
  const score = (w: WordEntry) => wordEffort(w) + hashUnit(w.id) * 1.5;
  const sorted = [...words].sort((a, b) => score(a) - score(b));
  const custom = sorted.filter((w) => w.custom);
  const buckets = { word: [] as WordEntry[], phrasal: [] as WordEntry[], idiom: [] as WordEntry[] };
  for (const w of sorted) if (!w.custom) buckets[kindOf(w)].push(w);
  const out = [...custom];
  for (let i = 0; out.length < words.length; i++) {
    const want = PATTERN[i % PATTERN.length];
    const from = buckets[want].length ? buckets[want] : [buckets.word, buckets.phrasal, buckets.idiom].find((b) => b.length)!;
    out.push(from.shift()!);
  }
  return out;
}

/** Plain-English definition, falling back to the dictionary one (e.g. for words the learner added). */
export function simpleDef(w: WordEntry): string {
  return w.simple ?? w.def;
}

/** The short Hebrew translation shown first. */
export function shortHe(w: WordEntry): string {
  if (w.hs) return w.hs;
  return w.he.split(/[,;]/)[0].replace(/\(.*?\)/g, '').trim();
}

/** The one example shown first: short and everyday. */
export function mainExample(w: WordEntry): string | undefined {
  return w.easy ?? w.ex[0];
}

/** Every example, the everyday one first. */
export function allExamples(w: WordEntry): string[] {
  return [...new Set([w.easy, ...w.ex].filter((x): x is string => !!x))];
}

/** Strip [brackets] from an example for display. */
export function plain(sentence: string): string {
  return sentence.replace(/\[([^\]]+)\]/g, '$1');
}

/** Split an example into [before, target, after] around the bracketed form. */
export function splitGap(sentence: string): [string, string, string] | null {
  const m = sentence.match(/^(.*?)\[([^\]]+)\](.*)$/);
  if (!m) return null;
  return [plain(m[1]), m[2], plain(m[3])];
}

/** Base form of a family entry like "ubiquity (n.)" */
export function familyForms(w: WordEntry): string[] {
  return w.family.map((f) => f.replace(/\s*\(.*?\)\s*/g, '').trim()).filter(Boolean);
}
