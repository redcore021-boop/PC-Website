/**
 * Food picker. Search, or browse Recent / Frequent / Favorites / My foods.
 * Tapping + on a row logs it straight away with the last-used portion (2 taps from home).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { useToast } from '@/components/overlays';
import { Txt } from '@/components/Txt';
import { Button, Card, Empty, Field, Header, Row, Screen, Segmented } from '@/components/ui';
import { logFood } from '@/db/repo/diary';
import { favoriteFoods, frequentFoods, lastPortion, myFoods, recentFoods, searchLocalFoods } from '@/db/repo/foods';
import { mealForNow, today } from '@/domain/dates';
import { MEALS, type Food, type Meal } from '@/domain/types';
import { FoodRow, mealKey } from '@/features/diaryParts';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useApp } from '@/state/AppProvider';

type Tab = 'recent' | 'frequent' | 'favorites' | 'mine';

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
      if (searching) return searchLocalFoods(d, query);
      if (tab === 'recent') return recentFoods(d);
      if (tab === 'frequent') return frequentFoods(d);
      if (tab === 'favorites') return favoriteFoods(d);
      return myFoods(d);
    },
    [query, tab, searching],
    ['foods', 'diary'],
  );

  const open = (f: Food) => router.push({ pathname: '/food/[id]', params: { id: String(f.id), date, meal } });

  const quickLog = async (f: Food) => {
    const last = await lastPortion(db, f.id);
    const serving = (last && f.servings.find((s) => s.amount === last.servingAmount && s.label === last.servingLabel)) ?? f.servings[0];
    await logFood(db, { date, meal, food: f, serving, quantity: last?.quantity ?? 1 });
    toast(t('food.added', { meal: t(mealKey(meal)) }));
  };

  const emptyText = searching
    ? t('add.noResults')
    : { recent: t('add.emptyRecent'), frequent: t('add.emptyRecent'), favorites: t('add.emptyFavorites'), mine: t('add.emptyMine') }[tab];

  return (
    <Screen header={<Header title={t('add.title', { meal: t(mealKey(meal)) })} close />}>
      <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(mealKey(m)).replace(/^ארוחת /, '') }))} />
      <Field value={query} onChangeText={setQuery} placeholder={t('add.search')} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />

      {!searching && (
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
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {foods.length ? (
          <View style={{ marginTop: -0.5 }}>
            {foods.map((f) => (
              <FoodRow key={f.id} food={f} onOpen={() => open(f)} onQuickLog={() => quickLog(f)} />
            ))}
          </View>
        ) : (
          <Empty text={emptyText} />
        )}
      </Card>

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
      <Txt variant="small" muted center style={{ color: colors.muted }}>
        {t('add.onlineSoon')}
      </Txt>
    </Screen>
  );
}
