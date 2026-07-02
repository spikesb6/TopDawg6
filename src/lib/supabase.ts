/**
 * Supabase client setup.
 *
 * ─── ENVIRONMENT VARIABLES ────────────────────────────────────────────────
 * Add these to `.env.local` (see `.env.example`):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
 *
 * Find both under: Supabase Dashboard → Project Settings → API.
 * The anon key is safe to expose to the browser (Row Level Security applies).
 * Never put your `service_role` key in a NEXT_PUBLIC_ variable.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * If these variables are NOT set, the app automatically falls back to an
 * in-memory mock database seeded with sample data (see src/lib/mock-db.ts),
 * so the MVP runs out of the box with zero configuration.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when real Supabase credentials are configured. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

/** Returns a singleton Supabase client, or null when not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl!, supabaseAnonKey!);
  }
  return client;
}
