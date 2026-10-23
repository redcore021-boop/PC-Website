import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Settings, WordEntry } from './types';
import { db } from './lib/db';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './lib/store';
import { builtInWords } from './lib/words';

interface AppState {
  ready: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  words: WordEntry[];
  wordById: Map<string, WordEntry>;
  toast: (msg: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });
    // ask the browser not to evict our IndexedDB data under storage pressure
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    const light = settings.theme === 'light' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
    meta?.setAttribute('content', light ? '#f6f4ef' : '#101218');
  }, [settings.theme]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await saveSettings(patch));
  }, []);

  const custom = useLiveQuery(() => db.customWords.toArray(), [], []);
  const edits = useLiveQuery(() => db.edits.toArray(), [], []);

  const words = useMemo(() => {
    const editById = new Map(edits.map((e) => [e.id, e]));
    const builtInIds = new Set(builtInWords.map((w) => w.id));
    const all = [...builtInWords, ...custom.filter((w) => !builtInIds.has(w.id)).map((w) => ({ ...w, custom: true }))];
    return all.map((w) => {
      const e = editById.get(w.id);
      return e?.he !== undefined ? { ...w, he: e.he } : w;
    });
  }, [custom, edits]);

  const wordById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const value = useMemo(
    () => ({ ready, settings, updateSettings, words, wordById, toast }),
    [ready, settings, updateSettings, words, wordById, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </Ctx.Provider>
  );
}
