import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Banner, Heading, LinkRow } from '@/components/ui';
import { PHASES } from '@/data/content';
import { goToStep } from '@/hooks/use-step-toggle';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/format';
import { phaseStats, skippedSteps } from '@/lib/progress';
import { useBuild } from '@/store/build-store';
import { fonts } from '@/theme/theme';

export default function Roadmap() {
  const { state } = useBuild();
  const theme = useTheme();
  const sk = skippedSteps(state.done);

  return (
    <Screen>
      <Heading eyebrow="Roadmap" title="Every step, in build order" lede="Work down the list. Pink hold points are inspections that must pass before anything gets covered, poured or paid." />
      {sk.length > 0 && (
        <Banner actionLabel="Go to it" onAction={() => goToStep(sk[0].id)}>
          {plural(sk.length, 'step')} behind you still open. Builders who last don’t leave gaps.
        </Banner>
      )}
      <View style={{ gap: 8 }}>
        {PHASES.map((p, i) => {
          const s = phaseStats(p, state.done);
          return (
            <LinkRow
              key={p.id}
              title={`${String(i + 1).padStart(2, '0')}  ${p.name}`}
              sub={`${s.done} of ${s.total} steps · ${p.days}${s.gatesOpen ? ` · ${plural(s.gatesOpen, 'hold point')} open` : ''}`}
              onPress={() => router.push({ pathname: '/phase/[id]', params: { id: p.id } })}
              right={
                <View style={styles.pctWrap}>
                  <Text style={[styles.pct, { color: s.pct === 100 ? theme.ok : theme.muted }]}>{s.pct === 100 ? 'Done' : `${s.pct}%`}</Text>
                  <View style={[styles.bar, { backgroundColor: theme.surface2 }]}>
                    <View style={{ width: `${s.pct}%`, height: '100%', backgroundColor: theme.accent }} />
                  </View>
                </View>
              }
            />
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pctWrap: { width: 52, alignItems: 'flex-end', gap: 4 },
  pct: { fontFamily: fonts.mono, fontSize: 12 },
  bar: { width: 52, height: 3, borderRadius: 2, overflow: 'hidden' },
});
