-- ============================================================================
-- SARTHI 2.0 — Production Database Schema (Supabase / PostgreSQL)
-- ============================================================================
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query
-- → paste this whole file → Run. Then run seed.sql to load demo network data.
--
-- Design mirrors the client-side demo store 1:1 so src/lib/supabaseDb.js can
-- be a near drop-in replacement for the local demo store.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES — extends auth.users with role + which entity this user runs
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('phc', 'hospital', 'ambulance', 'admin')),
  name text not null,
  entity_id text not null,       -- phc id / hospital id / ambulance id / 'district'
  entity_label text not null,
  created_at timestamptz default now()
);
alter table profiles enable row level security;

create policy "profiles: self read" on profiles for select using (auth.uid() = id);
create policy "profiles: self insert" on profiles for insert with check (auth.uid() = id);
-- Admins need to see everyone's profile to run the district dashboard & staff picker.
create policy "profiles: admin reads all" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ---------------------------------------------------------------------------
-- 2. NETWORK ENTITIES
-- ---------------------------------------------------------------------------
create table if not exists hospitals (
  id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  phone text,
  tier text,
  specialists text[] not null default '{}',
  resources jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists phcs (
  id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text
);

create table if not exists ambulances (
  id text primary key,
  code text not null,
  driver text not null,
  phc_id text references phcs(id),
  status text not null default 'available' check (status in ('available', 'dispatched')),
  referral_id uuid,
  current_lat double precision,
  current_lng double precision
);

alter table hospitals enable row level security;
alter table phcs enable row level security;
alter table ambulances enable row level security;

-- Every authenticated user needs to read the network to run the matching
-- engine and render maps; only staff of that facility (or admin) can write.
-- Facility/network directory is not sensitive (public hospital names & locations),
-- so it's readable by anyone — including signed-out visitors on the sign-up
-- form, who need this list to pick which hospital/PHC/ambulance they belong to.
create policy "hospitals: public read" on hospitals for select using (true);
create policy "hospitals: own facility updates" on hospitals for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'admin' or (p.role = 'hospital' and p.entity_id = hospitals.id)))
);
create policy "phcs: public read" on phcs for select using (true);
create policy "ambulances: public read" on ambulances for select using (true);
create policy "ambulances: own vehicle or admin updates" on ambulances for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'admin' or (p.role = 'ambulance' and p.entity_id = ambulances.id)))
);

-- ---------------------------------------------------------------------------
-- 3. REFERRALS — the core clinical + logistics record
-- ---------------------------------------------------------------------------
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  age int not null,
  gender text,
  condition text not null,
  required_resource text,
  required_specialist text,
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  notes text,

  phc_id text not null references phcs(id),
  hospital_id text references hospitals(id),
  ambulance_id text references ambulances(id),

  status text not null default 'awaiting_hospital' check (
    status in ('awaiting_hospital', 'accepted', 'arrived', 'completed', 'no_hospital_found')
  ),
  candidates jsonb not null default '[]'::jsonb,     -- ranked hospital matches, with AI reasons
  candidate_index int not null default 0,
  rejected_hospitals text[] not null default '{}',
  ai_explanation text,                                -- Gemini's natural-language ranking rationale

  reservation_expires_at timestamptz,
  dispatched_at timestamptz,
  eta_minutes_at_dispatch int,
  progress double precision not null default 0,
  current_lat double precision,
  current_lng double precision,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists referral_timeline (
  id bigint generated always as identity primary key,
  referral_id uuid not null references referrals(id) on delete cascade,
  event text not null,
  by text not null,
  ts timestamptz not null default now()
);

create table if not exists referral_events (
  id bigint generated always as identity primary key,
  referral_id uuid references referrals(id) on delete cascade,
  message text not null,
  kind text not null default 'info',
  audience jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);

-- Web Push subscriptions (real cross-device push, see functions/engine-tick)
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, subscription)
);

alter table referrals enable row level security;
alter table referral_timeline enable row level security;
alter table referral_events enable row level security;
alter table push_subscriptions enable row level security;

-- Row visibility: a user only sees referrals that touch their own entity —
-- the actual privacy boundary a real deployment needs (PHC never sees another
-- PHC's patients; a hospital only sees referrals routed to it, current or past).
create policy "referrals: role-scoped read" on referrals for select using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and (
      p.role = 'admin'
      or (p.role = 'phc' and p.entity_id = referrals.phc_id)
      or (p.role = 'hospital' and (p.entity_id = referrals.hospital_id or p.entity_id = any(referrals.rejected_hospitals)))
      or (p.role = 'ambulance' and p.entity_id = referrals.ambulance_id)
    )
  )
);
create policy "referrals: phc creates own" on referrals for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'phc' and p.entity_id = referrals.phc_id)
);
create policy "referrals: scoped update" on referrals for update using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and (
      p.role = 'admin'
      or (p.role = 'phc' and p.entity_id = referrals.phc_id)
      or (p.role = 'hospital' and p.entity_id = referrals.hospital_id)
      or (p.role = 'ambulance' and p.entity_id = referrals.ambulance_id)
    )
  )
);

create policy "timeline: follows referral visibility" on referral_timeline for select using (
  exists (select 1 from referrals r where r.id = referral_timeline.referral_id)
);
create policy "timeline: authenticated insert" on referral_timeline for insert with check (auth.role() = 'authenticated');

create policy "events: authenticated read" on referral_events for select using (auth.role() = 'authenticated');
create policy "events: authenticated insert" on referral_events for insert with check (auth.role() = 'authenticated');

create policy "push: self manage" on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Realtime — broadcast row changes to every connected dashboard
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table referrals;
alter publication supabase_realtime add table referral_events;
alter publication supabase_realtime add table hospitals;
alter publication supabase_realtime add table ambulances;

-- ---------------------------------------------------------------------------
-- 5. updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger referrals_set_updated_at before update on referrals
  for each row execute function set_updated_at();
