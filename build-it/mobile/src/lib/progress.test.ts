import { describe, expect, it } from '@jest/globals';

import { ALL_STEPS, PHASES } from '@/data/content';
import { currentPhase, openBefore, openHoldPoints, overall, phaseStats, skippedSteps } from '@/lib/progress';

const all = Object.fromEntries(ALL_STEPS.map((s) => [s.id, true]));

describe('progress', () => {
  it('starts in the first phase with nothing skipped', () => {
    expect(currentPhase({}).id).toBe(PHASES[0].id);
    expect(skippedSteps({})).toEqual([]);
    expect(overall({}).pct).toBe(0);
  });

  it('finds steps left open behind the furthest checked step', () => {
    const [a, b, c] = ALL_STEPS;
    const skipped = skippedSteps({ [a.id]: true, [c.id]: true });
    expect(skipped.map((s) => s.id)).toEqual([b.id]);
  });

  it('lists open steps before a given step', () => {
    const [a, b, c] = ALL_STEPS;
    expect(openBefore(c.id, { [a.id]: true }).map((s) => s.id)).toEqual([b.id]);
    expect(openBefore(a.id, {})).toEqual([]);
  });

  it('moves to the next phase once a phase is done', () => {
    const done = Object.fromEntries(PHASES[0].steps.map((s) => [s.id, true]));
    expect(phaseStats(PHASES[0], done).pct).toBe(100);
    expect(currentPhase(done).id).toBe(PHASES[1].id);
  });

  it('counts hold points and stays on the last phase when everything is done', () => {
    expect(openHoldPoints({})).toBe(ALL_STEPS.filter((s) => s.gate).length);
    expect(openHoldPoints(all)).toBe(0);
    expect(currentPhase(all).id).toBe(PHASES[PHASES.length - 1].id);
    expect(overall(all).pct).toBe(100);
  });
});
