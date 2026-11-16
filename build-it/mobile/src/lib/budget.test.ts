import { describe, expect, it } from '@jest/globals';

import { budgetCalc, budgetParts, costSplit, drawSchedule } from '@/lib/budget';
import { freshState } from '@/lib/state';

describe('budget', () => {
  const b = freshState().budget;
  const r = budgetCalc(b);

  it('adds every part into the all-in total', () => {
    const sum = budgetParts(b).reduce((a, p) => a + p.value, 0);
    expect(sum).toBeCloseTo(r.total, 6);
  });

  it('computes the default example', () => {
    expect(r.house).toBe(462000);
    expect(r.soft).toBe(46200);
    expect(Math.round(r.total)).toBe(730604);
  });

  it('pays out 100% of construction money across draws and the cost split', () => {
    expect(drawSchedule(r.hard).reduce((a, d) => a + d.pct, 0)).toBe(100);
    expect(costSplit(r.hard).reduce((a, d) => a + d.pct, 0)).toBe(100);
  });

  it('charges no interest with 100% down', () => {
    expect(budgetCalc({ ...b, downPct: 100 }).interest).toBe(0);
  });
});
