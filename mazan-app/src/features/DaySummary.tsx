/** Calories ring with the Goal − Food + Exercise equation, and macro bars. */
import { View } from 'react-native';

import { MacroBars, Ring } from '@/components/nutrition';
import { Txt } from '@/components/Txt';
import { Card, Row } from '@/components/ui';
import { fmtInt } from '@/domain/format';
import { macroGrams } from '@/domain/goals';
import type { Nutrients } from '@/domain/nutrients';
import { useApp } from '@/state/AppProvider';

export function CaloriesCard({ food, exercise = 0 }: { food: number; exercise?: number }) {
  const { t, colors, goals } = useApp();
  const goal = goals?.kcal ?? 2000;
  const remaining = goal - food + exercise;
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="h2">{t('nut.kcal')}</Txt>
        <Txt variant="small" muted style={{ flexShrink: 1 }} numberOfLines={1}>
          {t('home.formula')}
        </Txt>
      </Row>
      <Row gap={18}>
        <Ring value={food} max={goal + exercise}>
          <Txt variant="display" style={{ fontSize: 32 }}>
            {fmtInt(Math.abs(remaining))}
          </Txt>
          <Txt variant="small" muted>
            {remaining >= 0 ? t('home.remaining') : t('home.over')}
          </Txt>
        </Ring>
        <View style={{ flex: 1, gap: 8 }}>
          <EqRow label={t('home.goal')} value={fmtInt(goal)} />
          <EqRow label={t('home.food')} value={`− ${fmtInt(food)}`} />
          <EqRow label={t('home.exercise')} value={`+ ${fmtInt(exercise)}`} color={colors.exercise} />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <EqRow label={t('home.remaining')} value={fmtInt(remaining)} color={remaining >= 0 ? colors.accent : colors.danger} strong />
        </View>
      </Row>
    </Card>
  );
}

function EqRow({ label, value, color, strong }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt muted={!strong} variant={strong ? 'bodyStrong' : 'body'}>
        {label}
      </Txt>
      <Txt variant={strong ? 'numLarge' : 'num'} color={color} style={strong ? { fontSize: 19 } : undefined}>
        {value}
      </Txt>
    </Row>
  );
}

export function MacrosCard({ totals }: { totals: Nutrients }) {
  const { t, goals } = useApp();
  if (!goals) return null;
  return (
    <Card style={{ gap: 12 }}>
      <Txt variant="h2">{t('home.macros')}</Txt>
      <MacroBars totals={totals} targets={macroGrams(goals)} />
    </Card>
  );
}
