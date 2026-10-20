/** Small building blocks shared by every screen. */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/state/AppProvider';
import { radius } from '@/theme/palette';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

/** Root of every screen: background, layout direction and optional scrolling. */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  contentStyle,
  modal = false,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Modal sheets have no status bar above them, so they skip the top inset. */
  modal?: boolean;
}) {
  const { colors, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const body = [{ padding: 16, gap: 12, paddingBottom: footer ? 16 : insets.bottom + 24 }, contentStyle];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, direction: isRTL ? 'rtl' : 'ltr', paddingTop: modal ? 0 : insets.top }}>
      {header}
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={body}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
      {footer && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 12, backgroundColor: colors.bg }}>{footer}</View>
      )}
    </View>
  );
}

/** Screen header with an optional back/close button and trailing actions. */
export function Header({
  title,
  subtitle,
  back,
  close,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  close?: boolean;
  right?: ReactNode;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.header}>
      {(back || close) && (
        <IconButton
          icon={close ? 'close' : 'chevron-back'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          tint={colors.ink}
          bg={colors.sunk}
          label={close ? 'close' : 'back'}
        />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="title" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" muted numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors, scheme } = useApp();
  const base = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: scheme === 'dark' ? colors.line : 'transparent' },
    scheme === 'light' && styles.cardShadow,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
  haptic = true,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const { colors } = useApp();
  const bg = { primary: colors.accent, secondary: colors.accentSoft, ghost: 'transparent', danger: colors.dangerSoft }[kind];
  const fg = { primary: colors.accentInk, secondary: colors.accent, ghost: colors.accent, danger: colors.danger }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Txt variant="bodyStrong" color={fg}>
        {title}
      </Txt>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  tint,
  bg,
  size = 40,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  tint?: string;
  bg?: string;
  size?: number;
  label: string;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg ?? 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={size * 0.5} color={tint ?? colors.ink} />
    </Pressable>
  );
}

/** Labelled text input; numeric inputs get the decimal keyboard. */
export function Field({
  label,
  suffix,
  error,
  style,
  numeric,
  ...input
}: TextInputProps & { label?: string; suffix?: string; error?: string; numeric?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors, isRTL } = useApp();
  // Physical alignment for the input text. React Native mirrors left/right only when the native
  // RTL flag is on, so take that into account.
  const align = isRTL !== I18nManager.isRTL ? 'right' : 'left';
  return (
    <View style={[{ gap: 6, minWidth: 0 }, style]}>
      {label ? (
        <Txt variant="label" muted>
          {label}
        </Txt>
      ) : null}
      <View style={[styles.field, { backgroundColor: colors.sunk, borderColor: error ? colors.danger : 'transparent' }]}>
        <TextInput
          placeholderTextColor={colors.muted}
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          selectionColor={colors.accent}
          {...input}
          style={[styles.input, { color: colors.ink, textAlign: align, writingDirection: isRTL ? 'rtl' : 'ltr' }]}
        />
        {suffix ? (
          <Txt variant="small" muted>
            {suffix}
          </Txt>
        ) : null}
      </View>
      {error ? (
        <Txt variant="small" color={colors.danger}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useApp();
  return (
    <View style={[styles.segment, { backgroundColor: colors.sunk }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[styles.segmentItem, on && { backgroundColor: colors.surface }]}
          >
            <Txt variant="small" style={{ fontWeight: '700' }} color={on ? colors.ink : colors.muted} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.line },
      ]}
    >
      <Txt variant="small" style={{ fontWeight: '700' }} color={selected ? colors.accentInk : colors.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** − value + control for quantities. */
export function Stepper({ value, onChange, step = 0.5, min = 0.25 }: { value: string; onChange: (v: string) => void; step?: number; min?: number }) {
  const { colors, isRTL } = useApp();
  const n = parseFloat(value.replace(',', '.')) || 0;
  const set = (v: number) => onChange(String(Math.max(min, Math.round(v * 100) / 100)));
  return (
    <Row gap={12} style={{ justifyContent: 'center' }}>
      <IconButton icon="minus" label="decrease" onPress={() => set(n - step)} bg={colors.accentSoft} tint={colors.accent} size={46} />
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel="quantity"
        style={[styles.stepperInput, { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line, writingDirection: isRTL ? 'rtl' : 'ltr' }]}
      />
      <IconButton icon="plus" label="increase" onPress={() => set(n + step)} bg={colors.accentSoft} tint={colors.accent} size={46} />
    </Row>
  );
}

/** Tappable list row with a leading icon and trailing content. */
export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  danger,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, { borderColor: colors.line }, pressed && { backgroundColor: colors.sunk }]}
    >
      {icon ? <Icon name={icon} size={20} color={danger ? colors.danger : colors.muted} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" color={danger ? colors.danger : undefined} numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" muted numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Txt variant="label" muted style={{ marginTop: 8, textTransform: 'uppercase' }}>
      {children}
    </Txt>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <Txt muted center style={{ paddingVertical: 24, paddingHorizontal: 16 }}>
      {text}
    </Txt>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  card: { borderRadius: radius.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  cardShadow: { shadowColor: '#14281E', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  button: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, borderWidth: 1.5, paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontSize: 17, paddingVertical: 12, minWidth: 0 },
  segment: { flexDirection: 'row', borderRadius: radius.sm + 2, padding: 3, gap: 3 },
  segmentItem: { flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: radius.sm, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1 },
  stepperInput: { width: 96, textAlign: 'center', fontSize: 22, fontWeight: '800', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
