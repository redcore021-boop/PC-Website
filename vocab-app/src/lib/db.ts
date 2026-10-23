import Dexie, { type Table } from 'dexie';
import type { DayLog, Progress, ReviewEntry, UserSentence, WordEntry } from '../types';

export interface KV {
  key: string;
  value: unknown;
}

export interface WordEdit {
  id: string;
  he?: string;
  note?: string;
}

export interface DictCacheEntry {
  word: string;
  fetchedAt: number;
  data: unknown;
}

export class VocabDB extends Dexie {
  progress!: Table<Progress, string>;
  reviews!: Table<ReviewEntry, number>;
  customWords!: Table<WordEntry, string>;
  edits!: Table<WordEdit, string>;
  kv!: Table<KV, string>;
  sentences!: Table<UserSentence, number>;
  days!: Table<DayLog, string>;
  dictCache!: Table<DictCacheEntry, string>;

  constructor(name = 'lexicon') {
    super(name);
    this.version(1).stores({
      progress: 'wordId, card.due, mastered',
      reviews: '++id, wordId, day, at',
      customWords: 'id',
      edits: 'id',
      kv: 'key',
      sentences: '++id, wordId, at',
      days: 'day',
      dictCache: 'word',
    });
  }
}

export const db = new VocabDB();

/** Tables included in backups, in restore order. dictCache is a cache and is left out. */
export const BACKUP_TABLES = ['progress', 'reviews', 'customWords', 'edits', 'kv', 'sentences', 'days'] as const;
