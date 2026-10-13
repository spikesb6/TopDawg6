import { supabase } from '@/lib/supabase';
import {
  faveFromRow,
  guestRows,
  ideaFromRow,
  pickFromRow,
  placeFaveFromRow,
  type FaveRow,
  type IdeaRow,
  type PickRow,
  type PlaceFaveRow,
} from '@/lib/sync';
import type { Fave, PastPick, PlaceFave } from '@/lib/picker';
import type { Place, PlaceRef, PlacesMode } from '@/lib/places';

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
    .select('id, idea_id, place_id, place_name, place_mode, picked_at')
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

export async function fetchPlaceFavorites() {
  const { data, error } = await client()
    .from('place_favorites')
    .select('place_id, name, mode, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as PlaceFaveRow[]).map(placeFaveFromRow);
}

export async function addPlaceFavorite(place: PlaceRef) {
  const { error } = await client()
    .from('place_favorites')
    .upsert(
      { place_id: place.id, name: place.name, mode: place.mode },
      { onConflict: 'user_id,place_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function removePlaceFavorite(placeId: string) {
  const { error } = await client().from('place_favorites').delete().eq('place_id', placeId);
  if (error) throw error;
}

export async function addPlacePick(place: PlaceRef) {
  const { error } = await client()
    .from('picks')
    .insert({ place_id: place.id, place_name: place.name, place_mode: place.mode });
  if (error) throw error;
}

/** Where to look: the phone's position, or a city the person typed. */
export type PlacesWhere = { lat: number; lng: number } | { city: string };

/** Open-now places from the `places` Edge Function. The Google key stays on the server. */
export async function fetchPlaces(mode: PlacesMode, where: PlacesWhere): Promise<Place[]> {
  const { data, error } = await client().functions.invoke<{ places: Place[] }>('places', {
    body: { mode, ...where },
  });
  if (error) throw error;
  return data?.places ?? [];
}

/** Copies guest faves and picks into the signed-in account. */
export async function importGuestData(
  guest: { favorites: Fave[]; placeFaves?: PlaceFave[]; picks: PastPick[] },
  knownIdeaIds: Set<number>
) {
  const rows = guestRows(guest, knownIdeaIds);
  if (rows.favorites.length > 0) {
    const { error } = await client()
      .from('favorites')
      .upsert(rows.favorites, { onConflict: 'user_id,idea_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  if (rows.placeFavorites.length > 0) {
    const { error } = await client()
      .from('place_favorites')
      .upsert(rows.placeFavorites, { onConflict: 'user_id,place_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  if (rows.picks.length > 0) {
    const { error } = await client().from('picks').insert(rows.picks);
    if (error) throw error;
  }
}
