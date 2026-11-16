import { ALL_STEPS, PHASES, type Phase, type StepRef } from '@/data/content';

type Done = Record<string, boolean>;

export function phaseStats(p: Phase, done: Done) {
  const total = p.steps.length;
  const count = p.steps.filter((s) => done[s.id]).length;
  const gates = p.steps.filter((s) => s.gate);
  return {
    total,
    done: count,
    pct: Math.round((count / total) * 100),
    gates: gates.length,
    gatesOpen: gates.filter((s) => !done[s.id]).length,
  };
}

/** The first phase with an open step, or the last phase when everything is done. */
export function currentPhase(done: Done): Phase {
  return PHASES.find((p) => p.steps.some((s) => !done[s.id])) ?? PHASES[PHASES.length - 1];
}

/** Steps left open behind the furthest step that has been checked off. */
export function skippedSteps(done: Done): StepRef[] {
  let last = -1;
  ALL_STEPS.forEach((s, i) => {
    if (done[s.id]) last = i;
  });
  return ALL_STEPS.slice(0, last + 1).filter((s) => !done[s.id]);
}

/** Open steps that come before this one in build order. */
export function openBefore(stepId: string, done: Done): StepRef[] {
  const i = ALL_STEPS.findIndex((s) => s.id === stepId);
  return ALL_STEPS.slice(0, Math.max(i, 0)).filter((s) => !done[s.id]);
}

export function overall(done: Done) {
  const count = ALL_STEPS.filter((s) => done[s.id]).length;
  return { done: count, total: ALL_STEPS.length, pct: Math.round((count / ALL_STEPS.length) * 100) };
}

export function openHoldPoints(done: Done) {
  return ALL_STEPS.filter((s) => s.gate && !done[s.id]).length;
}
