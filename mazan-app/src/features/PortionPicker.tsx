/** Serving chips + quantity stepper, used when logging and when editing an entry. */
import { View } from 'react-native';

import { Txt } from '@/components/Txt';
import { Chip, Row, Stepper } from '@/components/ui';
import { servingDescription } from '@/domain/portion';
import type { BaseUnit, Serving } from '@/domain/types';
import { useApp } from '@/state/AppProvider';

export function PortionPicker({
  servings,
  baseUnit,
  servingIndex,
  onServing,
  quantity,
  onQuantity,
}: {
  servings: Serving[];
  baseUnit: BaseUnit;
  servingIndex: number;
  onServing: (i: number) => void;
  quantity: string;
  onQuantity: (q: string) => void;
}) {
  const { t, lang } = useApp();
  const byWeight = baseUnit !== 'serving' && servings[servingIndex]?.amount === 1;
  return (
    <View style={{ gap: 14 }}>
      {servings.length > 1 && (
        <View style={{ gap: 8 }}>
          <Txt variant="label" muted>
            {t('food.serving')}
          </Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {servings.map((s, i) => (
              <Chip
                key={`${s.label}-${i}`}
                label={servingDescription(s, baseUnit, lang)}
                selected={i === servingIndex}
                onPress={() => {
                  // Switching between "grams" and a named serving keeps the same amount of food.
                  const cur = servings[servingIndex];
                  const q = parseFloat(quantity.replace(',', '.')) || 1;
                  const total = cur.amount * q;
                  const next = Math.round((total / s.amount) * 100) / 100;
                  onServing(i);
                  onQuantity(String(next > 0 ? next : 1));
                }}
              />
            ))}
          </Row>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <Txt variant="label" muted>
          {byWeight ? servingDescription(servings[servingIndex], baseUnit, lang) : t('food.quantity')}
        </Txt>
        <Stepper value={quantity} onChange={onQuantity} step={byWeight ? 10 : 0.5} min={byWeight ? 1 : 0.25} />
      </View>
    </View>
  );
}
