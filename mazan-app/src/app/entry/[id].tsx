/** Edit a diary entry: portion, meal, time eaten; or remove it. */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { MacroSummary, NutrientTable } from '@/components/nutrition';
import { useToast } from '@/components/overlays';
import { Txt } from '@/components/Txt';
import { Button, Card, Empty, Header, Row, Screen, Segmented } from '@/components/ui';
import { deleteEntry, getEntry, updateEntryPortion } from '@/db/repo/diary';
import { getFood } from '@/db/repo/foods';
import { formatTime } from '@/domain/dates';
import { fmtInt, parseNum } from '@/domain/format';
import { scaleNutrients } from '@/domain/nutrients';
import { foodName, portionNutrients } from '@/domain/portion';
import { MEALS, type DiaryEntry, type Food, type Meal, type Serving } from '@/domain/types';
import { mealKey } from '@/features/diaryParts';
import { PortionPicker } from '@/features/PortionPicker';
import { useApp } from '@/state/AppProvider';

export default function EntryScreen() {
  const db = useSQLiteContext();
  const { t, lang } = useApp();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<DiaryEntry | null | undefined>(undefined);
  const [food, setFood] = useState<Food | null>(null);
  const [servings, setServings] = useState<Serving[]>([]);
  const [servingIndex, setServingIndex] = useState(0);
  const [qty, setQty] = useState('1');
  const [meal, setMeal] = useState<Meal>('breakfast');

  useEffect(() => {
    let alive = true;
    (async () => {
      const e = await getEntry(db, Number(id));
      if (!alive) return;
      setEntry(e);
      if (!e) return;
      setMeal(e.meal);
      setQty(String(e.quantity));
      const current: Serving = { label: e.servingLabel, labelHe: e.servingLabelHe ?? undefined, amount: e.servingAmount };
      const f = e.foodId ? await getFood(db, e.foodId) : null;
      if (!alive) return;
      setFood(f);
      // Offer the food's servings when it still exists; make sure the logged serving is among them.
      const list = f ? [...f.servings] : [current];
      let i = list.findIndex((s) => s.amount === current.amount && s.label === current.label);
      if (i < 0) {
        list.unshift(current);
        i = 0;
      }
      setServings(list);
      setServingIndex(i);
    })();
    return () => {
      alive = false;
    };
  }, [db, id]);

  const quantity = parseNum(qty) ?? 0;
  const nutrients = useMemo(() => {
    if (!entry || !servings.length) return {};
    const s = servings[servingIndex];
    if (food) return portionNutrients(food, s.amount, quantity);
    const old = entry.servingAmount * entry.quantity;
    return old > 0 ? scaleNutrients(entry.nutrients, (s.amount * quantity) / old) : entry.nutrients;
  }, [entry, food, servings, servingIndex, quantity]);

  if (entry === undefined) return <Screen header={<Header title="" back />}>{null}</Screen>;
  if (entry === null)
    return (
      <Screen header={<Header title={t('entry.title')} back />}>
        <Empty text={t('food.notFound')} />
      </Screen>
    );

  const save = async () => {
    if (quantity <= 0) return;
    await updateEntryPortion(db, entry, { meal, quantity, serving: servings[servingIndex], food, nutrients });
    toast(t('entry.saved'));
    router.back();
  };

  const remove = () =>
    Alert.alert(t('entry.delete'), foodName(entry, lang), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, entry.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen
      header={<Header title={foodName(entry, lang)} subtitle={entry.brand ?? undefined} back />}
      footer={
        <Row>
          <Button title={t('common.delete')} icon="trash" kind="danger" onPress={remove} style={{ flex: 1 }} />
          <Button title={t('common.save')} onPress={save} disabled={quantity <= 0} style={{ flex: 2 }} />
        </Row>
      }
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
          servings={servings}
          baseUnit={entry.baseUnit}
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

      <Txt variant="small" muted>
        {t('entry.time')}: {formatTime(entry.loggedAt, lang)}
      </Txt>

      <Card>
        <Txt variant="h2" style={{ marginBottom: 4 }}>
          {t('food.nutrition')}
        </Txt>
        <NutrientTable n={nutrients} />
      </Card>
    </Screen>
  );
}
