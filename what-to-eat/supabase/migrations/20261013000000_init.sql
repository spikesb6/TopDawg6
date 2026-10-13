-- What to eat? v1 schema: shared read-only ideas, plus per-user favorites, picks and profiles.

create type public.mode as enum ('cook', 'fast', 'dine', 'deliv');
create type public.mood as enum ('comfy', 'fresh', 'spicy');

-- Ideas are shared and read-only for the app. Seeded from supabase/seed.sql.
create table public.ideas (
  id bigint generated always as identity primary key,
  mode public.mode not null,
  name text not null,
  blurb text not null,
  mood public.mood not null,
  cost smallint not null check (cost between 1 and 3),
  minutes int,
  details text,
  image_url text
);

alter table public.ideas enable row level security;

create policy "Anyone can read ideas"
  on public.ideas for select
  to anon, authenticated
  using (true);

-- One row per heart.
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  idea_id bigint not null references public.ideas on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idea_id)
);

alter table public.favorites enable row level security;

create policy "Users read their own favorites"
  on public.favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own favorites"
  on public.favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own favorites"
  on public.favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Written only when the user taps "Let's eat this". Powers Past picks and the 7-day rule.
create table public.picks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  idea_id bigint not null references public.ideas,
  picked_at timestamptz not null default now()
);

create index picks_user_picked_at_idx on public.picks (user_id, picked_at desc);

alter table public.picks enable row level security;

create policy "Users read their own picks"
  on public.picks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own picks"
  on public.picks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Optional profile, created at first sign-in.
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  home_city text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guests never touch user data on the server.
revoke all on public.favorites, public.picks, public.profiles from anon;
