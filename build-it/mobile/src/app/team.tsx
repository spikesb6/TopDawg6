import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Bullets, Card, Checkbox, H3, Heading, MoneyRow, Strong, styles as ui } from '@/components/ui';
import { CONTRACT, RED_FLAGS, VETTING } from '@/data/content';
import { useTheme } from '@/hooks/use-theme';
import { useBuild } from '@/store/build-store';

const COMPARE: [string, string, string][] = [
  ['Cost', 'GC fee, often 10–20%', 'Saves the fee, mistakes cost more'],
  ['Your time', 'Weekly meetings and decisions', 'Close to a full-time job'],
  ['Financing', 'Most lenders say yes', 'Many lenders say no'],
  ['Liability', 'GC carries insurance and code responsibility', 'You do, including injured workers'],
  ['Scheduling subs', 'GC’s relationships', 'You compete for their time'],
  ['Best for', 'First-time builders', 'People with real trade or project experience'],
];

const QUESTIONS = [
  'How many homes do you build at once, and who is on my site every day?',
  'Which trades are your own crews, and which are subs?',
  'How do you handle change orders and price increases?',
  'Will you do a blower door test, and what result do you guarantee?',
  'Can my inspector visit before the pour, before drywall and at the end?',
  'What does your warranty cover, and how fast do you respond?',
];

export default function Team() {
  const { state, update } = useBuild();
  const theme = useTheme();
  const owner = state.profile.route === 'owner';

  return (
    <Screen back>
      <Heading eyebrow="Your team" title="Hire people who build to last" lede="You are hiring the people whose work you will live inside for decades. Vet every one of them the same way." />

      <Card>
        <H3>General contractor or owner-builder?</H3>
        {COMPARE.map(([k, gc, ob]) => (
          <View key={k} style={{ gap: 2, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: 8 }}>
            <Text style={[ui.label, { color: theme.muted }]}>{k}</Text>
            <Text style={[ui.body, { color: theme.text }]}><Strong>GC: </Strong>{gc}</Text>
            <Text style={[ui.body, { color: theme.text }]}><Strong>Owner-builder: </Strong>{ob}</Text>
          </View>
        ))}
        <Body muted>
          {owner
            ? 'You picked owner-builder. Hire a construction consultant or experienced builder to review your schedule and walk the site at every hold point.'
            : 'A middle path: hire a GC and also your own independent inspector who works only for you.'}
        </Body>
      </Card>

      <Card>
        <H3>Vetting checklist</H3>
        <Body muted>Use it for your GC and every major sub.</Body>
        {VETTING.map((v, i) => (
          <Checkbox key={v} label={v} checked={!!state.vet[i]} onToggle={() => update((prev) => ({ ...prev, vet: { ...prev.vet, [i]: !prev.vet[i] } }))} />
        ))}
      </Card>

      <Card>
        <H3>What your contract must say</H3>
        <View>
          {CONTRACT.map(([k, v]) => <MoneyRow key={k} label={k} sub={v} value="" bold />)}
        </View>
      </Card>

      <Card>
        <H3>Red flags: walk away</H3>
        <Bullets items={RED_FLAGS} />
      </Card>

      <Card>
        <H3>Questions to ask every builder</H3>
        <Bullets items={QUESTIONS} />
      </Card>
    </Screen>
  );
}
