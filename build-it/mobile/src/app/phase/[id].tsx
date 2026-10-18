import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { StepCard } from '@/components/step-card';
import { Body, Button, Heading, Pill } from '@/components/ui';
import { PHASES } from '@/data/content';
import { useStepToggle } from '@/hooks/use-step-toggle';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/format';
import { photoCounts } from '@/lib/photos';
import { phaseStats } from '@/lib/progress';
import { useBuild } from '@/store/build-store';
import { fonts, radius } from '@/theme/theme';

export default function PhaseScreen() {
  const { id, step } = useLocalSearchParams<{ id: string; step?: string }>();
  const { state, update } = useBuild();
  const theme = useTheme();
  const [open, setOpen] = useState<string | null>(step ?? null);
  const toggle = useStepToggle(setOpen);

  const idx = Math.max(PHASES.findIndex((p) => p.id === id), 0);
  const p = PHASES[idx];
  const st = phaseStats(p, state.done);
  const photos = photoCounts(state.photos);
  const prev = PHASES[idx - 1];
  const next = PHASES[idx + 1];

  return (
    <Screen back>
      <Heading eyebrow={`Phase ${idx + 1} of ${PHASES.length}`} title={p.name} lede={p.blurb} />
      <View style={styles.row}>
        <Pill tone="info">{`${st.done} / ${st.total} done`}</Pill>
        <Pill>{`Typical time: ${p.days}`}</Pill>
        {st.gates > 0 && (
          <Pill tone={st.gatesOpen ? 'flag' : 'ok'}>{st.gatesOpen ? `${plural(st.gatesOpen, 'hold point')} open` : 'All hold points passed'}</Pill>
        )}
      </View>
      <View style={styles.row} accessibilityLabel={`Who you need: ${p.who.join(', ')}`}>
        {p.who.map((w) => (
          <Text key={w} style={[styles.who, { color: theme.muted, borderColor: theme.line }]}>{w}</Text>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        {p.steps.map((s) => (
          <StepCard
            key={s.id}
            step={s}
            done={!!state.done[s.id]}
            note={state.notes[s.id] ?? ''}
            photoCount={photos[s.id] ?? 0}
            open={open === s.id}
            onToggleDone={() => toggle(s.id)}
            onToggleOpen={() => setOpen(open === s.id ? null : s.id)}
            onNote={(text) =>
              update((prevState) => {
                const notes = { ...prevState.notes };
                if (text) notes[s.id] = text;
                else delete notes[s.id];
                return { ...prevState, notes };
              })
            }
          />
        ))}
      </View>

      {st.pct === 100 && <Body muted>Every step in this phase is checked off.</Body>}
      <View style={styles.nav}>
        {prev ? <Button small label={`← ${prev.name}`} onPress={() => router.replace({ pathname: '/phase/[id]', params: { id: prev.id } })} /> : <View />}
        {next && <Button small kind={st.pct === 100 ? 'primary' : 'default'} label={`${next.name} →`} onPress={() => router.replace({ pathname: '/phase/[id]', params: { id: next.id } })} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  who: { fontFamily: fonts.body, fontSize: 13, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
});
