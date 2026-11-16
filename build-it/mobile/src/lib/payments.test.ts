import { describe, expect, it } from '@jest/globals';

import { paymentSummary, sortByDate } from '@/lib/payments';
import { EXAMPLE_PAYMENTS } from '@/lib/state';

describe('payments', () => {
  it('flags missing waivers and uninspected work', () => {
    const s = paymentSummary(EXAMPLE_PAYMENTS, 10);
    expect(s.total).toBe(59250);
    expect(s.missingWaivers).toBe(2);
    expect(s.notInspected).toBe(1);
    expect(s.retainage).toBe(5925);
    expect(s.hasExamples).toBe(true);
  });

  it('sorts oldest first without changing the input', () => {
    const rev = EXAMPLE_PAYMENTS.slice().reverse();
    expect(sortByDate(rev).map((p) => p.id)).toEqual(['x1', 'x2', 'x3']);
    expect(rev[0].id).toBe('x3');
  });
});
