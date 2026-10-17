import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Card, Heading, LinkRow, Segmented, Stat, StatGrid, styles as ui } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { permitsFor } from '@/lib/permits';
import type { PermitStatus } from '@/lib/state';
import { useBuild } from '@/store/build-store';

const STATUSES: [PermitStatus, string][] = [['todo', 'To do'], ['applied', 'Applied'], ['approved', 'Approved'], ['na', 'N/A']];

export default function Permits() {
  const { state, update } = useBuild();
  const theme = useTheme();
  const list = permitsFor(state.profile);
  const count = (k: PermitStatus) => list.filter((x) => (state.permits[x.id] ?? 'todo') === k).length;

  return (
    <Screen back>
      <Heading
        eyebrow="Permits"
        title="Your permit list"
        lede={`Built from your project details${state.profile.location ? ` for ${state.profile.location}` : ''}. Call your building department to confirm what your town requires. Some combine these; some add others.`}
      />
      <LinkRow title="Change project details" sub="Utilities, HOA, flood zone and more change this list" onPress={() => router.push('/project')} />
      <StatGrid>
        <Stat label="On your list" value={String(list.length)} />
        <Stat label="Approved" value={String(count('approved'))} />
        <Stat label="Applied, waiting" value={String(count('applied'))} />
        <Stat label="Not started" value={String(count('todo'))} alert={count('todo') > 0} />
      </StatGrid>
      {list.map((x) => (
        <Card key={x.id}>
          <View style={{ gap: 2 }}>
            <Text style={[ui.rowTitle, { color: theme.text }]}>{x.t}</Text>
            <Text style={[ui.small, { color: theme.muted }]}>{x.by} · {x.stage}</Text>
          </View>
          <Segmented
            label={`Status for ${x.t}`}
            options={STATUSES}
            value={state.permits[x.id] ?? 'todo'}
            tones={{ todo: 'plain', applied: 'warn', approved: 'ok', na: 'plain' }}
            onChange={(v) => update((prev) => ({ ...prev, permits: { ...prev.permits, [x.id]: v } }))}
          />
        </Card>
      ))}
      <Body muted>
        Questions to ask the permit counter: Which inspections do you require, in what order, and how do I schedule them? How long is plan review? What are the impact and tap fees? Does my permit expire if work stops?
      </Body>
    </Screen>
  );
}
