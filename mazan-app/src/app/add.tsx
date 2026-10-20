/**
 * Food picker. Typing searches this phone instantly and Open Food Facts + USDA after a short pause;
 * otherwise it shows Recent / Frequent / Favorites / My foods. The + on any row logs it straight away
 * with the last-used portion, so a repeat food takes two taps from home.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { saveRemoteFood, type SourceResult } from '@/api/foodService';
import type { ApiErrorKind } from '@/api/http';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/overlays';
import { Txt } from '@/components/Txt';
import { Button, Card, Empty, Field, Header, IconButton, Row, Screen, SectionLabel, Segmented } from '@/components/ui';
import { logFood } from '@/db/repo/diary';
import { favoriteFoods, frequentFoods, getFood, lastPortion, myFoods, recentFoods, searchLocalFoods, type NewFood } from '@/db/repo/foods';
import { mealForNow, today } from '@/domain/dates';
import { MEALS, type Food, type Meal } from '@/domain/types';
import { FoodRow, mealKey } from '@/features/diaryParts';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useOnlineSearch } from '@/hooks/useOnlineSearch';
import type { StringKey } from '@/i18n/en';
import { useApp } from '@/state/AppProvider';

type Tab = 'recent' | 'frequent' | 'favorites' | 'mine';

const ERROR_TEXT: Record<ApiErrorKind, StringKey> = {
  offline: 'search.offline',
  timeout: 'search.timeout',
  rateLimit: 'search.rateLimit',
  notFound: 'search.none',
  server: 'search.failed',
  badResponse: 'search.failed',
};

export default function AddFoodScreen() {
  const db = useSQLiteContext();
  const { t, colors } = useApp();
  const toast = useToast();
  const params = useLocalSearchParams<{ date?: string; meal?: Meal }>();
  const date = params.date ?? today();
  const [meal, setMeal] = useState<Meal>(params.meal && MEALS.includes(params.meal) ? params.meal : mealForNow());
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');

  const searching = query.trim().length > 0;
  const { data: foods = [] } = useDbQuery(
    (d) => {
      if (searching) return searchLocalFoods(d, query, 25);
      if (tab === 'recent') return recentFoods(d);
      if (tab === 'frequent') return frequentFoods(d);
      if (tab === 'favorites') return favoriteFoods(d);
      return myFoods(d);
    },
    [query, tab, searching],
    ['foods', 'diary'],
  );
  const online = useOnlineSearch(query);

  const open = (id: number) => router.push({ pathname: '/food/[id]', params: { id: String(id), date, meal } });
  const scan = () => router.push({ pathname: '/scan', params: { date, meal } });

  const quickLog = async (f: Food) => {
    const last = await lastPortion(db, f.id);
    const serving = (last && f.servings.find((s) => s.amount === last.servingAmount && s.label === last.servingLabel)) ?? f.servings[0];
    await logFood(db, { date, meal, food: f, serving, quantity: last?.quantity ?? 1 });
    toast(t('food.added', { meal: t(mealKey(meal)) }));
  };

  /** Online results are saved locally the moment they are used, which also caches them for offline use. */
  const openRemote = async (f: NewFood) => open(await saveRemoteFood(db, f));
  const quickLogRemote = async (f: NewFood) => {
    const food = await getFood(db, await saveRemoteFood(db, f));
    if (food) await quickLog(food);
  };

  // Hide online products that are already on this phone.
  const localBarcodes = new Set(foods.map((f) => f.barcode).filter(Boolean));
  const offFoods = (online.off?.foods ?? []).filter((f) => !f.barcode || !localBarcodes.has(f.barcode));

  const emptyText = { recent: t('add.emptyRecent'), frequent: t('add.emptyRecent'), favorites: t('add.emptyFavorites'), mine: t('add.emptyMine') }[tab];

  return (
    <Screen
      header={
        <Header
          title={t('add.title', { meal: t(mealKey(meal)) })}
          close
          right={<IconButton icon="barcode" label={t('scan.button')} onPress={scan} bg={colors.accentSoft} tint={colors.accent} />}
        />
      }
    >
      <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(mealKey(m)).replace(/^ארוחת /, '') }))} />
      <Field value={query} onChangeText={setQuery} placeholder={t('add.search')} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />

      {searching ? (
        <>
          {foods.length > 0 && (
            <>
              <SectionLabel>{t('search.local')}</SectionLabel>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {foods.map((f) => (
                  <FoodRow key={f.id} food={f} onOpen={() => open(f.id)} onQuickLog={() => quickLog(f)} />
                ))}
              </Card>
            </>
          )}
          {online.active ? (
            <>
              <OnlineSection title={t('search.off')} result={online.off} foods={offFoods} onOpen={openRemote} onQuickLog={quickLogRemote} />
              {/[֐-׿]/.test(query) ? (
                <Txt variant="small" muted>
                  {t('search.hebrewUsda')}
                </Txt>
              ) : (
                <OnlineSection title={t('search.usda')} result={online.usda} foods={online.usda?.foods ?? []} onOpen={openRemote} onQuickLog={quickLogRemote} />
              )}
            </>
          ) : (
            <Txt variant="small" muted>
              {t('search.typeMore')}
            </Txt>
          )}
        </>
      ) : (
        <>
          <Button title={t('scan.button')} icon="barcode" kind="secondary" onPress={scan} />
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'recent', label: t('add.recent') },
              { value: 'frequent', label: t('add.frequent') },
              { value: 'favorites', label: t('add.favorites') },
              { value: 'mine', label: t('add.myFoods') },
            ]}
          />
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {foods.length ? (
              foods.map((f) => <FoodRow key={f.id} food={f} onOpen={() => open(f.id)} onQuickLog={() => quickLog(f)} />)
            ) : (
              <Empty text={emptyText} />
            )}
          </Card>
        </>
      )}

      <Row>
        <Button
          title={t('diary.quickAdd')}
          icon="bolt"
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/quick-add', params: { date, meal } })}
        />
        <Button
          title={t('add.createFood')}
          icon="plus"
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/custom-food', params: { date, meal, name: query } })}
        />
      </Row>
    </Screen>
  );
}

/** One online source: loading, error/offline note, stale note, and its results. */
function OnlineSection({
  title,
  result,
  foods,
  onOpen,
  onQuickLog,
}: {
  title: string;
  result: SourceResult | undefined;
  foods: NewFood[];
  onOpen: (f: NewFood) => void;
  onQuickLog: (f: NewFood) => void;
}) {
  const { t, colors } = useApp();
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{title}</SectionLabel>
      {!result ? (
        <Row gap={8}>
          <ActivityIndicator color={colors.accent} />
          <Txt variant="small" muted>
            {t('search.searching')}
          </Txt>
        </Row>
      ) : (
        <>
          {(result.error || result.stale) && (
            <Row gap={8} style={{ alignItems: 'flex-start' }}>
              <Icon name={result.error === 'offline' || result.stale ? 'globe' : 'shield'} size={16} color={colors.muted} />
              <Txt variant="small" muted style={{ flex: 1 }}>
                {result.stale ? t('search.stale') : t(ERROR_TEXT[result.error!])}
              </Txt>
            </Row>
          )}
          {foods.length > 0 ? (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {foods.map((f) => (
                <FoodRow key={`${f.source}:${f.sourceId}`} food={{ ...f, nameHe: f.nameHe ?? null, brand: f.brand ?? null }} onOpen={() => onOpen(f)} onQuickLog={() => onQuickLog(f)} />
              ))}
            </Card>
          ) : !result.error ? (
            <Txt variant="small" muted>
              {t('search.none')}
            </Txt>
          ) : null}
        </>
      )}
    </View>
  );
}
