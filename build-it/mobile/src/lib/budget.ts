import { COST_SPLIT, DRAWS } from '@/data/content';
import type { Budget } from '@/lib/state';

export function budgetCalc(b: Budget) {
  const house = b.sqft * b.cpsf;
  const soft = (house * b.softPct) / 100;
  const sub = b.land + b.site + house + soft + b.extras;
  const cont = ((b.site + house + soft) * b.contPct) / 100;
  const total = sub + cont;
  const loan = total * (1 - b.downPct / 100);
  // Draws ramp up, so on average about half the loan is outstanding during the build.
  const interest = loan * (b.rate / 100) * (b.months / 12) * 0.5;
  return {
    house,
    soft,
    cont,
    interest,
    loan,
    /** Construction money the draws pay out: house plus site work. */
    hard: house + b.site,
    total: total + interest,
    cash: (total * b.downPct) / 100 + interest,
    perSqft: (total + interest) / Math.max(b.sqft, 1),
  };
}

export function budgetParts(b: Budget) {
  const r = budgetCalc(b);
  return [
    { label: 'Land', value: b.land },
    { label: 'Site work and utilities', value: b.site },
    { label: 'House construction', value: r.house },
    { label: 'Design, engineering, permits, fees', value: r.soft },
    { label: 'Contingency', value: r.cont },
    { label: 'Loan interest during build', value: r.interest },
    { label: 'Landscaping, furniture, moving', value: b.extras },
  ];
}

export function costSplit(hard: number) {
  return COST_SPLIT.map(([label, pct]) => ({ label, pct, value: (hard * pct) / 100 }));
}

export function drawSchedule(hard: number) {
  return DRAWS.map(([label, pct, proof]) => ({ label, pct, proof, value: (hard * pct) / 100 }));
}
