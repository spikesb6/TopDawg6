import type { Href } from 'expo-router';

import type { Cost, Mood } from '@/data/ideas';
import type { PlacesMode } from '@/lib/places';
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

/** A place card. Mood and budget come along so Spin again draws from the same filtered list. */
export function placeHref(
  place: { id: string; name: string },
  mode: PlacesMode,
  filters: { mood?: Mood | null; cost?: Cost | null } = {},
  spin = false
): Href {
  const params: Record<string, string> = { id: place.id, name: place.name, mode };
  if (filters.mood) params.mood = filters.mood;
  if (filters.cost) params.cost = String(filters.cost);
  if (spin) params.spin = '1';
  return { pathname: '/place', params };
}
