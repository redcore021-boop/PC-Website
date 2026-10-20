/** Diary: one day at a time, four meals, with day navigation and totals. */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { MacroBars } from '@/components/nutrition';
import { Txt } from '@/components/Txt';
import { Card, IconButton, Row, Screen } from '@/components/ui';
import { entriesForDate, totals } from '@/db/repo/diary';
import { addDays, formatDayLong, today } from '@/domain/dates';
import { fmtInt } from '@/domain/format';
import { macroGrams } from '@/domain/goals';
import { MEALS } from '@/domain/types';
import { MealCard } from '@/features/diaryParts';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useApp } from '@/state/AppProvider';

export default function DiaryScreen() {
  const { t, lang, colors, goals } = useApp();
  const [date, setDate] = useState(today());
  const { data: entries = [] } = useDbQuery((db) => entriesForDate(db, date), [date], ['diary']);
  const sum = totals(entries);
  const goal = goals?.kcal ?? 0;
  const remaining = goal - (sum.kcal ?? 0);

  const rel = date === today() ? t('common.today') : date === addDays(today(), -1) ? t('common.yesterday') : date === addDays(today(), 1) ? t('common.tomorrow') : null;

  return (
    <Screen
      header={
        <Row style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
          <IconButton icon="chevron-back" label="previous day" onPress={() => setDate((d) => addDays(d, -1))} bg={colors.surface} />
          <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => setDate(today())}>
            <Txt variant="h2" center>
              {rel ?? formatDayLong(date, lang)}
            </Txt>
            {rel ? (
              <Txt variant="small" muted center>
                {formatDayLong(date, lang)}
              </Txt>
            ) : null}
          </Pressable>
          <IconButton icon="chevron-forward" label="next day" onPress={() => setDate((d) => addDays(d, 1))} bg={colors.surface} />
        </Row>
      }
    >
      <Card style={{ paddingVertical: 12 }}>
        <Row gap={4}>
          <Stat label={t('diary.goal')} value={fmtInt(goal)} />
          <Op>−</Op>
          <Stat label={t('home.food')} value={fmtInt(sum.kcal)} />
          <Op>+</Op>
          <Stat label={t('home.exercise')} value="0" />
          <Op>=</Op>
          <Stat label={t('diary.remaining')} value={fmtInt(remaining)} color={remaining >= 0 ? colors.accent : colors.danger} />
        </Row>
      </Card>

      {MEALS.map((m) => (
        <MealCard key={m} date={date} meal={m} entries={entries.filter((e) => e.meal === m)} showTimes />
      ))}

      {goals && (
        <Card style={{ gap: 12 }}>
          <Txt variant="h2">{t('diary.totals')}</Txt>
          <MacroBars totals={sum} targets={macroGrams(goals)} />
        </Card>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
      <Txt variant="num" color={color} numberOfLines={1}>
        {value}
      </Txt>
      <Txt variant="small" muted numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

function Op({ children }: { children: string }) {
  return (
    <Txt muted style={{ paddingBottom: 14 }}>
      {children}
    </Txt>
  );
}
