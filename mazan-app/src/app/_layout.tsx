/**
 * Root layout: opens the database (running migrations), loads app state, applies theme and
 * text direction, and shows onboarding until a profile exists.
 *
 * Mazan targets Expo SDK 57 to match the Expo Go build on the App Store.
 * Layout direction comes from the `direction` style on the root view (see components/Txt.tsx);
 * LocaleProvider tells the navigators (gestures, transitions) about it.
 */
import { DarkTheme, DefaultTheme, LocaleProvider, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { ToastProvider } from '@/components/overlays';
import { migrate } from '@/db/migrations';
import { AppProvider, useApp } from '@/state/AppProvider';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="mazan.db" onInit={migrate}>
      <AppProvider>
        <Root />
      </AppProvider>
    </SQLiteProvider>
  );
}

function Root() {
  const { ready, profile, isRTL, scheme, colors } = useApp();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.surface, primary: colors.accent, text: colors.ink, border: colors.line },
  };

  return (
    <LocaleProvider direction={isRTL ? 'rtl' : 'ltr'}>
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, backgroundColor: colors.bg, direction: isRTL ? 'rtl' : 'ltr' }}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Protected guard={!!profile}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="add" />
                <Stack.Screen name="food/[id]" />
                <Stack.Screen name="entry/[id]" />
                <Stack.Screen name="quick-add" />
                <Stack.Screen name="custom-food" />
                <Stack.Screen name="profile" />
              </Stack.Protected>
              <Stack.Protected guard={!profile}>
                <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              </Stack.Protected>
            </Stack>
          </ToastProvider>
        </View>
      </ThemeProvider>
    </LocaleProvider>
  );
}
