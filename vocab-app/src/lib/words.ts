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

/** Order in which unseen words are introduced: user-added first, then by tier, mixed across themes. */
export function introOrder(words: WordEntry[]): WordEntry[] {
  return [...words].sort((a, b) => {
    if (!!a.custom !== !!b.custom) return a.custom ? -1 : 1;
    if (a.tier !== b.tier) return a.tier - b.tier;
    return hashUnit(a.id) - hashUnit(b.id);
  });
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
