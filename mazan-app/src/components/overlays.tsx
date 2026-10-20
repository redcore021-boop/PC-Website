/** Toast messages and a bottom action menu, both direction-aware. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/state/AppProvider';
import { radius } from '@/theme/palette';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useApp();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  // Kept in state (created once) rather than a ref, so it can be read during render.
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
      }, 1900);
    },
    [anim],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg != null && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 90,
              backgroundColor: colors.ink,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          <Txt variant="bodyStrong" color={colors.bg} center>
            {msg}
          </Txt>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export interface MenuItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onPress: () => void;
}

/** Bottom sheet with a list of actions. */
export function ActionMenu({ visible, title, items, onClose }: { visible: boolean; title?: string; items: MenuItem[]; onClose: () => void }) {
  const { colors, isRTL, t } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + 12, direction: isRTL ? 'rtl' : 'ltr' },
        ]}
      >
        {title ? (
          <Txt variant="label" muted style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            {title}
          </Txt>
        ) : null}
        {items.map((it) => (
          <Pressable
            key={it.label}
            onPress={() => {
              onClose();
              it.onPress();
            }}
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.sunk }]}
          >
            {it.icon ? <Icon name={it.icon} size={20} color={it.danger ? colors.danger : colors.ink} /> : null}
            <Txt variant="bodyStrong" color={it.danger ? colors.danger : colors.ink}>
              {it.label}
            </Txt>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={({ pressed }) => [styles.item, { justifyContent: 'center' }, pressed && { backgroundColor: colors.sunk }]}>
          <Txt variant="bodyStrong" muted>
            {t('common.cancel')}
          </Txt>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', start: 24, end: 24, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md },
  sheet: { position: 'absolute', start: 0, end: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15 },
});
