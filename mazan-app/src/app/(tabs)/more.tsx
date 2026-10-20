/** Settings: profile and goals, language, appearance, preferences and data. */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';

import { USDA_SIGNUP_URL } from '@/api/usda';
import { useToast } from '@/components/overlays';

import { Txt } from '@/components/Txt';
import { Button, Card, Field, Header, ListRow, Screen, SectionLabel, Segmented } from '@/components/ui';
import { fmtInt } from '@/domain/format';
import type { LangSetting, ThemeSetting } from '@/domain/types';
import { useApp } from '@/state/AppProvider';

export default function MoreScreen() {
  const db = useSQLiteContext();
  const app = useApp();
  const { t, colors } = app;
  const toast = useToast();
  const [usdaKey, setUsdaKey] = useState(app.prefs.usdaKey);
  const saveKey = () => {
    if (usdaKey.trim() !== app.prefs.usdaKey) app.setPrefs({ usdaKey: usdaKey.trim() });
  };

  const eraseAll = () =>
    Alert.alert(t('more.reset'), t('more.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => app.resetAll(),
      },
    ]);

  return (
    <Screen header={<Header title={t('more.title')} />}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow
          icon="user"
          title={t('more.profile')}
          subtitle={app.goals ? t('more.profileHint', { kcal: fmtInt(app.goals.kcal) }) : undefined}
          onPress={() => router.push('/profile')}
        />
      </Card>

      <SectionLabel>{t('more.language')}</SectionLabel>
      <Segmented<LangSetting>
        value={app.langSetting}
        onChange={app.setLang}
        options={[
          { value: 'system', label: t('more.langSystem') },
          { value: 'he', label: 'עברית' },
          { value: 'en', label: 'English' },
        ]}
      />

      <SectionLabel>{t('more.theme')}</SectionLabel>
      <Segmented<ThemeSetting>
        value={app.themeSetting}
        onChange={app.setTheme}
        options={[
          { value: 'system', label: t('more.themeSystem') },
          { value: 'light', label: t('more.themeLight') },
          { value: 'dark', label: t('more.themeDark') },
        ]}
      />

      <Card style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
        <ListRow
          title={t('more.netCarbs')}
          subtitle={t('more.netCarbsHint')}
          right={
            <Switch
              value={app.prefs.netCarbs}
              onValueChange={(v) => app.setPrefs({ netCarbs: v })}
              trackColor={{ true: colors.accent, false: colors.sunk }}
            />
          }
        />
      </Card>

      <SectionLabel>{t('more.online')}</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Txt variant="small" muted>
          {t('more.offInfo')}
        </Txt>
        <Field
          label={t('more.usdaKey')}
          value={usdaKey}
          onChangeText={setUsdaKey}
          onEndEditing={saveKey}
          onSubmitEditing={saveKey}
          placeholder="DEMO_KEY"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
        <Txt variant="small" muted>
          {t('more.usdaKeyHint')}
        </Txt>
        <Button title={t('more.usdaGetKey')} kind="ghost" icon="globe" onPress={() => Linking.openURL(USDA_SIGNUP_URL)} />
      </Card>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow
          icon="trash"
          title={t('more.clearCache')}
          onPress={async () => {
            await db.runAsync('DELETE FROM api_cache');
            toast(t('more.cacheCleared'));
          }}
        />
      </Card>

      <SectionLabel>{t('more.data')}</SectionLabel>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow icon="shield" title={t('more.privacy')} />
        <ListRow icon="trash" title={t('more.reset')} danger onPress={eraseAll} />
      </Card>

      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <Txt variant="small" muted>
          {t('appName')} · {t('more.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}
        </Txt>
      </View>
    </Screen>
  );
}
