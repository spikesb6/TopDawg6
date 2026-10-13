import { supabase } from '@/lib/supabase';
import {
  faveFromRow,
  guestRows,
  ideaFromRow,
  pickFromRow,
  type FaveRow,
  type IdeaRow,
  type PickRow,
} from '@/lib/sync';
import type { Fave, PastPick } from '@/lib/picker';

// Thin wrappers over Supabase. RLS scopes favorites and picks to the signed-in user.

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function fetchIdeas() {
  const { data, error } = await client()
    .from('ideas')
    .select('id, mode, name, blurb, mood, cost, minutes, details')
    .order('id');
  if (error) throw error;
  return (data as IdeaRow[]).map(ideaFromRow);
}

export async function fetchFavorites() {
  const { data, error } = await client()
    .from('favorites')
    .select('idea_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as FaveRow[]).map(faveFromRow);
}

export async function fetchPicks() {
  const { data, error } = await client()
    .from('picks')
    .select('id, idea_id, picked_at')
    .order('picked_at', { ascending: false });
  if (error) throw error;
  return (data as PickRow[]).map(pickFromRow);
}

export async function addFavorite(ideaId: number) {
  const { error } = await client()
    .from('favorites')
    .upsert({ idea_id: ideaId }, { onConflict: 'user_id,idea_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFavorite(ideaId: number) {
  const { error } = await client().from('favorites').delete().eq('idea_id', ideaId);
  if (error) throw error;
}

export async function addPick(ideaId: number) {
  const { error } = await client().from('picks').insert({ idea_id: ideaId });
  if (error) throw error;
}

/** Copies guest faves and picks into the signed-in account. */
export async function importGuestData(
  guest: { favorites: Fave[]; picks: PastPick[] },
  knownIdeaIds: Set<number>
) {
  const rows = guestRows(guest, knownIdeaIds);
  if (rows.favorites.length > 0) {
    const { error } = await client()
      .from('favorites')
      .upsert(rows.favorites, { onConflict: 'user_id,idea_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  if (rows.picks.length > 0) {
    const { error } = await client().from('picks').insert(rows.picks);
    if (error) throw error;
  }
}
