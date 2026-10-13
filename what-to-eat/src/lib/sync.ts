import type { Cost, Idea, Mood } from '@/data/ideas';
import type { Fave, PastPick } from '@/lib/picker';
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
export type PickRow = { id: number; idea_id: number; picked_at: string };

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
  return {
    id: `server-${row.id}`,
    ideaId: Number(row.idea_id),
    pickedAt: Date.parse(row.picked_at),
  };
}

/**
 * Guest data to copy into Supabase at sign-in. Keeps original timestamps so the 7-day rule
 * and "N days ago" still line up, drops duplicate hearts, and skips ideas the server
 * doesn't know about.
 */
export function guestRows(
  guest: { favorites: Fave[]; picks: PastPick[] },
  knownIdeaIds: Set<number>
) {
  const seen = new Set<number>();
  const favorites = guest.favorites
    .filter((f) => knownIdeaIds.has(f.ideaId) && !seen.has(f.ideaId) && seen.add(f.ideaId))
    .map((f) => ({ idea_id: f.ideaId, created_at: new Date(f.createdAt).toISOString() }));
  const picks = guest.picks
    .filter((p) => knownIdeaIds.has(p.ideaId))
    .map((p) => ({ idea_id: p.ideaId, picked_at: new Date(p.pickedAt).toISOString() }));
  return { favorites, picks };
}

/** While guest data is still uploading, show it alongside what the server already has. */
export function mergeFaves(server: Fave[], local: Fave[]): Fave[] {
  const ids = new Set(server.map((f) => f.ideaId));
  return [...local.filter((f) => !ids.has(f.ideaId)), ...server].sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function mergePicks(server: PastPick[], local: PastPick[]): PastPick[] {
  return [...local, ...server].sort((a, b) => b.pickedAt - a.pickedAt);
}
