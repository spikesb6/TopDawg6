import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Checkbox, Field, Heading, Label, Segmented } from '@/components/ui';
import { PHASES } from '@/data/content';
import { useTheme } from '@/hooks/use-theme';
import { toNumber } from '@/lib/format';
import { currentPhase } from '@/lib/progress';
import type { Waiver } from '@/lib/state';
import { useBuild } from '@/store/build-store';
import { useToast } from '@/store/toast-store';

const today = () => new Date().toISOString().slice(0, 10);

export default function NewPayment() {
  const { state, update } = useBuild();
  const toast = useToast();
  const theme = useTheme();
  const [date, setDate] = useState(today);
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState(currentPhase(state.done).id);
  const [waiver, setWaiver] = useState<Waiver>('none');
  const [inspected, setInspected] = useState(false);
  const [error, setError] = useState('');

  const save = () => {
    const n = toNumber(amount);
    if (!payee.trim()) return setError('Enter the company you paid, as named on the contract.');
    if (!n) return setError('Enter the amount you paid.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Enter the date as YYYY-MM-DD, for example 2026-05-01.');
    update((prev) => ({
      ...prev,
      payments: [...prev.payments, { id: 'p' + Date.now(), date, payee: payee.trim(), phase, amount: n, waiver, inspected }],
    }));
    toast(waiver === 'unconditional' ? 'Payment logged' : 'Payment logged. Get the lien waiver for it.');
    router.back();
  };

  return (
    <Screen back>
      <Heading eyebrow="Paying people" title="Log a payment" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Field label="Paid to (company)" value={payee} onChangeText={setPayee} placeholder="Company on the contract" autoCapitalize="words" />
        <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="12500" />
        <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-05-01" />
      </View>
      <Label>Phase</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PHASES.map((p) => (
          <Button key={p.id} small kind={phase === p.id ? 'primary' : 'default'} label={p.name} onPress={() => setPhase(p.id)} />
        ))}
      </View>
      <Label>Lien waiver received</Label>
      <Segmented label="Lien waiver received" options={[['none', 'None yet'], ['conditional', 'Conditional'], ['unconditional', 'Unconditional']]} value={waiver} onChange={setWaiver} tones={{ none: 'bad', conditional: 'warn', unconditional: 'ok' }} />
      <Checkbox label="Work inspected and verified" checked={inspected} onToggle={() => setInspected(!inspected)} />
      {!!error && <Body style={{ color: theme.bad }}>{error}</Body>}
      <Button kind="primary" label="Add payment" onPress={save} />
    </Screen>
  );
}
