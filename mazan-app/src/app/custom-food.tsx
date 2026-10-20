/**
 * Create a food from a nutrition label, or correct an existing one (`?id=`).
 *
 * Values are entered per serving. When a serving weight is given the food is stored per 100 g,
 * so it can be logged in grams too. Correcting a scanned or custom food updates it in place and
 * recalculates past diary entries; built-in and USDA foods are saved as the user's own copy.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { useToast } from '@/components/overlays';
import { Txt } from '@/components/Txt';
import { Button, Card, Field, Header, Row, Screen } from '@/components/ui';
import { recomputeEntriesForFood } from '@/db/repo/diary';
import { archiveFood, getFood, updateFood, upsertFood } from '@/db/repo/foods';
import { fmt1, parseNum } from '@/domain/format';
import { scaleNutrients, type NutrientKey, type Nutrients } from '@/domain/nutrients';
import { foodName, portionNutrients, servingLabel as servingText } from '@/domain/portion';
import type { BaseUnit, Food, Serving } from '@/domain/types';
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
const HEBREW = /[֐-׿]/;

type Values = Partial<Record<NutrientKey, string>>;

export default function CustomFoodScreen() {
  const db = useSQLiteContext();
  const { t, colors, lang } = useApp();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; date?: string; meal?: string; name?: string; brand?: string; barcode?: string }>();
  const editId = params.id ? Number(params.id) : null;

  const [original, setOriginal] = useState<Food | null>(null);
  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState(params.brand ?? '');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [servingLabel, setServingLabel] = useState('');
  const [grams, setGrams] = useState(params.barcode ? '100' : '');
  const [values, setValues] = useState<Values>({});
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Edit mode: prefill from the food's first serving.
  useEffect(() => {
    if (editId == null) return;
    let alive = true;
    getFood(db, editId).then((f) => {
      if (!alive || !f) return;
      const s = f.servings[0];
      const per = portionNutrients(f, s.amount, 1);
      const v: Values = {};
      for (const [k, n] of Object.entries(per)) v[k as NutrientKey] = fmt1(n);
      setOriginal(f);
      setName(foodName(f, lang));
      setBrand(f.brand ?? '');
      setBarcode(f.barcode ?? '');
      setServingLabel(servingText(s, lang));
      setGrams(f.baseUnit === 'serving' ? '' : String(s.amount));
      setValues(v);
      setMore(EXTRA.some((e) => per[e.key] != null));
    });
    return () => {
      alive = false;
    };
  }, [db, editId, lang]);

  const set = (k: NutrientKey) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const kcal = parseNum(values.kcal ?? '');
    if (!name.trim() || kcal == null || kcal < 0) {
      setError(t('cf.needName'));
      return;
    }
    setSaving(true);
    const perServing: Nutrients = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseNum(v ?? '');
      if (n != null) perServing[k as NutrientKey] = n;
    }
    const label = servingLabel.trim() || (lang === 'he' ? 'מנה' : '1 serving');
    const g = parseNum(grams);
    const byWeight = g != null && g > 0;
    const baseUnit: BaseUnit = byWeight ? (original?.baseUnit === 'ml' ? 'ml' : 'g') : 'serving';
    const unit = baseUnit === 'ml' ? { en: 'ml', he: 'מ"ל' } : { en: 'g', he: "ג'" };
    const first: Serving = { label, labelHe: HEBREW.test(label) ? label : undefined, amount: byWeight ? g : 1 };
    // Keep the other servings when the food stays weight-based; otherwise rebuild them.
    const rest: Serving[] =
      byWeight && original && original.baseUnit === baseUnit
        ? original.servings.slice(1)
        : byWeight
          ? [
              ...(g !== 100 ? [{ label: `100 ${unit.en}`, labelHe: `100 ${unit.he}`, amount: 100 }] : []),
              { label: unit.en, labelHe: unit.he, amount: 1 },
            ]
          : [];
    const nutrients = byWeight ? scaleNutrients(perServing, 100 / g) : perServing;
    // Hebrew text goes into the Hebrew name; when editing, keep the other language's name.
    const typedHe = HEBREW.test(name);
    const names = {
      name: typedHe ? (original?.name && !HEBREW.test(original.name) ? original.name : name) : name,
      nameHe: typedHe ? name : (original?.nameHe ?? null),
    };
    const details = { ...names, brand, barcode: barcode.replace(/\D/g, '') || null, baseUnit, nutrients, servings: [first, ...rest] };

    const inPlace = original && (original.source === 'custom' || original.source === 'off');
    if (original && inPlace) {
      await updateFood(db, original.id, details);
      const updated = await getFood(db, original.id);
      const n = updated ? await recomputeEntriesForFood(db, updated) : 0;
      setSaving(false);
      toast(n ? t('cf.updatedEntries', { n }) : t('cf.saved'));
      router.back();
      return;
    }

    const id = await upsertFood(db, { source: 'custom', ...details });
    setSaving(false);
    toast(t('cf.saved'));
    // Came from the picker or the scanner: continue straight to logging the new food.
    if (params.date) router.replace({ pathname: '/food/[id]', params: { id: String(id), date: params.date, meal: params.meal ?? '' } });
    else if (original) router.replace({ pathname: '/food/[id]', params: { id: String(id) } });
    else router.back();
  };

  const remove = () =>
    original &&
    Alert.alert(t('cf.archive'), foodName(original, lang), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await archiveFood(db, original.id);
          toast(t('cf.archived'));
          router.dismissAll();
        },
      },
    ]);

  const num = (k: NutrientKey, unit: string) => (
    <Field label={t(`nut.${k}` as StringKey)} value={values[k] ?? ''} onChangeText={set(k)} numeric suffix={unit} />
  );

  const editing = editId != null;
  const copies = original && original.source !== 'custom' && original.source !== 'off';

  return (
    <Screen
      header={<Header title={editing ? t('cf.editTitle') : t('cf.title')} back />}
      footer={
        <Button
          title={editing ? t('common.save') : params.date ? t('cf.saveAndLog') : t('common.save')}
          onPress={save}
          loading={saving}
        />
      }
    >
      {copies && (
        <Txt variant="small" muted>
          {t('cf.copyNote')}
        </Txt>
      )}
      <Field
        label={t('cf.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        placeholder={t('cf.namePlaceholder')}
        error={error}
      />
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field label={`${t('cf.brand')} (${t('common.optional')})`} value={brand} onChangeText={setBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={`${t('cf.barcode')} (${t('common.optional')})`} value={barcode} onChangeText={setBarcode} keyboardType="number-pad" />
        </View>
      </Row>
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

      {original && (original.source === 'custom' || original.source === 'off') && (
        <Button title={t('cf.archive')} icon="trash" kind="danger" onPress={remove} />
      )}
    </Screen>
  );
}
