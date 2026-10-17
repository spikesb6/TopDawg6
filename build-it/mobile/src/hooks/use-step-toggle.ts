import { router } from 'expo-router';

import { ALL_STEPS, PHASES } from '@/data/content';
import { plural } from '@/lib/format';
import { openBefore, phaseStats } from '@/lib/progress';
import { useBuild } from '@/store/build-store';
import { useToast } from '@/store/toast-store';

export function goToStep(stepId: string) {
  const s = ALL_STEPS.find((x) => x.id === stepId);
  if (s) router.push({ pathname: '/phase/[id]', params: { id: s.phase, step: stepId } });
}

/** Checks a step off (or back on) and warns when something earlier is still open. */
export function useStepToggle() {
  const { state, update } = useBuild();
  const toast = useToast();

  return (stepId: string) => {
    const checking = !state.done[stepId];
    const done = { ...state.done };
    if (checking) done[stepId] = true;
    else delete done[stepId];
    update((prev) => ({ ...prev, done }));
    if (!checking) return;

    const step = ALL_STEPS.find((s) => s.id === stepId)!;
    const before = openBefore(stepId, done);
    if (step.gate && !state.notes[stepId]) {
      toast('Hold point checked. Write the inspector, date and result in its notes.');
    } else if (before.length) {
      toast(`${plural(before.length, 'earlier step')} still open. No step gets skipped.`, 'Show me', () => goToStep(before[0].id));
    } else if (phaseStats(PHASES[step.pi], done).pct === 100) {
      const next = PHASES[step.pi + 1];
      toast(`${PHASES[step.pi].name} is complete.`, next ? 'Next phase' : undefined, () =>
        next && router.replace({ pathname: '/phase/[id]', params: { id: next.id } }),
      );
    }
  };
}
