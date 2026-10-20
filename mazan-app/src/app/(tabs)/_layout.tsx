/** Bottom tabs with a raised centre button that opens the food logger. */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { mealForNow, today } from '@/domain/dates';
import { useApp } from '@/state/AppProvider';

export default function TabsLayout() {
  const { colors, t } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }} />
      <Tabs.Screen name="diary" options={{ title: t('tab.diary'), tabBarIcon: ({ color }) => <Icon name="diary" color={color} /> }} />
      <Tabs.Screen
        name="log"
        options={{
          title: t('tab.log'),
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.logFood')}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push({ pathname: '/add', params: { date: today(), meal: mealForNow() } });
                }}
                style={({ pressed }) => ({
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  marginTop: -18,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: colors.accent,
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                })}
              >
                <Icon name="plus" color={colors.accentInk} size={28} strokeWidth={2.6} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="progress" options={{ title: t('tab.progress'), tabBarIcon: ({ color }) => <Icon name="chart" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: t('tab.more'), tabBarIcon: ({ color }) => <Icon name="more" color={color} /> }} />
    </Tabs>
  );
}
