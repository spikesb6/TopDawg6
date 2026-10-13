import type { Cost, Idea, Mood } from '@/data/ideas';
import type { PlaceRef } from '@/lib/places';
import type { ModeKey } from '@/theme/theme';

/** A locked-in dinner: either a seed idea (ideaId) or a real place (place). */
export type PastPick = { id: string; ideaId?: number; place?: PlaceRef; pickedAt: number };
export type Fave = { ideaId: number; createdAt: number };
export type PlaceFave = { place: PlaceRef; createdAt: number };

export type Filters = {
  mode?: ModeKey | null;
  mood?: Mood | null;
  cost?: Cost | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const NO_REPEAT_DAYS = 7;

/** Mode, mood and budget filters combine; an unset filter matches everything. */
export function filterIdeas(list: Idea[], { mode, mood, cost }: Filters): Idea[] {
  return list.filter(
    (idea) =>
      (mode == null || idea.mode === mode) &&
      (mood == null || idea.mood === mood) &&
      (cost == null || idea.cost === cost)
  );
}

/** Ideas locked in with "Let's eat this" during the last `days` days. */
export function recentIdeaIds(picks: PastPick[], now: number, days = NO_REPEAT_DAYS): Set<number> {
  const since = now - days * DAY_MS;
  return new Set(picks.flatMap((p) => (p.pickedAt > since && p.ideaId != null ? [p.ideaId] : [])));
}

/**
 * Everything Surprise me can land on: all modes, minus anything locked in during the
 * last 7 days. If that rules out every idea, the whole list comes back.
 */
export function surprisePool(list: Idea[], picks: PastPick[], now = Date.now()): Idea[] {
  const recent = recentIdeaIds(picks, now);
  const pool = list.filter((idea) => !recent.has(idea.id));
  return pool.length > 0 ? pool : list;
}

/** A random idea from the pool that is never `excludeId` (so Spin again never repeats). */
export function pickRandom<T extends { id: number | string }>(
  pool: T[],
  excludeId: T['id'] | null = null,
  random: () => number = Math.random
): T | null {
  const options = excludeId == null ? pool : pool.filter((item) => item.id !== excludeId);
  if (options.length === 0) return null;
  return options[Math.min(Math.floor(random() * options.length), options.length - 1)];
}

/** "Today", "Yesterday" or "N days ago", counted in calendar days. */
export function relativeDay(time: number, now = Date.now()): string {
  const start = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((start(now) - start(time)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function toggleFave(faves: Fave[], ideaId: number, now: number): Fave[] {
  return faves.some((f) => f.ideaId === ideaId)
    ? faves.filter((f) => f.ideaId !== ideaId)
    : [{ ideaId, createdAt: now }, ...faves];
}

export function addPick(picks: PastPick[], ideaId: number, now: number): PastPick[] {
  return [{ id: `${now}-${ideaId}`, ideaId, pickedAt: now }, ...picks];
}

export function togglePlaceFave(faves: PlaceFave[], place: PlaceRef, now: number): PlaceFave[] {
  return faves.some((f) => f.place.id === place.id)
    ? faves.filter((f) => f.place.id !== place.id)
    : [{ place, createdAt: now }, ...faves];
}

export function addPlacePick(picks: PastPick[], place: PlaceRef, now: number): PastPick[] {
  return [{ id: `${now}-${place.id}`, place, pickedAt: now }, ...picks];
}

export function costLabel(cost: Cost): string {
  return '$'.repeat(cost);
}
