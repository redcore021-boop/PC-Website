/**
 * Text that follows the app's language direction.
 *
 * Mazan switches between Hebrew and English without restarting (Expo Go cannot flip the native
 * RTL flag at runtime), so direction is applied per component: `writingDirection` sets the base
 * direction and natural alignment then puts start-aligned text on the correct side.
 */
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useApp } from '@/state/AppProvider';

export type TxtVariant = 'display' | 'title' | 'h2' | 'body' | 'bodyStrong' | 'small' | 'label' | 'num' | 'numLarge';

const VARIANTS: Record<TxtVariant, TextStyle> = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  num: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numLarge: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
};

export interface TxtProps extends TextProps {
  variant?: TxtVariant;
  color?: string;
  muted?: boolean;
  center?: boolean;
}

export function Txt({ variant = 'body', color, muted, center, style, ...rest }: TxtProps) {
  const { colors, isRTL } = useApp();
  return (
    <Text
      {...rest}
      style={[
        VARIANTS[variant],
        { color: color ?? (muted ? colors.muted : colors.ink), writingDirection: isRTL ? 'rtl' : 'ltr' },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
