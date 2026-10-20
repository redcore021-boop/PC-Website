/** Nutrition visuals: calorie ring, macro bars and the full nutrient table. */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { fmt1, fmtInt } from '@/domain/format';
import { NUTRIENT_KEYS, NUTRIENT_UNITS, netCarbs, type NutrientKey, type Nutrients } from '@/domain/nutrients';
import type { MacroSplit } from '@/domain/types';
import type { StringKey } from '@/i18n/en';
import { useApp } from '@/state/AppProvider';

import { Txt } from './Txt';
import { Row } from './ui';

/** Progress ring. `value / max` fills clockwise from the top; overflow turns the ring red. */
export function Ring({
  value,
  max,
  size = 140,
  stroke = 13,
  color,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const { colors } = useApp();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.sunk} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.danger : (color ?? colors.accent)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

export function Bar({ value, max, color, height = 7 }: { value: number; max: number; color: string; height?: number }) {
  const { colors } = useApp();
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.sunk, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height, backgroundColor: value > max * 1.05 ? colors.danger : color }} />
    </View>
  );
}

/** Carbs / protein / fat progress against targets, in three columns. */
export function MacroBars({ totals, targets }: { totals: Nutrients; targets: MacroSplit }) {
  const { colors, t, prefs } = useApp();
  const carbs = prefs.netCarbs ? netCarbs(totals) : (totals.carbs ?? 0);
  const items: { key: StringKey; v: number; goal: number; color: string }[] = [
    { key: prefs.netCarbs ? 'nut.netCarbs' : 'nut.carbs', v: carbs, goal: targets.carbs, color: colors.carbs },
    { key: 'nut.protein', v: totals.protein ?? 0, goal: targets.protein, color: colors.protein },
    { key: 'nut.fat', v: totals.fat ?? 0, goal: targets.fat, color: colors.fat },
  ];
  return (
    <Row gap={14} style={{ alignItems: 'flex-start' }}>
      {items.map((m) => (
        <View key={m.key} style={{ flex: 1, gap: 6 }}>
          <Txt variant="small" color={m.color} style={{ fontWeight: '700' }} numberOfLines={1}>
            {t(m.key)}
          </Txt>
          <Bar value={m.v} max={m.goal} color={m.color} />
          <Txt variant="small" muted style={{ fontVariant: ['tabular-nums'] }}>
            {fmtInt(m.v)} / {fmtInt(m.goal)} {t('common.g')}
          </Txt>
        </View>
      ))}
    </Row>
  );
}

/** Four-column calories + macros summary used on food screens. */
export function MacroSummary({ n }: { n: Nutrients }) {
  const { colors, t, prefs } = useApp();
  const cells: { v: string; label: string; color: string }[] = [
    { v: fmtInt(n.kcal), label: t('common.kcal'), color: colors.muted },
    { v: fmt1(prefs.netCarbs ? netCarbs(n) : n.carbs), label: t(prefs.netCarbs ? 'nut.netCarbs' : 'nut.carbs'), color: colors.carbs },
    { v: fmt1(n.protein), label: t('nut.protein'), color: colors.protein },
    { v: fmt1(n.fat), label: t('nut.fat'), color: colors.fat },
  ];
  return (
    <Row gap={4}>
      {cells.map((c) => (
        <View key={c.label} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Txt variant="numLarge">{c.v}</Txt>
          <Txt variant="small" color={c.color} style={{ fontWeight: '700' }} numberOfLines={1}>
            {c.label}
          </Txt>
        </View>
      ))}
    </Row>
  );
}

const MAIN: NutrientKey[] = ['kcal', 'protein', 'carbs', 'fiber', 'sugar', 'fat', 'satFat'];

/** Label-style nutrient table. Shows the main rows, with the rest behind a toggle. */
export function NutrientTable({ n }: { n: Nutrients }) {
  const { colors, t, prefs } = useApp();
  const [all, setAll] = useState(false);
  const unitLabel = (k: NutrientKey) =>
    ({ kcal: t('common.kcal'), g: t('common.g'), mg: t('common.mg'), 'µg': t('common.ug') })[NUTRIENT_UNITS[k]];
  const keys = NUTRIENT_KEYS.filter((k) => (all ? n[k] != null || MAIN.includes(k) : MAIN.includes(k)));
  const hasMore = NUTRIENT_KEYS.some((k) => !MAIN.includes(k) && n[k] != null);
  const indent: NutrientKey[] = ['fiber', 'sugar', 'satFat', 'transFat'];
  return (
    <View>
      {keys.map((k) => (
        <View key={k} style={[styles.tableRow, { borderColor: colors.line }]}>
          <Txt variant={indent.includes(k) ? 'small' : 'bodyStrong'} style={indent.includes(k) ? { paddingStart: 12 } : undefined} muted={indent.includes(k)}>
            {t(`nut.${k}` as StringKey)}
          </Txt>
          <Txt variant="num">{n[k] == null ? '—' : `${k === 'kcal' ? fmtInt(n[k]) : fmt1(n[k])} ${unitLabel(k)}`}</Txt>
        </View>
      ))}
      {prefs.netCarbs && (
        <View style={[styles.tableRow, { borderColor: colors.line }]}>
          <Txt variant="bodyStrong">{t('nut.netCarbs')}</Txt>
          <Txt variant="num">
            {fmt1(netCarbs(n))} {t('common.g')}
          </Txt>
        </View>
      )}
      {hasMore && (
        <Pressable onPress={() => setAll((v) => !v)} style={{ paddingTop: 12 }}>
          <Txt variant="bodyStrong" color={colors.accent}>
            {all ? t('food.fewerNutrients') : t('food.allNutrients')}
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
