/** Quick add: log calories and macros directly. */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { useToast } from '@/components/overlays';
import { Txt } from '@/components/Txt';
import { Button, Field, Header, Row, Screen, Segmented } from '@/components/ui';
import { quickAdd } from '@/db/repo/diary';
import { mealForNow, today } from '@/domain/dates';
import { parseNum } from '@/domain/format';
import { MEALS, type Meal } from '@/domain/types';
import { mealKey } from '@/features/diaryParts';
import { useApp } from '@/state/AppProvider';

export default function QuickAddScreen() {
  const db = useSQLiteContext();
  const { t } = useApp();
  const toast = useToast();
  const params = useLocalSearchParams<{ date?: string; meal?: Meal }>();
  const [meal, setMeal] = useState<Meal>(params.meal && MEALS.includes(params.meal) ? params.meal : mealForNow());
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | undefined>();

  const save = async () => {
    const k = parseNum(kcal);
    if (k == null || k <= 0) {
      setError(t('qa.needKcal'));
      return;
    }
    await quickAdd(db, {
      date: params.date ?? today(),
      meal,
      name: name.trim() || t('qa.defaultName'),
      nutrients: { kcal: k, carbs: parseNum(carbs) ?? 0, protein: parseNum(protein) ?? 0, fat: parseNum(fat) ?? 0 },
    });
    toast(t('food.added', { meal: t(mealKey(meal)) }));
    router.dismissAll();
  };

  return (
    <Screen header={<Header title={t('qa.title')} back />} footer={<Button title={t('food.addToDiary')} onPress={save} />}>
      <Txt muted>{t('qa.hint')}</Txt>
      <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(mealKey(m)).replace(/^ארוחת /, '') }))} />
      <Field label={`${t('qa.name')} (${t('common.optional')})`} value={name} onChangeText={setName} placeholder={t('qa.namePlaceholder')} />
      <Field
        label={t('nut.kcal')}
        value={kcal}
        onChangeText={(v) => {
          setKcal(v);
          setError(undefined);
        }}
        numeric
        suffix={t('common.kcal')}
        error={error}
        autoFocus
      />
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field label={t('nut.carbs')} value={carbs} onChangeText={setCarbs} numeric suffix={t('common.g')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('nut.protein')} value={protein} onChangeText={setProtein} numeric suffix={t('common.g')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('nut.fat')} value={fat} onChangeText={setFat} numeric suffix={t('common.g')} />
        </View>
      </Row>
    </Screen>
  );
}
