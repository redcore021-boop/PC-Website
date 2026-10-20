/**
 * Run an async SQLite query and re-run it whenever `deps` change or one of `topics` is emitted.
 * The previous result stays visible while reloading so lists do not flash empty.
 */
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { subscribe, type Topic } from '@/db/events';

export function useDbQuery<T>(
  query: (db: SQLiteDatabase) => Promise<T>,
  deps: unknown[],
  topics: Topic[],
): { data: T | undefined; reload: () => void } {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);
  // Bumped to force a reload without changing deps.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    query(db)
      .then((res) => {
        // Ignore a result that arrives after a newer query has started.
        if (alive) setData(res);
      })
      .catch((e) => console.warn('[useDbQuery]', e));
    return () => {
      alive = false;
    };
    // `query` is a fresh closure each render; `deps` lists what it actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  const topicKey = topics.join(',');
  useEffect(
    () =>
      subscribe((t) => {
        if (topicKey.split(',').includes(t)) reload();
      }),
    [reload, topicKey],
  );

  return { data, reload };
}
