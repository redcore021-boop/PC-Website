/**
 * Six-step onboarding: language → sex/age → height/weight → activity → goal → result.
 * Reused in edit mode from More → Profile and goals.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Txt } from '@/components/Txt';
import { Button, Card, Chip, Field, Header, Row, Screen, Segmented } from '@/components/ui';
import { formatDayLong } from '@/domain/dates';
import { fmtInt, parseNum } from '@/domain/format';
import { calculatePlan, defaultGoals } from '@/domain/goals';
import type { ActivityLevel, GoalType, LangSetting, Profile, Sex } from '@/domain/types';
import type { StringKey } from '@/i18n/en';
import { useApp } from '@/state/AppProvider';
import { radius } from '@/theme/palette';

const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const LOSE_RATES = [0.25, 0.5, 0.75, 1];
const GAIN_RATES = [0.25, 0.5];
const STEPS = 6;

export function OnboardingFlow({ edit = false }: { edit?: boolean }) {
  const app = useApp();
  const { t, colors, lang, langSetting } = app;
  const p0 = app.profile;

  const [step, setStep] = useState(edit ? 1 : 0);
  const [sex, setSex] = useState<Sex>(p0?.sex ?? 'female');
  const [age, setAge] = useState(p0 ? String(p0.age) : '');
  const [height, setHeight] = useState(p0 ? String(p0.heightCm) : '');
  const [weight, setWeight] = useState(app.currentWeightKg ? String(app.currentWeightKg) : '');
  const [activity, setActivity] = useState<ActivityLevel>(p0?.activity ?? 'light');
  const [goal, setGoal] = useState<GoalType>(p0?.goal ?? 'lose');
  const [rate, setRate] = useState(p0?.rateKgPerWeek ?? 0.5);
  const [target, setTarget] = useState(p0?.targetWeightKg ? String(p0.targetWeightKg) : '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const nAge = parseNum(age);
  const nHeight = parseNum(height);
  const nWeight = parseNum(weight);
  const nTarget = parseNum(target);
  const ageOk = nAge != null && nAge >= 13 && nAge <= 100;
  const heightOk = nHeight != null && nHeight >= 120 && nHeight <= 230;
  const weightOk = nWeight != null && nWeight >= 30 && nWeight <= 300;

  const profile: Profile | null = useMemo(
    () =>
      ageOk && heightOk && weightOk
        ? {
            sex,
            age: Math.round(nAge!),
            heightCm: nHeight!,
            weightKg: Math.round(nWeight! * 10) / 10,
            activity,
            goal,
            rateKgPerWeek: goal === 'maintain' ? 0 : rate,
            targetWeightKg: goal !== 'maintain' && nTarget ? nTarget : undefined,
          }
        : null,
    [ageOk, heightOk, weightOk, sex, nAge, nHeight, nWeight, activity, goal, rate, nTarget],
  );
  const plan = profile ? calculatePlan(profile) : null;

  const stepValid = [true, ageOk, heightOk && weightOk, true, true, !!plan][step];

  const next = () => {
    if (!stepValid) {
      setTouched(true);
      return;
    }
    setTouched(false);
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };
  const back = () => (step === (edit ? 1 : 0) ? router.back() : setStep((s) => s - 1));

  const finish = async () => {
    if (!profile || !plan) return;
    setSaving(true);
    // Keep the user's macro split and water goal when editing; only the calorie target follows the plan.
    const goals = app.goals ? { ...app.goals, kcal: plan.target, autoKcal: true } : defaultGoals(plan.target);
    await app.saveProfile(profile, goals);
    setSaving(false);
    if (edit) router.back();
    // On first run the layout's guard switches to the tabs automatically.
  };

  const eta = (() => {
    if (!profile || !nTarget || goal === 'maintain' || !rate) return null;
    const diff = goal === 'lose' ? profile.weightKg - nTarget : nTarget - profile.weightKg;
    if (diff <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + Math.round((diff / rate) * 7));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return t('ob.eta', { kg: nTarget, date: formatDayLong(key, lang) });
  })();

  const err = (ok: boolean) => (touched && !ok ? t('ob.invalid') : undefined);

  const footer = (
    <Row>
      {step > (edit ? 1 : 0) || edit ? <Button title={t('common.back')} kind="secondary" onPress={back} style={{ flex: 1 }} /> : null}
      {step < STEPS - 1 ? (
        <Button title={step === 0 ? t('ob.start') : t('common.next')} onPress={next} style={{ flex: 2 }} />
      ) : (
        <Button title={edit ? t('ob.saveChanges') : t('ob.finish')} onPress={finish} loading={saving} style={{ flex: 2 }} />
      )}
    </Row>
  );

  return (
    <Screen
      header={edit ? <Header title={t('more.profile')} back /> : undefined}
      footer={footer}
      contentStyle={{ gap: 18, paddingTop: edit ? 8 : 24 }}
    >
      {/* progress dots */}
      <Row gap={6} style={{ justifyContent: 'center' }}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={{ height: 6, width: i === step ? 22 : 6, borderRadius: 3, backgroundColor: i <= step ? colors.accent : colors.line }} />
        ))}
      </Row>

      {step === 0 && (
        <View style={{ gap: 18 }}>
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 12, borderColor: colors.accent, borderTopColor: colors.accentSoft }} />
          </View>
          <Txt variant="title">{t('ob.welcomeTitle')}</Txt>
          <Txt muted>{t('ob.welcomeBody')}</Txt>
          <Txt variant="label" muted>
            {t('ob.language')}
          </Txt>
          <Segmented<LangSetting>
            value={langSetting}
            onChange={app.setLang}
            options={[
              { value: 'system', label: t('more.langSystem') },
              { value: 'he', label: 'עברית' },
              { value: 'en', label: 'English' },
            ]}
          />
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: 18 }}>
          <Txt variant="title">{t('ob.aboutYou')}</Txt>
          <Txt variant="label" muted>
            {t('ob.sex')}
          </Txt>
          <Segmented<Sex>
            value={sex}
            onChange={setSex}
            options={[
              { value: 'female', label: t('ob.female') },
              { value: 'male', label: t('ob.male') },
            ]}
          />
          <Field label={t('ob.age')} value={age} onChangeText={setAge} numeric keyboardType="number-pad" suffix={t('ob.years')} error={err(ageOk)} />
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 18 }}>
          <Txt variant="title">{t('ob.body')}</Txt>
          <Field label={t('ob.height')} value={height} onChangeText={setHeight} numeric suffix={t('common.cm')} error={err(heightOk)} />
          <Field label={t('ob.weight')} value={weight} onChangeText={setWeight} numeric suffix={t('common.kg')} error={err(weightOk)} />
        </View>
      )}

      {step === 3 && (
        <View style={{ gap: 10 }}>
          <Txt variant="title">{t('ob.activity')}</Txt>
          {ACTIVITIES.map((a) => {
            const on = a === activity;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setActivity(a)}
                style={{
                  padding: 14,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: on ? colors.accent : colors.line,
                  backgroundColor: on ? colors.accentSoft : colors.surface,
                  gap: 2,
                }}
              >
                <Txt variant="bodyStrong">{t(`ob.act.${a}` as StringKey)}</Txt>
                <Txt variant="small" muted>
                  {t(`ob.act.${a}Hint` as StringKey)}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}

      {step === 4 && (
        <View style={{ gap: 18 }}>
          <Txt variant="title">{t('ob.goal')}</Txt>
          <Segmented<GoalType>
            value={goal}
            onChange={(g) => {
              setGoal(g);
              if (g === 'gain' && rate > 0.5) setRate(0.5);
            }}
            options={[
              { value: 'lose', label: t('ob.goal.lose') },
              { value: 'maintain', label: t('ob.goal.maintain') },
              { value: 'gain', label: t('ob.goal.gain') },
            ]}
          />
          {goal !== 'maintain' && (
            <>
              <Txt variant="label" muted>
                {t('ob.rate')}
              </Txt>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {(goal === 'lose' ? LOSE_RATES : GAIN_RATES).map((r) => (
                  <Chip key={r} label={t('ob.ratePerWeek', { n: r })} selected={r === rate} onPress={() => setRate(r)} />
                ))}
              </Row>
              <Field
                label={`${t('ob.targetWeight')} (${t('common.optional')})`}
                value={target}
                onChangeText={setTarget}
                numeric
                suffix={t('common.kg')}
              />
            </>
          )}
        </View>
      )}

      {step === 5 && plan && (
        <View style={{ gap: 14 }}>
          <Txt variant="title">{t('ob.resultTitle')}</Txt>
          <Card style={{ alignItems: 'center', gap: 4, paddingVertical: 22 }}>
            <Txt variant="label" muted>
              {t('ob.target')}
            </Txt>
            <Txt variant="display" color={colors.accent}>
              {fmtInt(plan.target)}
            </Txt>
            <Txt muted>{t('common.kcal')}</Txt>
          </Card>
          <Card style={{ gap: 10 }}>
            <ResultRow label={t('ob.bmr')} value={fmtInt(plan.bmr)} />
            <ResultRow label={t('ob.tdee')} value={fmtInt(plan.tdee)} />
            <ResultRow label={t('ob.adjust')} value={`${plan.adjustment > 0 ? '+' : ''}${fmtInt(plan.adjustment)}`} />
          </Card>
          {plan.floored && <Txt variant="small" color={colors.danger}>{t('ob.floored', { n: fmtInt(plan.target) })}</Txt>}
          {eta && <Txt variant="small" muted>{eta}</Txt>}
          <Txt variant="small" muted>
            {t('ob.macroNote')}
          </Txt>
        </View>
      )}
    </Screen>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt muted style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <Txt variant="num">{value}</Txt>
    </Row>
  );
}
