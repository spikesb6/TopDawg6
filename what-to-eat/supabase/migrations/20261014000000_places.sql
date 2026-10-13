-- Phase 4: real places from Google for Fast food and Dine out.

-- Short-lived cache of Places results, keyed by mode and rounded location or city.
-- Only the places Edge Function (service role) uses it; the app has no access.
create table public.places_cache (
  cache_key text primary key,
  places jsonb not null,
  created_at timestamptz not null default now()
);

create index places_cache_created_at_idx on public.places_cache (created_at);

alter table public.places_cache enable row level security;
revoke all on public.places_cache from anon, authenticated;

-- Hearted places. Only the Google place_id, name and mode are stored.
create table public.place_favorites (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  place_id text not null,
  name text not null,
  mode public.mode not null check (mode in ('fast', 'dine')),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

alter table public.place_favorites enable row level security;

create policy "Users read their own place favorites"
  on public.place_favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own place favorites"
  on public.place_favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own place favorites"
  on public.place_favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.place_favorites from anon;

-- A pick is now either an idea or a place.
alter table public.picks
  alter column idea_id drop not null,
  add column place_id text,
  add column place_name text,
  add column place_mode public.mode check (place_mode in ('fast', 'dine')),
  add constraint picks_idea_or_place check (
    (idea_id is not null and place_id is null and place_name is null and place_mode is null)
    or (idea_id is null and place_id is not null and place_name is not null and place_mode is not null)
  );
