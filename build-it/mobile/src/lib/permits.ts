import { PERMITS, type Permit } from '@/data/content';
import type { Profile } from '@/lib/state';

/** Permits that apply to this project: those with no rule, or whose rule matches the profile. */
export function permitsFor(profile: Profile): Permit[] {
  const p = profile as unknown as Record<string, unknown>;
  return PERMITS.filter((x) => !x.when || Object.entries(x.when).every(([k, v]) => p[k] === v));
}
