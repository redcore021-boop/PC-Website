/** Progress tab. Stage 1 shows the current weight; stage 3 adds charts, measurements and photos. */
import { Txt } from '@/components/Txt';
import { Card, Header, Screen } from '@/components/ui';
import { fmt1 } from '@/domain/format';
import { useApp } from '@/state/AppProvider';

export default function ProgressScreen() {
  const { t, currentWeightKg, colors } = useApp();
  return (
    <Screen header={<Header title={t('progress.title')} />}>
      <Card style={{ alignItems: 'center', gap: 4, paddingVertical: 22 }}>
        <Txt variant="label" muted>
          {t('progress.weight')}
        </Txt>
        <Txt variant="display" color={colors.accent}>
          {fmt1(currentWeightKg)}
        </Txt>
        <Txt muted>{t('common.kg')}</Txt>
      </Card>
      <Txt muted center>
        {t('progress.soon')}
      </Txt>
    </Screen>
  );
}
