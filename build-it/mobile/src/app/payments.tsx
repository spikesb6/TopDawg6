import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Banner, Body, Bullets, Button, Card, Checkbox, H3, Heading, Pill, Segmented, Stat, StatGrid, Strong, styles as ui } from '@/components/ui';
import { PAY_RULES, PHASES } from '@/data/content';
import { useTheme } from '@/hooks/use-theme';
import { budgetCalc } from '@/lib/budget';
import { money } from '@/lib/format';
import { paymentSummary, sortByDate } from '@/lib/payments';
import type { Payment, Waiver } from '@/lib/state';
import { useBuild } from '@/store/build-store';
import { useToast } from '@/store/toast-store';
import { fonts } from '@/theme/theme';

const WAIVERS: [Waiver, string][] = [['none', 'None yet'], ['conditional', 'Conditional'], ['unconditional', 'Unconditional']];

export default function Payments() {
  const { state, update } = useBuild();
  const theme = useTheme();
  const toast = useToast();
  const s = paymentSummary(state.payments, state.retainPct);
  const all = budgetCalc(state.budget).total;

  const edit = (id: string, change: Partial<Payment>) =>
    update((prev) => ({ ...prev, payments: prev.payments.map((p) => (p.id === id ? { ...p, ...change } : p)) }));

  return (
    <Screen back>
      <Heading eyebrow="Paying people" title="Pay for work done, with paper for every dollar" lede="Most money lost in home building is lost by paying ahead of the work or paying without lien waivers. Log every payment here." />
      <StatGrid>
        <Stat label="Paid so far" value={money(s.total)} sub={`${((s.total / all) * 100).toFixed(1)}% of all-in budget`} />
        <Stat label="Waivers outstanding" value={String(s.missingWaivers)} sub="No unconditional lien waiver yet" alert={s.missingWaivers > 0} />
        <Stat label="Paid before inspection" value={String(s.notInspected)} sub="Work paid but not verified" alert={s.notInspected > 0} />
        <Stat label="Retainage to hold" value={money(s.retainage)} sub={`At ${state.retainPct}% of payments`} />
      </StatGrid>

      {s.hasExamples && (
        <Banner
          tone="plain"
          actionLabel="Clear examples"
          onAction={() => {
            update((prev) => ({ ...prev, payments: prev.payments.filter((p) => !p.example) }));
            toast('Examples cleared');
          }}>
          The entries marked Example show how the log works. They are not your payments.
        </Banner>
      )}

      <Button kind="primary" label="Log a payment" onPress={() => router.push('/payment-new')} />

      {state.payments.length === 0 && <Body muted>No payments yet. Log your first one when it happens.</Body>}
      {sortByDate(state.payments).map((p) => (
        <Card key={p.id}>
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.payee, { color: theme.text }]}>{p.payee}</Text>
              <Text style={[ui.small, { color: theme.muted }]}>
                {p.date} · {PHASES.find((x) => x.id === p.phase)?.name ?? ''}
              </Text>
            </View>
            <Text style={[ui.mono, { color: theme.text }]}>{money(p.amount)}</Text>
          </View>
          <View style={styles.tags}>
            {p.example && <Pill>Example</Pill>}
            {p.waiver === 'none' && <Pill tone="bad">Get lien waiver</Pill>}
            {p.waiver === 'conditional' && <Pill tone="warn">Get unconditional waiver</Pill>}
            {!p.inspected && <Pill tone="bad">Not inspected</Pill>}
          </View>
          <Segmented label={`Lien waiver for ${p.payee}`} options={WAIVERS} value={p.waiver} tones={{ none: 'bad', conditional: 'warn', unconditional: 'ok' }} onChange={(waiver) => edit(p.id, { waiver })} />
          <Checkbox label="Work inspected and verified" checked={p.inspected} onToggle={() => edit(p.id, { inspected: !p.inspected })} />
          <Button
            small
            kind="danger"
            label="Delete"
            accessibilityLabel={`Delete payment to ${p.payee}`}
            onPress={() => update((prev) => ({ ...prev, payments: prev.payments.filter((x) => x.id !== p.id) }))}
          />
        </Card>
      ))}

      <Card>
        <H3>The golden rules of paying contractors</H3>
        {PAY_RULES.map(([t, d], i) => (
          <View key={t} style={styles.rule}>
            <Text style={[styles.ruleNum, { color: theme.accent }]}>{i + 1}</Text>
            <Text style={[ui.body, { color: theme.text, flex: 1 }]}>
              <Strong>{t}. </Strong>
              <Text style={{ color: theme.muted }}>{d}</Text>
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <H3>Lien waivers, in plain words</H3>
        <Body>
          If a contractor, sub or supplier is not paid, most states let them put a <Strong>mechanic’s lien</Strong> on your property, even if you already paid the GC. A lien waiver is their signed statement that they give up that right for a payment.
        </Body>
        <Bullets
          items={[
            <><Strong>Conditional waiver: </Strong>“I waive my lien rights once this payment clears.” Get it before you pay.</>,
            <><Strong>Unconditional waiver: </Strong>“I have been paid.” Get it after the money clears.</>,
            <><Strong>From everyone: </Strong>the GC, each subcontractor and each major supplier (lumber, concrete, windows).</>,
            <><Strong>Final waivers: </Strong>unconditional finals from all of them before the last payment and retainage.</>,
          ]}
        />
        <Body muted>Some states use required statutory forms. Ask your title company or attorney which forms apply where you build.</Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  payee: { fontFamily: fonts.bodySemi, fontSize: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rule: { flexDirection: 'row', gap: 10 },
  ruleNum: { fontFamily: fonts.display, fontSize: 20, width: 22 },
});
