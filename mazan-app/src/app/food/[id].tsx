/** Food detail: pick serving and quantity, see nutrition, and log it to a meal. */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MacroSummary, NutrientTable } from '@/components/nutrition';
import { useToast } from '@/components/overlays';
import { Txt } from '@/components/Txt';
import { Button, Card, Empty, Header, IconButton, Row, Screen, Segmented } from '@/components/ui';
import { logFood } from '@/db/repo/diary';
import { getFood, lastPortion, setFavorite } from '@/db/repo/foods';
import { mealForNow, today } from '@/domain/dates';
import { fmtInt, parseNum } from '@/domain/format';
import { foodName, portionNutrients } from '@/domain/portion';
import { MEALS, type Food, type Meal } from '@/domain/types';
import type { StringKey } from '@/i18n/en';
import { mealKey } from '@/features/diaryParts';
import { PortionPicker } from '@/features/PortionPicker';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useApp } from '@/state/AppProvider';

export default function FoodScreen() {
  const db = useSQLiteContext();
  const { t, lang, colors } = useApp();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; date?: string; meal?: Meal }>();
  const date = params.date ?? today();

  // Reloads after the food is edited or favourited.
  const { data: loaded } = useDbQuery((d) => getFood(d, Number(params.id)), [params.id], ['foods']);
  const food: Food | null | undefined = loaded;
  const [servingIndex, setServingIndex] = useState(0);
  const [qty, setQty] = useState('1');
  const [meal, setMeal] = useState<Meal>(params.meal && MEALS.includes(params.meal) ? params.meal : mealForNow());
  const [saving, setSaving] = useState(false);

  // Pre-select the portion used last time (once per food).
  useEffect(() => {
    let alive = true;
    (async () => {
      const f = await getFood(db, Number(params.id));
      const last = f ? await lastPortion(db, f.id) : null;
      if (!alive || !f || !last) return;
      const i = f.servings.findIndex((s) => s.amount === last.servingAmount && s.label === last.servingLabel);
      if (i >= 0) setServingIndex(i);
      setQty(String(last.quantity));
    })();
    return () => {
      alive = false;
    };
  }, [db, params.id]);

  const quantity = parseNum(qty) ?? 0;
  const nutrients = useMemo(
    () => (food ? portionNutrients(food, (food.servings[servingIndex] ?? food.servings[0])?.amount ?? 0, quantity) : {}),
    [food, servingIndex, quantity],
  );

  if (food === undefined) return <Screen header={<Header title="" back />}>{null}</Screen>;
  if (food === null)
    return (
      <Screen header={<Header title="" back />}>
        <Empty text={t('food.notFound')} />
      </Screen>
    );

  const toggleFav = () => setFavorite(db, food.id, !food.favorite);
  const edit = () => router.push({ pathname: '/custom-food', params: { id: String(food.id), date, meal } });
  const serving = food.servings[servingIndex] ?? food.servings[0];

  const add = async () => {
    if (quantity <= 0) return;
    setSaving(true);
    await logFood(db, { date, meal, food, serving, quantity });
    setSaving(false);
    toast(t('food.added', { meal: t(mealKey(meal)) }));
    router.dismissAll();
  };

  return (
    <Screen
      header={
        <Header
          title={foodName(food, lang)}
          subtitle={[food.brand, t(`food.source.${food.source}` as StringKey)].filter(Boolean).join(' · ')}
          back
          right={
            <Row gap={4}>
              <IconButton icon="edit" label={t('food.edit')} tint={colors.muted} onPress={edit} />
              <IconButton
                icon={food.favorite ? 'star-filled' : 'star'}
                label={t('food.favorite')}
                tint={food.favorite ? colors.carbs : colors.muted}
                onPress={toggleFav}
              />
            </Row>
          }
        />
      }
      footer={<Button title={t('food.addToDiary')} icon="plus" onPress={add} loading={saving} disabled={quantity <= 0} />}
    >
      <Card style={{ gap: 14 }}>
        <View style={{ alignItems: 'center' }}>
          <Txt variant="display">{fmtInt(nutrients.kcal)}</Txt>
          <Txt muted>{t('nut.kcal')}</Txt>
        </View>
        <MacroSummary n={nutrients} />
      </Card>

      <Card>
        <PortionPicker
          servings={food.servings}
          baseUnit={food.baseUnit}
          servingIndex={servingIndex}
          onServing={setServingIndex}
          quantity={qty}
          onQuantity={setQty}
        />
      </Card>

      <View style={{ gap: 8 }}>
        <Txt variant="label" muted>
          {t('food.meal')}
        </Txt>
        <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(mealKey(m)).replace(/^ארוחת /, '') }))} />
      </View>

      <Card>
        <Txt variant="h2" style={{ marginBottom: 4 }}>
          {t('food.nutrition')}
        </Txt>
        <NutrientTable n={nutrients} />
      </Card>

      {(food.source === 'off' || food.source === 'usda' || food.barcode) && (
        <Pressable onPress={edit}>
          <Txt variant="small" muted>
            {[
              food.source === 'off' ? t('food.offNote') : food.source === 'usda' ? t('food.usdaNote') : null,
              food.barcode ? t('food.barcode', { code: food.barcode }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </Pressable>
      )}
    </Screen>
  );
}
