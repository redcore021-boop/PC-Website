import type { WordEntry } from '../types';
import { db } from './db';

/** Free Dictionary API (https://dictionaryapi.dev) — no key, no cost. Results are cached in IndexedDB. */
const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

interface ApiDefinition { definition: string; example?: string; synonyms?: string[] }
interface ApiMeaning { partOfSpeech: string; definitions: ApiDefinition[]; synonyms?: string[] }
interface ApiEntry { word: string; phonetic?: string; phonetics?: { text?: string }[]; meanings: ApiMeaning[] }

export interface Sense {
  pos: string;
  def: string;
  example?: string;
}

export interface Lookup {
  word: string;
  ipa: string;
  senses: Sense[];
  synonyms: string[];
}

export class LookupError extends Error {
  constructor(message: string, readonly kind: 'not-found' | 'offline' | 'busy') {
    super(message);
  }
}

async function fetchEntries(word: string): Promise<ApiEntry[] | null> {
  const cached = await db.dictCache.get(word);
  if (cached) return cached.data as ApiEntry[] | null;
  if (!navigator.onLine) throw new LookupError('You’re offline. Connect to look up new words, or fill in the meaning yourself.', 'offline');
  let res: Response;
  try {
    res = await fetch(API + encodeURIComponent(word));
  } catch {
    throw new LookupError('Couldn’t reach the dictionary. Check your connection or fill in the meaning yourself.', 'offline');
  }
  if (res.status === 404) {
    await db.dictCache.put({ word, fetchedAt: Date.now(), data: null });
    return null;
  }
  if (!res.ok) throw new LookupError('The free dictionary is busy right now. Try again in a minute.', 'busy');
  const data = (await res.json()) as ApiEntry[];
  await db.dictCache.put({ word, fetchedAt: Date.now(), data });
  return data;
}

// "past tense of mitigate", "plural of anomaly" → follow to the base word
const FORM_OF = /\b(?:simple past|past participle|present participle|past tense|plural|third-person singular|comparative|superlative)[a-z ,-]*? of ([a-z-]+)\b/i;

export function parseEntries(entries: ApiEntry[]): Lookup {
  const ipa =
    entries.flatMap((e) => [e.phonetic, ...(e.phonetics ?? []).map((p) => p.text)]).find((x): x is string => !!x)?.replace(/^\/|\/$/g, '').replace(/[[\]]/g, '') ?? '';
  const senses: Sense[] = [];
  const synonyms = new Set<string>();
  for (const e of entries) {
    for (const m of e.meanings) {
      m.synonyms?.forEach((s) => synonyms.add(s));
      for (const d of m.definitions) {
        d.synonyms?.forEach((s) => synonyms.add(s));
        if (senses.length < 8) senses.push({ pos: m.partOfSpeech, def: d.definition, example: d.example });
      }
    }
  }
  return { word: entries[0].word, ipa, senses, synonyms: [...synonyms].slice(0, 6) };
}

/** Look a word up, following inflected forms to their base word (mitigated → mitigate). */
export async function lookupWord(word: string, depth = 0): Promise<Lookup> {
  const w = word.toLowerCase();
  const entries = await fetchEntries(w);
  if (!entries?.length) throw new LookupError(`No dictionary entry for “${word}”. You can still add it with your own definition.`, 'not-found');
  const parsed = parseEntries(entries);
  const formOf = parsed.senses[0]?.def.match(FORM_OF)?.[1];
  if (formOf && depth === 0 && formOf.toLowerCase() !== w) {
    try {
      return await lookupWord(formOf, 1);
    } catch {
      return parsed;
    }
  }
  return parsed;
}

/** Put [brackets] around the first occurrence of the word (or an inflection of it) for gap cards. */
export function bracketWord(sentence: string, word: string): string {
  if (sentence.includes('[')) return sentence;
  const stem = word.toLowerCase().replace(/(e|y)$/, '');
  const re = new RegExp(`\\b(${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*)\\b`, 'i');
  return re.test(sentence) ? sentence.replace(re, '[$1]') : sentence;
}

export function makeCustomWord(fields: { word: string; ipa: string; pos: string; def: string; he: string; examples: string[]; synonyms: string[] }): WordEntry {
  const id = fields.word.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id,
    word: fields.word.trim(),
    ipa: fields.ipa.trim(),
    pos: fields.pos.trim() || 'word',
    def: fields.def.trim(),
    he: fields.he.trim(),
    family: [],
    ex: fields.examples.map((e) => bracketWord(e.trim(), fields.word)).filter(Boolean),
    col: [],
    reg: 'neutral',
    syn: fields.synonyms,
    nuance: '',
    ety: '',
    tier: 1,
    themes: [],
    custom: true,
  };
}
