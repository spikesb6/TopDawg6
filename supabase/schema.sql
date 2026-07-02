-- ============================================================
-- AgentMatch — Supabase schema
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- (or `supabase db push` with the Supabase CLI).
-- Then run supabase/seed.sql to load sample data.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- sellers: homeowner intake submissions
-- ------------------------------------------------------------
create table if not exists public.sellers (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  email            text not null,
  phone            text not null,
  property_address text not null,
  city             text not null,
  state            text not null,
  zip_code         text not null check (zip_code ~ '^\d{5}$'),
  property_type    text not null check (property_type in
                     ('single_family','condo','townhouse','multifamily','land')),
  condition        text not null check (condition in
                     ('turnkey','light_updates','dated','fixer','major_repairs')),
  bedrooms         numeric not null default 0,
  bathrooms        numeric not null default 0,
  square_footage   integer not null default 0,
  estimated_value  numeric not null default 0,
  timeline         text not null check (timeline in
                     ('now','30_days','60_days','90_plus_days','just_exploring')),
  selling_reason   text not null check (selling_reason in
                     ('relocating','inherited_property','downsizing','divorce',
                      'financial_pressure','rental_property','other')),
  selling_goal     text not null check (selling_goal in
                     ('highest_price','fastest_sale','as_is_sale','privacy',
                      'investor_offer','unsure')),
  notes            text not null default '',
  intent_score     integer not null default 0 check (intent_score between 0 and 100),
  created_at       timestamptz not null default now()
);

create index if not exists sellers_zip_idx on public.sellers (zip_code);
create index if not exists sellers_created_idx on public.sellers (created_at desc);

-- ------------------------------------------------------------
-- agents: agent profiles with performance data
-- ------------------------------------------------------------
create table if not exists public.agents (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  brokerage              text not null,
  email                  text not null,
  phone                  text not null,
  license_number         text not null,
  service_zip_codes      text[] not null default '{}',
  years_experience       integer not null default 0,
  total_homes_sold       integer not null default 0,
  homes_sold_last_12mo   integer not null default 0,
  avg_days_on_market     integer not null default 30,
  avg_list_to_sale_ratio numeric(4,3) not null default 0.970,
  specialties            text[] not null default '{}',
  bio                    text not null default '',
  photo_url              text not null default '',
  created_at             timestamptz not null default now()
);

create index if not exists agents_zips_idx on public.agents using gin (service_zip_codes);
create index if not exists agents_created_idx on public.agents (created_at desc);

-- ------------------------------------------------------------
-- matches: scored seller ↔ agent pairings
-- ------------------------------------------------------------
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.sellers (id) on delete cascade,
  agent_id   uuid not null references public.agents (id) on delete cascade,
  score      integer not null check (score between 0 and 100),
  reasons    text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (seller_id, agent_id)
);

create index if not exists matches_seller_idx on public.matches (seller_id, score desc);
create index if not exists matches_agent_idx on public.matches (agent_id, score desc);

-- ------------------------------------------------------------
-- lead_statuses: agent-side pipeline state per match
-- ------------------------------------------------------------
create table if not exists public.lead_statuses (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  agent_id   uuid not null references public.agents (id) on delete cascade,
  seller_id  uuid not null references public.sellers (id) on delete cascade,
  status     text not null default 'new' check (status in
               ('new','contacted','appointment_set','won','lost')),
  updated_at timestamptz not null default now(),
  unique (match_id)
);

create index if not exists lead_statuses_agent_idx on public.lead_statuses (agent_id);

-- ------------------------------------------------------------
-- Row Level Security
--
-- MVP policy: permissive access for the anon key so the demo works
-- without real auth. LOCK THIS DOWN before production — replace with
-- auth.uid()-based policies once Supabase Auth is wired in.
-- ------------------------------------------------------------
alter table public.sellers enable row level security;
alter table public.agents enable row level security;
alter table public.matches enable row level security;
alter table public.lead_statuses enable row level security;

drop policy if exists "mvp full access sellers" on public.sellers;
create policy "mvp full access sellers" on public.sellers
  for all using (true) with check (true);

drop policy if exists "mvp full access agents" on public.agents;
create policy "mvp full access agents" on public.agents
  for all using (true) with check (true);

drop policy if exists "mvp full access matches" on public.matches;
create policy "mvp full access matches" on public.matches
  for all using (true) with check (true);

drop policy if exists "mvp full access lead_statuses" on public.lead_statuses;
create policy "mvp full access lead_statuses" on public.lead_statuses
  for all using (true) with check (true);
