import type { Href } from 'expo-router';

import type { Cost, Mood } from '@/data/ideas';
import type { ModeKey } from '@/theme/theme';

/** Where a result card draws its next idea from when you tap Spin again. */
export type ResultSource =
  | { from: 'surprise' }
  | { from: 'list'; mode: ModeKey; mood?: Mood | null; cost?: Cost | null };

export function resultHref(ideaId: number, source: ResultSource, spin = false): Href {
  const params: Record<string, string> = { id: String(ideaId), from: source.from };
  if (source.from === 'list') {
    params.mode = source.mode;
    if (source.mood) params.mood = source.mood;
    if (source.cost) params.cost = String(source.cost);
  }
  if (spin) params.spin = '1';
  return { pathname: '/result', params };
}
