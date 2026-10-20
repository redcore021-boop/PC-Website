/**
 * Home: today's calorie balance, macros, and one-tap entry points per meal.
 * Stage 3 adds water, exercise and weight cards here.
 */
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Txt } from '@/components/Txt';
import { Card, IconButton, Row, Screen } from '@/components/ui';
import { entriesForDate, totals } from '@/db/repo/diary';
import { formatDayLong, today } from '@/domain/dates';
import { fmtInt } from '@/domain/format';
import { MEALS } from '@/domain/types';
import { CaloriesCard, MacrosCard } from '@/features/DaySummary';
import { mealKey, openAdd } from '@/features/diaryParts';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useApp } from '@/state/AppProvider';

export default function HomeScreen() {
  const { t, lang, colors } = useApp();
  const day = today();
  const { data: entries = [] } = useDbQuery((db) => entriesForDate(db, day), [day], ['diary']);
  const sum = totals(entries);

  return (
    <Screen
      header={
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Txt variant="small" muted>
            {formatDayLong(day, lang)}
          </Txt>
          <Txt variant="title">{t('appName')}</Txt>
        </View>
      }
    >
      <CaloriesCard food={sum.kcal ?? 0} />
      <MacrosCard totals={sum} />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Txt variant="h2" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
          {t('home.meals')}
        </Txt>
        {MEALS.map((m) => {
          const items = entries.filter((e) => e.meal === m);
          const kcal = totals(items).kcal ?? 0;
          return (
            <Pressable
              key={m}
              onPress={() => router.navigate('/diary')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingStart: 16,
                paddingEnd: 10,
                paddingVertical: 10,
                borderTopWidth: 0.5,
                borderColor: colors.line,
                backgroundColor: pressed ? colors.sunk : 'transparent',
              })}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="bodyStrong">{t(mealKey(m))}</Txt>
                <Txt variant="small" muted numberOfLines={1}>
                  {items.length ? items.map((e) => (lang === 'he' && e.nameHe ? e.nameHe : e.name)).join(', ') : t('diary.empty')}
                </Txt>
              </View>
              <Row gap={8}>
                <Txt variant="num">{fmtInt(kcal)}</Txt>
                <IconButton icon="plus" label={t('diary.addFood')} onPress={() => openAdd(day, m)} bg={colors.accentSoft} tint={colors.accent} size={36} />
              </Row>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}
