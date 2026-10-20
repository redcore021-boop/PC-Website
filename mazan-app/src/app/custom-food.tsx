/**
 * Create a custom food from a nutrition label. When a serving weight is given the food is stored
 * per 100 g, so it can later be logged in grams as well as in servings.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Txt } from '@/components/Txt';
import { Button, Card, Field, Header, Row, Screen } from '@/components/ui';
import { upsertFood } from '@/db/repo/foods';
import { parseNum } from '@/domain/format';
import { scaleNutrients, type NutrientKey, type Nutrients } from '@/domain/nutrients';
import type { Serving } from '@/domain/types';
import type { StringKey } from '@/i18n/en';
import { useApp } from '@/state/AppProvider';

const EXTRA: { key: NutrientKey; unit: 'g' | 'mg' }[] = [
  { key: 'fiber', unit: 'g' },
  { key: 'sugar', unit: 'g' },
  { key: 'satFat', unit: 'g' },
  { key: 'sodium', unit: 'mg' },
  { key: 'cholesterol', unit: 'mg' },
  { key: 'potassium', unit: 'mg' },
];

export default function CustomFoodScreen() {
  const db = useSQLiteContext();
  const { t, colors, lang } = useApp();
  const params = useLocalSearchParams<{ date?: string; meal?: string; name?: string }>();

  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [grams, setGrams] = useState('');
  const [values, setValues] = useState<Partial<Record<NutrientKey, string>>>({});
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const set = (k: NutrientKey) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const kcal = parseNum(values.kcal ?? '');
    if (!name.trim() || kcal == null || kcal < 0) {
      setError(t('cf.needName'));
      return;
    }
    const perServing: Nutrients = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseNum(v ?? '');
      if (n != null) perServing[k as NutrientKey] = n;
    }
    const label = servingLabel.trim() || (lang === 'he' ? 'מנה' : '1 serving');
    const g = parseNum(grams);
    const byWeight = g != null && g > 0;
    const servings: Serving[] = byWeight
      ? [
          { label, amount: g },
          ...(g !== 100 ? [{ label: '100 g', labelHe: "100 ג'", amount: 100 }] : []),
          { label: 'g', labelHe: "ג'", amount: 1 },
        ]
      : [{ label, amount: 1 }];

    const id = await upsertFood(db, {
      source: 'custom',
      name,
      brand,
      baseUnit: byWeight ? 'g' : 'serving',
      nutrients: byWeight ? scaleNutrients(perServing, 100 / g) : perServing,
      servings,
    });

    if (params.date && params.meal) {
      router.replace({ pathname: '/food/[id]', params: { id: String(id), date: params.date, meal: params.meal } });
    } else router.back();
  };

  const num = (k: NutrientKey, unit: string) => (
    <Field label={t(`nut.${k}` as StringKey)} value={values[k] ?? ''} onChangeText={set(k)} numeric suffix={unit} />
  );

  return (
    <Screen
      header={<Header title={t('cf.title')} back />}
      footer={<Button title={params.date ? t('cf.saveAndLog') : t('common.save')} onPress={save} />}
    >
      <Field label={t('cf.name')} value={name} onChangeText={(v) => (setName(v), setError(undefined))} placeholder={t('cf.namePlaceholder')} error={error} />
      <Field label={`${t('cf.brand')} (${t('common.optional')})`} value={brand} onChangeText={setBrand} />
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 3 }}>
          <Field label={t('cf.servingLabel')} value={servingLabel} onChangeText={setServingLabel} placeholder={t('cf.servingPlaceholder')} />
        </View>
        <View style={{ flex: 2 }}>
          <Field label={t('cf.servingSize')} value={grams} onChangeText={setGrams} numeric placeholder={t('common.optional')} />
        </View>
      </Row>

      <Card style={{ gap: 12 }}>
        <Txt variant="h2">{t('cf.perServing')}</Txt>
        {num('kcal', t('common.kcal'))}
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>{num('carbs', t('common.g'))}</View>
          <View style={{ flex: 1 }}>{num('protein', t('common.g'))}</View>
          <View style={{ flex: 1 }}>{num('fat', t('common.g'))}</View>
        </Row>
        <Pressable onPress={() => setMore((m) => !m)}>
          <Txt variant="bodyStrong" color={colors.accent}>
            {more ? t('food.fewerNutrients') : t('cf.more')}
          </Txt>
        </Pressable>
        {more && (
          <View style={{ gap: 10 }}>
            {EXTRA.map((e) => (
              <View key={e.key}>{num(e.key, e.unit === 'g' ? t('common.g') : t('common.mg'))}</View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}
