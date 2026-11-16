import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Card, H3, Heading, Pill, Segmented, styles as ui } from '@/components/ui';
import { LOT_GROUPS } from '@/data/content';
import { useTheme } from '@/hooks/use-theme';
import { lotCounts, lotVerdict } from '@/lib/land';
import type { LotValue } from '@/lib/state';
import { useBuild } from '@/store/build-store';
import { radius, toneColors } from '@/theme/theme';

const OPTIONS: [LotValue, string][] = [['unknown', '?'], ['ok', 'OK'], ['concern', 'Concern'], ['nogo', 'No-go']];

export default function Land() {
  const { state, update } = useBuild();
  const theme = useTheme();
  const v = lotVerdict(state.lot);
  const c = lotCounts(state.lot);
  const tone = toneColors(theme, v.tone);

  return (
    <Screen>
      <Heading eyebrow="Land check" title="Should you buy this lot?" lede="Work through every check during your due diligence period, before you close. Mark each one as you get an answer in writing." />
      <View style={[styles.verdict, { backgroundColor: tone.bg }]}>
        <H3>{v.title}</H3>
        <Body>{v.body}</Body>
        <View style={styles.pills}>
          <Pill tone="ok">{`${c.ok} OK`}</Pill>
          <Pill tone="warn">{`${c.concern} concern`}</Pill>
          <Pill tone="bad">{`${c.nogo} deal-breaker`}</Pill>
          <Pill>{`${c.unknown} unknown`}</Pill>
        </View>
      </View>
      {LOT_GROUPS.map((g) => (
        <Card key={g.name}>
          <H3>{g.name}</H3>
          {g.items.map((item) => (
            <View key={item.id} style={[styles.item, { borderTopColor: theme.line }]}>
              <Text style={[ui.body, { color: theme.text }]}>{item.t}</Text>
              <Text style={[ui.small, { color: theme.muted }]}>{item.how}</Text>
              <Segmented
                label={item.t}
                options={OPTIONS}
                value={state.lot[item.id] ?? 'unknown'}
                tones={{ ok: 'ok', concern: 'warn', nogo: 'bad', unknown: 'plain' }}
                onChange={(val) => update((prev) => ({ ...prev, lot: { ...prev.lot, [item.id]: val } }))}
              />
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  verdict: { borderRadius: radius.card, padding: 16, gap: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: { borderTopWidth: 1, paddingTop: 12, gap: 6 },
});
