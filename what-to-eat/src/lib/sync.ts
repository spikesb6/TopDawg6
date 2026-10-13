import type { Cost, Idea, Mood } from '@/data/ideas';
import type { Fave, PastPick, PlaceFave } from '@/lib/picker';
import type { PlacesMode } from '@/lib/places';
import type { ModeKey } from '@/theme/theme';

// Row shapes as they come back from Supabase.
export type IdeaRow = {
  id: number;
  mode: ModeKey;
  name: string;
  blurb: string;
  mood: Mood;
  cost: number;
  minutes: number | null;
  details: string | null;
};
export type FaveRow = { idea_id: number; created_at: string };
export type PickRow = {
  id: number;
  idea_id: number | null;
  place_id?: string | null;
  place_name?: string | null;
  place_mode?: PlacesMode | null;
  picked_at: string;
};
export type PlaceFaveRow = { place_id: string; name: string; mode: PlacesMode; created_at: string };
type PickInsert =
  | { idea_id: number; picked_at: string }
  | { place_id: string; place_name: string; place_mode: PlacesMode; picked_at: string };

export function ideaFromRow(row: IdeaRow): Idea {
  return {
    id: Number(row.id),
    mode: row.mode,
    name: row.name,
    blurb: row.blurb,
    mood: row.mood,
    cost: Math.min(3, Math.max(1, row.cost)) as Cost,
    minutes: row.minutes ?? 0,
    details: row.details ?? '',
  };
}

export function faveFromRow(row: FaveRow): Fave {
  return { ideaId: Number(row.idea_id), createdAt: Date.parse(row.created_at) };
}

export function pickFromRow(row: PickRow): PastPick {
  const base = { id: `server-${row.id}`, pickedAt: Date.parse(row.picked_at) };
  if (row.place_id && row.place_name && row.place_mode) {
    return { ...base, place: { id: row.place_id, name: row.place_name, mode: row.place_mode } };
  }
  return { ...base, ideaId: Number(row.idea_id) };
}

export function placeFaveFromRow(row: PlaceFaveRow): PlaceFave {
  return {
    place: { id: row.place_id, name: row.name, mode: row.mode },
    createdAt: Date.parse(row.created_at),
  };
}

/**
 * Guest data to copy into Supabase at sign-in. Keeps original timestamps so the 7-day rule
 * and "N days ago" still line up, drops duplicate hearts, and skips ideas the server
 * doesn't know about.
 */
export function guestRows(
  guest: { favorites: Fave[]; placeFaves?: PlaceFave[]; picks: PastPick[] },
  knownIdeaIds: Set<number>
) {
  const seen = new Set<number>();
  const favorites = guest.favorites
    .filter((f) => knownIdeaIds.has(f.ideaId) && !seen.has(f.ideaId) && seen.add(f.ideaId))
    .map((f) => ({ idea_id: f.ideaId, created_at: new Date(f.createdAt).toISOString() }));
  const seenPlaces = new Set<string>();
  const placeFavorites = (guest.placeFaves ?? [])
    .filter((f) => !seenPlaces.has(f.place.id) && seenPlaces.add(f.place.id))
    .map((f) => ({
      place_id: f.place.id,
      name: f.place.name,
      mode: f.place.mode,
      created_at: new Date(f.createdAt).toISOString(),
    }));
  const picks = guest.picks.flatMap((p): PickInsert[] => {
    const picked_at = new Date(p.pickedAt).toISOString();
    if (p.place) {
      return [
        { place_id: p.place.id, place_name: p.place.name, place_mode: p.place.mode, picked_at },
      ];
    }
    return p.ideaId != null && knownIdeaIds.has(p.ideaId) ? [{ idea_id: p.ideaId, picked_at }] : [];
  });
  return { favorites, placeFavorites, picks };
}

/** While guest data is still uploading, show it alongside what the server already has. */
export function mergeFaves(server: Fave[], local: Fave[]): Fave[] {
  const ids = new Set(server.map((f) => f.ideaId));
  return [...local.filter((f) => !ids.has(f.ideaId)), ...server].sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function mergePlaceFaves(server: PlaceFave[], local: PlaceFave[]): PlaceFave[] {
  const ids = new Set(server.map((f) => f.place.id));
  return [...local.filter((f) => !ids.has(f.place.id)), ...server].sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function mergePicks(server: PastPick[], local: PastPick[]): PastPick[] {
  return [...local, ...server].sort((a, b) => b.pickedAt - a.pickedAt);
}
