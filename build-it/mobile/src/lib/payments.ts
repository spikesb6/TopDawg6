import type { Payment } from '@/lib/state';

export function paymentSummary(payments: Payment[], retainPct: number) {
  const total = payments.reduce((a, x) => a + (x.amount || 0), 0);
  return {
    total,
    missingWaivers: payments.filter((x) => x.waiver !== 'unconditional').length,
    notInspected: payments.filter((x) => !x.inspected).length,
    retainage: (total * retainPct) / 100,
    hasExamples: payments.some((x) => x.example),
  };
}

export function sortByDate(payments: Payment[]) {
  return payments.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
