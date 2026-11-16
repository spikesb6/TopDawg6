import { router } from 'expo-router';
import { View } from 'react-native';

import { DimLine } from '@/components/dim-line';
import { Screen } from '@/components/screen';
import { Banner, Body, Button, Card, H3, Heading, LinkRow, Pill, Stat, StatGrid } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { PHASES } from '@/data/content';
import { goToStep } from '@/hooks/use-step-toggle';
import { budgetCalc } from '@/lib/budget';
import { money, plural } from '@/lib/format';
import { paymentSummary } from '@/lib/payments';
import { currentPhase, openHoldPoints, overall, phaseStats, skippedSteps } from '@/lib/progress';
import { useBuild } from '@/store/build-store';

export default function Home() {
  const { state } = useBuild();
  const cur = currentPhase(state.done);
  const cs = phaseStats(cur, state.done);
  const sk = skippedSteps(state.done);
  const all = overall(state.done);
  const pay = paymentSummary(state.payments, state.retainPct);
  const next = cur.steps.filter((s) => !state.done[s.id]).slice(0, 3);

  return (
    <Screen>
      <Wordmark />
      <Body muted>From empty lot to keys in hand. Every step in order, every inspection on the calendar, every payment backed by paper.</Body>
      <DimLine pct={all.pct} done={all.done} total={all.total} />

      <Heading eyebrow="My build" title={state.profile.name || 'Your home, start to finish'} />

      <StatGrid>
        <Stat label="You are in" value={`${PHASES.indexOf(cur) + 1} / ${PHASES.length}`} sub={`${cur.name} · ${cs.done} of ${cs.total}`} />
        <Stat label="Skipped steps" value={String(sk.length)} sub={sk.length ? 'Open steps behind you' : 'Nothing left behind'} alert={sk.length > 0} />
        <Stat label="Hold points left" value={String(openHoldPoints(state.done))} sub="Inspections before covering work" />
        <Stat label="All-in budget" value={money(budgetCalc(state.budget).total)} sub={`${money(pay.total)} paid${pay.hasExamples ? ' (examples)' : ''}`} />
      </StatGrid>

      {sk.length > 0 && (
        <Banner actionLabel="Go to it" onAction={() => goToStep(sk[0].id)}>
          No step gets skipped. {plural(sk.length, 'earlier step')} still open, starting with “{sk[0].t}”.
        </Banner>
      )}

      <Card>
        <H3>Up next: {cur.name}</H3>
        {next.length ? (
          next.map((s) => (
            <LinkRow key={s.id} title={s.t} onPress={() => goToStep(s.id)} right={s.gate ? <Pill tone="flag">Hold</Pill> : undefined} />
          ))
        ) : (
          <Body>Every step is done. Enjoy the house.</Body>
        )}
        <Button kind="primary" label="Open this phase" onPress={() => router.push({ pathname: '/phase/[id]', params: { id: cur.id } })} />
      </Card>

      <View style={{ gap: 10 }}>
        <LinkRow
          title="About your project"
          sub={state.profile.location || 'Location, size, foundation, utilities. Shapes your permits and budget.'}
          onPress={() => router.push('/project')}
        />
        <LinkRow title="Permits" sub="Your list, built from your project details" onPress={() => router.push('/permits')} />
      </View>
    </Screen>
  );
}
