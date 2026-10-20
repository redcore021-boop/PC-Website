/**
 * Debounced online search across Open Food Facts and USDA. Each source fills in as soon as it
 * answers, so a slow source never holds back the other.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { searchOffCached, searchUsdaCached, type SourceResult } from '@/api/foodService';
import { useApp } from '@/state/AppProvider';

const DEBOUNCE_MS = 450;
export const MIN_QUERY = 2;

interface State {
  query: string;
  off?: SourceResult;
  usda?: SourceResult;
}

export function useOnlineSearch(raw: string) {
  const db = useSQLiteContext();
  const { prefs } = useApp();
  const query = raw.trim();
  const [state, setState] = useState<State>({ query: '' });

  useEffect(() => {
    if (query.length < MIN_QUERY) return;
    let alive = true;
    const timer = setTimeout(() => {
      setState({ query });
      searchOffCached(db, query).then((off) => alive && setState((s) => (s.query === query ? { ...s, off } : s)));
      searchUsdaCached(db, query, prefs.usdaKey).then((usda) => alive && setState((s) => (s.query === query ? { ...s, usda } : s)));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [db, query, prefs.usdaKey]);

  const current = query.length >= MIN_QUERY && state.query === query;
  return {
    active: query.length >= MIN_QUERY,
    off: current ? state.off : undefined,
    usda: current ? state.usda : undefined,
  };
}
