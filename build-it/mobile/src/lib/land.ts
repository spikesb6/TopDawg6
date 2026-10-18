import { LOT_GROUPS } from '@/data/content';
import type { LotValue } from '@/lib/state';
import { plural } from '@/lib/format';

export type Verdict = { tone: 'ok' | 'warn' | 'bad' | 'plain'; title: string; body: string };

export function lotCounts(lot: Record<string, LotValue>) {
  const items = LOT_GROUPS.flatMap((g) => g.items);
  const c = { ok: 0, concern: 0, nogo: 0, unknown: 0, total: items.length };
  items.forEach((i) => c[lot[i.id] ?? 'unknown']++);
  return c;
}

export function lotVerdict(lot: Record<string, LotValue>): Verdict {
  const c = lotCounts(lot);
  if (c.nogo)
    return { tone: 'bad', title: 'Walk away or renegotiate', body: `${plural(c.nogo, 'deal-breaker')}. Use your due diligence contingency before it expires.` };
  if (c.concern)
    return { tone: 'warn', title: 'Get answers before you close', body: `${plural(c.concern, 'concern')} to price or resolve. Get written quotes and put them in your budget.` };
  if (c.unknown)
    return { tone: 'plain', title: 'Still in due diligence', body: `${c.unknown} of ${c.total} checks still unknown. Do not close until every one is answered.` };
  return { tone: 'ok', title: 'This lot checks out', body: 'Every check passed. Close with title insurance and keep every report in your binder.' };
}
