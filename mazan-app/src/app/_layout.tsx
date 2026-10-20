/**
 * Root layout: opens the database (running migrations), loads app state, applies theme and
 * text direction, and shows onboarding until a profile exists.
 */
import { DarkTheme, DefaultTheme, LocaleProvider, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
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
