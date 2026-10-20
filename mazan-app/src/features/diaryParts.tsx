/** Pieces shared by the home and diary screens and the food picker. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ActionMenu, useToast } from '@/components/overlays';
import { Txt } from '@/components/Txt';
import { Card, IconButton, Row } from '@/components/ui';
import { copyMeal, totals } from '@/db/repo/diary';
import { addDays, formatTime } from '@/domain/dates';
import { fmtInt } from '@/domain/format';
import { foodName, portionNutrients, servingDescription, servingLabel } from '@/domain/portion';
import type { DiaryEntry, Food, Meal } from '@/domain/types';
import type { StringKey } from '@/i18n/en';
import { useApp } from '@/state/AppProvider';

export const mealKey = (m: Meal) => `meal.${m}` as StringKey;

export function openAdd(date: string, meal: Meal) {
  router.push({ pathname: '/add', params: { date, meal } });
}

/** "1.5 × 1 cup" or "1 cup", localised. */
export function entryPortion(e: DiaryEntry, lang: 'en' | 'he'): string {
  const label = servingLabel({ label: e.servingLabel, labelHe: e.servingLabelHe ?? undefined }, lang);
  if (e.baseUnit !== 'serving' && e.servingAmount === 1) {
    // Logged by weight/volume directly: "150 g".
    return `${Math.round(e.quantity)} ${label}`;
  }
  return e.quantity === 1 ? label : `${Math.round(e.quantity * 100) / 100} × ${label}`;
}

/** One meal: header with calories and a menu, its entries, and an add row. */
export function MealCard({ date, meal, entries, showTimes }: { date: string; meal: Meal; entries: DiaryEntry[]; showTimes?: boolean }) {
  const db = useSQLiteContext();
  const { t, colors, lang } = useApp();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const kcal = totals(entries).kcal ?? 0;

  const copyPrev = async () => {
    const n = await copyMeal(db, addDays(date, -1), date, meal);
    toast(n ? t('diary.copied', { n }) : t('diary.nothingToCopy'));
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Row style={styles.mealHead}>
        <Txt variant="h2" style={{ flex: 1 }}>
          {t(mealKey(meal))}
        </Txt>
        <Txt variant="num">{fmtInt(kcal)}</Txt>
        <IconButton icon="dots" label={t('diary.mealOptions', { meal: t(mealKey(meal)) })} onPress={() => setMenu(true)} size={34} tint={colors.muted} />
      </Row>
      {entries.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => router.push({ pathname: '/entry/[id]', params: { id: String(e.id) } })}
          style={({ pressed }) => [styles.entry, { borderColor: colors.line }, pressed && { backgroundColor: colors.sunk }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="bodyStrong" numberOfLines={2}>
              {foodName(e, lang)}
            </Txt>
            <Txt variant="small" muted numberOfLines={1}>
              {[e.brand, entryPortion(e, lang), showTimes ? formatTime(e.loggedAt, lang) : null].filter(Boolean).join(' · ')}
            </Txt>
          </View>
          <Txt variant="num">{fmtInt(e.nutrients.kcal)}</Txt>
        </Pressable>
      ))}
      <Pressable
        onPress={() => openAdd(date, meal)}
        style={({ pressed }) => [styles.addRow, { borderColor: colors.line }, pressed && { backgroundColor: colors.sunk }]}
      >
        <Icon name="plus" size={18} color={colors.accent} strokeWidth={2.4} />
        <Txt variant="bodyStrong" color={colors.accent}>
          {t('diary.addFood')}
        </Txt>
      </Pressable>
      <ActionMenu
        visible={menu}
        title={t(mealKey(meal))}
        onClose={() => setMenu(false)}
        items={[
          { label: t('diary.quickAdd'), icon: 'bolt', onPress: () => router.push({ pathname: '/quick-add', params: { date, meal } }) },
          { label: t('diary.copyPrevious'), icon: 'copy', onPress: copyPrev },
        ]}
      />
    </Card>
  );
}

/** A food in the picker: tap for details, or the + to log the default portion right away. */
export function FoodRow({ food, onOpen, onQuickLog }: { food: Food; onOpen: () => void; onQuickLog: () => void }) {
  const { colors, lang, t } = useApp();
  const s = food.servings[0];
  const kcal = portionNutrients(food, s.amount, 1).kcal ?? 0;
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.entry, { borderColor: colors.line }, pressed && { backgroundColor: colors.sunk }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {foodName(food, lang)}
        </Txt>
        <Txt variant="small" muted numberOfLines={1}>
          {[food.brand, servingDescription(s, food.baseUnit, lang), `${fmtInt(kcal)} ${t('common.kcal')}`].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      {food.favorite && <Icon name="star-filled" size={16} color={colors.carbs} />}
      <IconButton icon="plus" label={t('common.add')} onPress={onQuickLog} bg={colors.accentSoft} tint={colors.accent} size={36} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mealHead: { paddingStart: 16, paddingEnd: 8, paddingTop: 10, paddingBottom: 6 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
