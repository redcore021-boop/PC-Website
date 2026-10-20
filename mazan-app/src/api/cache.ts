/**
 * Response cache in SQLite. Fresh entries are served without a request; when a request fails,
 * an expired entry is still better than nothing, so it is returned marked `stale`.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export interface Cached<T> {
  data: T;
  /** True when the network failed and this is an expired copy. */
  stale: boolean;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export async function readCache<T>(db: SQLiteDatabase, key: string): Promise<{ data: T; age: number } | null> {
  const row = await db.getFirstAsync<{ body: string; fetched_at: number }>('SELECT body, fetched_at FROM api_cache WHERE key = ?', key);
  if (!row) return null;
  try {
    return { data: JSON.parse(row.body) as T, age: Date.now() - row.fetched_at };
  } catch {
    return null;
  }
}

export async function writeCache(db: SQLiteDatabase, key: string, data: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO api_cache (key, body, fetched_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at',
    key,
    JSON.stringify(data),
    Date.now(),
  );
}

export async function cached<T>(db: SQLiteDatabase, key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<Cached<T>> {
  const hit = await readCache<T>(db, key);
  if (hit && hit.age < ttlMs) return { data: hit.data, stale: false };
  try {
    const data = await fetcher();
    await writeCache(db, key, data);
    return { data, stale: false };
  } catch (e) {
    if (hit) return { data: hit.data, stale: true };
    throw e;
  }
}

/** Keep the cache from growing forever: drop entries older than `maxAgeMs`. */
export async function pruneCache(db: SQLiteDatabase, maxAgeMs = 30 * DAY): Promise<void> {
  await db.runAsync('DELETE FROM api_cache WHERE fetched_at < ?', Date.now() - maxAgeMs);
}
