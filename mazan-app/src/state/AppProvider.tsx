/**
 * App-wide state loaded from SQLite at start-up: language and direction, theme,
 * the user's profile, goals and preferences. Screens read it through the hooks at the bottom.
 */
import { getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { emit, subscribe } from '@/db/events';
import { latestWeight, setWeight } from '@/db/repo/body';
import { getSetting, setSetting } from '@/db/repo/settings';
import { today } from '@/domain/dates';
import { calculatePlan } from '@/domain/goals';
import type { Goals, Lang, LangSetting, Prefs, Profile, ThemeSetting } from '@/domain/types';
import en, { type StringKey } from '@/i18n/en';
import he from '@/i18n/he';
import { palettes, type Palette, type Scheme } from '@/theme/palette';

export type TFunction = (key: StringKey, vars?: Record<string, string | number>) => string;

interface AppContextValue {
  ready: boolean;
  lang: Lang;
  langSetting: LangSetting;
  isRTL: boolean;
  t: TFunction;
  scheme: Scheme;
  colors: Palette;
  themeSetting: ThemeSetting;
  profile: Profile | null;
  /** Goals with the calorie target recalculated from the latest weight when `autoKcal` is on. */
  goals: Goals | null;
  prefs: Prefs;
  currentWeightKg: number | null;
  setLang: (l: LangSetting) => Promise<void>;
  setTheme: (t: ThemeSetting) => Promise<void>;
  setPrefs: (p: Partial<Prefs>) => Promise<void>;
  saveProfile: (profile: Profile, goals: Goals) => Promise<void>;
  saveGoals: (goals: Goals) => Promise<void>;
  /** Erase everything the user created and return to onboarding. Seed foods, language and theme stay. */
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const DEFAULT_PREFS: Prefs = { netCarbs: false, usdaKey: '' };
const STRINGS = { en, he };

function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return code === 'he' || code === 'iw' ? 'he' : 'en';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();

  const [ready, setReady] = useState(false);
  const [langSetting, setLangSetting] = useState<LangSetting>('system');
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>('system');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [storedGoals, setStoredGoals] = useState<Goals | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [weight, setWeightState] = useState<number | null>(null);

  // Initial load.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [l, th, p, g, pr, w] = await Promise.all([
        getSetting<LangSetting>(db, 'lang', 'system'),
        getSetting<ThemeSetting>(db, 'theme', 'system'),
        getSetting<Profile | null>(db, 'profile', null),
        getSetting<Goals | null>(db, 'goals', null),
        getSetting<Prefs>(db, 'prefs', DEFAULT_PREFS),
        latestWeight(db),
      ]);
      if (!alive) return;
      setLangSetting(l);
      setThemeSetting(th);
      setProfile(p);
      setStoredGoals(g);
      setPrefsState({ ...DEFAULT_PREFS, ...pr });
      setWeightState(w?.kg ?? null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  // Keep the current weight fresh when the weight log changes.
  useEffect(
    () =>
      subscribe((topic) => {
        if (topic === 'weight') latestWeight(db).then((w) => setWeightState(w?.kg ?? null));
      }),
    [db],
  );

  const lang: Lang = langSetting === 'system' ? deviceLang() : langSetting;
  const scheme: Scheme = themeSetting === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeSetting;

  const t = useCallback<TFunction>(
    (key, vars) => {
      let s: string = STRINGS[lang][key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );

  const goals = useMemo<Goals | null>(() => {
    if (!storedGoals) return null;
    if (!storedGoals.autoKcal || !profile) return storedGoals;
    return { ...storedGoals, kcal: calculatePlan(profile, weight ?? profile.weightKg).target };
  }, [storedGoals, profile, weight]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      lang,
      langSetting,
      isRTL: lang === 'he',
      t,
      scheme,
      colors: palettes[scheme],
      themeSetting,
      profile,
      goals,
      prefs,
      currentWeightKg: weight ?? profile?.weightKg ?? null,
      setLang: async (l) => {
        setLangSetting(l);
        await setSetting(db, 'lang', l);
      },
      setTheme: async (th) => {
        setThemeSetting(th);
        await setSetting(db, 'theme', th);
      },
      setPrefs: async (p) => {
        const next = { ...prefs, ...p };
        setPrefsState(next);
        await setSetting(db, 'prefs', next);
      },
      saveProfile: async (p, g) => {
        await setSetting(db, 'profile', p);
        await setSetting(db, 'goals', g);
        // Record the weight given in onboarding as today's weigh-in.
        if (weight == null || Math.abs(weight - p.weightKg) > 0.001) await setWeight(db, today(), p.weightKg);
        setProfile(p);
        setStoredGoals(g);
        setWeightState(p.weightKg);
      },
      saveGoals: async (g) => {
        await setSetting(db, 'goals', g);
        setStoredGoals(g);
      },
      resetAll: async () => {
        await db.withExclusiveTransactionAsync(async (tx) => {
          await tx.execAsync(`
            DELETE FROM diary_entries;
            DELETE FROM water_log;
            DELETE FROM weights;
            DELETE FROM api_cache;
            DELETE FROM foods WHERE source <> 'seed';
            UPDATE foods SET favorite = 0;
            DELETE FROM settings WHERE key NOT IN ('seedVersion', 'lang', 'theme');
          `);
        });
        setProfile(null);
        setStoredGoals(null);
        setPrefsState(DEFAULT_PREFS);
        setWeightState(null);
        emit('diary', 'foods', 'water', 'weight', 'settings');
      },
    }),
    [ready, lang, langSetting, t, scheme, themeSetting, profile, goals, prefs, weight, db],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export const useColors = () => useApp().colors;
export function useI18n() {
  const { t, lang, isRTL } = useApp();
  return { t, lang, isRTL };
}
