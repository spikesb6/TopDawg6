// Supabase Edge Function: nearby open-now places from Google Places API (New).
// Deploy: supabase functions deploy places
// Secret: supabase secrets set GOOGLE_PLACES_API_KEY=...
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createHandler, type PlacesCache } from './handler.ts';
import type { Place } from './logic.ts';

// Service role so the function can use places_cache, which the app itself can't read.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const cache: PlacesCache = {
  async get(key) {
    const { data } = await admin
      .from('places_cache')
      .select('places, created_at')
      .eq('cache_key', key)
      .maybeSingle();
    return data ? { places: data.places as Place[], createdAt: Date.parse(data.created_at) } : null;
  },
  async set(key, places) {
    await admin
      .from('places_cache')
      .upsert({ cache_key: key, places, created_at: new Date().toISOString() });
    // Keep the table small: drop entries more than a day old.
    await admin
      .from('places_cache')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  },
};

Deno.serve(
  createHandler({
    apiKey: Deno.env.get('GOOGLE_PLACES_API_KEY'),
    fetch,
    cache,
    now: Date.now,
    log: console.error,
  })
);
