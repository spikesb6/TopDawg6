import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Card, Field, H3, Heading, Label, LinkRow, MoneyRow, Pill, styles as ui } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { budgetCalc, budgetParts, costSplit, drawSchedule } from '@/lib/budget';
import { money, plural, toNumber } from '@/lib/format';
import { paymentSummary } from '@/lib/payments';
import type { Budget } from '@/lib/state';
import { useBuild } from '@/store/build-store';
import { fonts, type ThemeColors } from '@/theme/theme';

const FIELDS: [keyof Budget, string][] = [
  ['land', 'Land price ($)'],
  ['sqft', 'Heated square feet'],
  ['cpsf', 'Build cost per sq ft ($)'],
  ['site', 'Site work and utilities ($)'],
  ['softPct', 'Soft costs (% of house)'],
  ['contPct', 'Contingency (%)'],
  ['extras', 'Landscape, furniture, moving ($)'],
  ['downPct', 'Down payment (%)'],
  ['rate', 'Loan interest rate (%)'],
  ['months', 'Months to build'],
];

const partColor = (t: ThemeColors) => [t.muted, t.warn, t.accent, t.ok, t.flag, t.bad, t.line];

/** A number field that keeps what you type and saves the number once it reads as one. */
function NumberField({ k, label }: { k: keyof Budget; label: string }) {
  const { state, update } = useBuild();
  const [text, setText] = useState(String(state.budget[k]));
  return (
    <Field
      label={label}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={(t) => {
        setText(t);
        const n = toNumber(t);
        update((prev) => ({
          ...prev,
          budget: { ...prev.budget, [k]: n },
          profile: k === 'sqft' ? { ...prev.profile, sqft: n } : prev.profile,
        }));
      }}
    />
  );
}

export default function MoneyTab() {
  const { state } = useBuild();
  const theme = useTheme();
  const r = budgetCalc(state.budget);
  const parts = budgetParts(state.budget);
  const colorsFor = partColor(theme);
  const pay = paymentSummary(state.payments, state.retainPct);

  return (
    <Screen>
      <Heading eyebrow="Money" title="What it really costs" lede="Change any number. Cost per square foot varies widely by region and finish level, so ask two or three local builders for a current range and use the middle." />

      <LinkRow
        title="Paying people"
        sub={`${money(pay.total)} paid · ${plural(pay.missingWaivers, 'lien waiver')} outstanding`}
        right={pay.missingWaivers || pay.notInspected ? <Pill tone="flag">Check</Pill> : undefined}
        onPress={() => router.push('/payments')}
      />

      <Card>
        <Label>All-in total</Label>
        <Text style={[styles.total, { color: theme.text }]}>{money(r.total)}</Text>
        <Body muted>{money(r.perSqft)} per heated sq ft, everything included</Body>
        <View accessibilityLabel="Budget breakdown bar" style={styles.stack}>
          {parts.map((p, i) => (
            <View key={p.label} style={{ flex: Math.max(p.value, 0), backgroundColor: colorsFor[i] }} />
          ))}
        </View>
        <View>
          {parts.map((p, i) => (
            <MoneyRow
              key={p.label}
              label={<><Text style={{ color: colorsFor[i] }}>■ </Text>{p.label}</>}
              value={money(p.value)}
            />
          ))}
          <MoneyRow label="Total" value={money(r.total)} bold />
        </View>
        <View style={styles.pair}>
          <View style={{ flex: 1 }}><Label>Construction loan</Label><Text style={[ui.mono, { color: theme.text }]}>{money(r.loan)}</Text></View>
          <View style={{ flex: 1 }}><Label>Cash you need</Label><Text style={[ui.mono, { color: theme.text }]}>{money(r.cash)}</Text></View>
        </View>
      </Card>

      <Card>
        <H3>Your numbers</H3>
        <View style={styles.fields}>
          {FIELDS.map(([k, label]) => <NumberField key={k} k={k} label={label} />)}
        </View>
        <Text style={[ui.small, { color: theme.muted }]}>
          Soft costs cover plans, engineering, surveys, permits and fees: often 8–15%. Contingency should be at least 10%. Site work on raw land with a well and septic is often $30,000–$80,000 or more.
        </Text>
      </Card>

      <Card>
        <H3>Draw schedule</H3>
        <Body muted>How lenders typically release construction money. Each draw is paid only after the milestone is finished and inspected. {state.retainPct}% retainage is held from each.</Body>
        <View>
          {drawSchedule(r.hard).map((d) => (
            <MoneyRow key={d.label} label={`${d.label} (${d.pct}%)`} sub={`Proof: ${d.proof}`} value={money(d.value)} />
          ))}
        </View>
      </Card>

      <Card>
        <H3>Where the house money goes</H3>
        <Body muted>Typical split of construction cost for a new single-family home, rounded from industry cost surveys. Use it to sanity-check bids.</Body>
        <View>
          {costSplit(r.hard).map((c) => (
            <MoneyRow key={c.label} label={`${c.label} (${c.pct}%)`} value={money(c.value)} />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { fontFamily: fonts.mono, fontSize: 34 },
  stack: { flexDirection: 'row', height: 26, borderRadius: 6, overflow: 'hidden', gap: 2 },
  pair: { flexDirection: 'row', gap: 12 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
