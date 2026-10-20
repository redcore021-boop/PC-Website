/**
 * Barcode scanner. A recognised product opens its food screen ready to log; an unknown one offers to
 * enter it from the label, with the barcode filled in so the next scan finds it on this phone.
 */
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lookupBarcode, type BarcodeResult } from '@/api/foodService';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Field, Header, IconButton, Row, Screen } from '@/components/ui';
import { today } from '@/domain/dates';
import { useApp } from '@/state/AppProvider';
import { radius } from '@/theme/palette';

type Problem = Exclude<BarcodeResult, { kind: 'found' }>;

const RETAIL_CODES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function ScanScreen() {
  const db = useSQLiteContext();
  const { t, colors, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = params.date ?? today();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState('');
  // The camera reports the same code many times a second; handle only the first.
  const handling = useRef(false);

  const handle = async (raw: string) => {
    const code = raw.replace(/\D/g, '');
    if (handling.current || code.length < 6) return;
    handling.current = true;
    setBusy(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const res = await lookupBarcode(db, code);
    setBusy(null);
    if (res.kind === 'found') {
      router.replace({ pathname: '/food/[id]', params: { id: String(res.foodId), date, meal: params.meal ?? '' } });
      return;
    }
    setProblem(res);
  };

  const scanAgain = () => {
    setProblem(null);
    setTyped('');
    handling.current = false;
  };

  const enterFromLabel = (p: Problem) =>
    router.replace({
      pathname: '/custom-food',
      params: { barcode: p.code, name: p.kind === 'incomplete' ? p.name : '', brand: p.kind === 'incomplete' ? (p.brand ?? '') : '', date, meal: params.meal ?? '' },
    });

  // Permission not decided yet.
  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  if (!permission.granted) {
    return (
      <Screen header={<Header title={t('scan.title')} back />}>
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 14 }}>
          <Icon name="barcode" size={56} color={colors.accent} />
          <Txt variant="h2" center>
            {t('scan.permissionTitle')}
          </Txt>
          <Txt muted center>
            {t('scan.permissionBody')}
          </Txt>
        </View>
        {permission.canAskAgain ? (
          <Button title={t('scan.allow')} onPress={requestPermission} />
        ) : (
          <Button title={t('scan.openSettings')} onPress={() => Linking.openSettings()} />
        )}
        <Button title={t('scan.manual')} kind="ghost" onPress={() => setManual(true)} />
        {manual && <ManualEntry value={typed} onChange={setTyped} onSubmit={() => handle(typed)} />}
        {problem && <ProblemCard problem={problem} onAgain={scanAgain} onCreate={() => enterFromLabel(problem)} />}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000', direction: isRTL ? 'rtl' : 'ltr' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...RETAIL_CODES] }}
        onBarcodeScanned={busy || problem ? undefined : (r: BarcodeScanningResult) => handle(r.data)}
      />

      {/* top bar */}
      <Row style={{ position: 'absolute', top: insets.top + 8, start: 16, end: 16, justifyContent: 'space-between' }}>
        <IconButton icon="close" label={t('common.close')} onPress={() => router.back()} bg="rgba(0,0,0,0.5)" tint="#fff" size={44} />
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          onPress={() => setTorch((v) => !v)}
          style={[styles.pill, { backgroundColor: torch ? '#fff' : 'rgba(0,0,0,0.5)' }]}
        >
          <Icon name="bolt" size={18} color={torch ? '#000' : '#fff'} />
          <Txt variant="bodyStrong" color={torch ? '#000' : '#fff'}>
            {t('scan.torch')}
          </Txt>
        </Pressable>
      </Row>

      {/* aiming frame */}
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={[styles.frame, { borderColor: busy ? colors.accent : '#fff' }]} />
        <Txt variant="bodyStrong" color="#fff" center style={styles.shadowText}>
          {busy ? t('scan.looking', { code: busy }) : t('scan.hint')}
        </Txt>
        {busy && <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />}
      </View>

      {/* bottom panel: problems, manual entry */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', start: 0, end: 0, bottom: 0 }}
      >
        <View style={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 10 }}>
          {problem ? (
            <ProblemCard problem={problem} onAgain={scanAgain} onCreate={() => enterFromLabel(problem)} />
          ) : manual ? (
            <View style={[styles.panel, { backgroundColor: colors.surface }]}>
              <ManualEntry value={typed} onChange={setTyped} onSubmit={() => handle(typed)} />
            </View>
          ) : (
            <Button title={t('scan.manual')} kind="secondary" onPress={() => setManual(true)} />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ManualEntry({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const { t } = useApp();
  return (
    <Row gap={8} style={{ alignItems: 'flex-end' }}>
      <Field
        style={{ flex: 1 }}
        label={t('scan.manual')}
        value={value}
        onChangeText={onChange}
        placeholder={t('scan.manualPlaceholder')}
        keyboardType="number-pad"
        autoFocus
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      <Button title={t('scan.lookup')} onPress={onSubmit} disabled={value.replace(/\D/g, '').length < 6} />
    </Row>
  );
}

function ProblemCard({ problem, onAgain, onCreate }: { problem: Problem; onAgain: () => void; onCreate: () => void }) {
  const { t, colors } = useApp();
  const text =
    problem.kind === 'missing'
      ? { title: t('scan.missingTitle'), body: t('scan.missingBody', { code: problem.code }) }
      : problem.kind === 'incomplete'
        ? { title: t('scan.incompleteTitle'), body: t('scan.incompleteBody', { name: problem.name }) }
        : problem.error === 'offline' || problem.error === 'timeout'
          ? { title: t('scan.offlineTitle'), body: t('scan.offlineBody') }
          : { title: t('scan.errorTitle'), body: t('scan.errorBody') };
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, gap: 10 }]}>
      <Txt variant="h2">{text.title}</Txt>
      <Txt muted>{text.body}</Txt>
      <Row>
        <Button title={t('scan.again')} kind="secondary" onPress={onAgain} style={{ flex: 1 }} />
        <Button title={t('scan.create')} onPress={onCreate} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 44, borderRadius: 22 },
  frameWrap: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', gap: 14 },
  frame: { width: '78%', aspectRatio: 1.6, borderWidth: 3, borderRadius: radius.lg },
  shadowText: { textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6, paddingHorizontal: 24 },
  panel: { borderRadius: radius.lg, padding: 16 },
});
