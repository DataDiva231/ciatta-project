-- Ciatta core schema.
-- Models the intelligence pipeline: Observation -> Evidence -> Understanding ->
-- Relationship -> Discovery, plus Curiosity and the per-user profile captured
-- during onboarding.
--
-- Write access from the mobile client is intentionally narrow: users can only
-- write Observations (raw signal), name Discoveries, and answer Curiosities.
-- Everything in between (Evidence, Understandings, Relationships, Discovery
-- detection) is computed server-side by the Understanding Engine using the
-- service_role key, which bypasses RLS entirely.

create extension if not exists pgcrypto;

create type domain_type as enum ('sleep', 'recovery', 'energy', 'cycle', 'mood');
create type strength_type as enum ('emerging', 'moderate', 'strong', 'very-strong');
create type observation_source as enum ('apple-health', 'arc', 'manual', 'curiosity');
create type discovery_status as enum ('pending', 'named', 'dismissed');

-- ---------------------------------------------------------------------------
-- profiles: one row per user, populated during onboarding
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  preferred_name text,
  dob date,
  pronouns text,
  life_stage text,
  location text,
  about text,
  goals text[] not null default '{}',
  notification_preference text not null default 'discoveries',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- observations: raw signal from HealthKit, Arc, manual entry, or curiosity answers
-- ---------------------------------------------------------------------------
create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source observation_source not null,
  type text not null,
  value jsonb not null,
  unit text,
  recorded_at timestamptz not null,
  context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index observations_user_recorded_idx on public.observations (user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- evidence: observations aggregated and weighted per domain
-- ---------------------------------------------------------------------------
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  observation_ids uuid[] not null default '{}',
  weight numeric,
  confidence numeric,
  created_at timestamptz not null default now()
);

create index evidence_user_domain_idx on public.evidence (user_id, domain);

-- ---------------------------------------------------------------------------
-- understandings: one living row per user per domain
-- ---------------------------------------------------------------------------
create table public.understandings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  strength strength_type not null default 'emerging',
  narrative text not null default '',
  confidence_label text,
  observations_count int not null default 0,
  learning_since date,
  first_observed date,
  last_updated timestamptz not null default now(),
  still_learning text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, domain)
);

-- ---------------------------------------------------------------------------
-- understanding_history: the timeline shown in the Understanding sheet
-- ---------------------------------------------------------------------------
create table public.understanding_history (
  id uuid primary key default gen_random_uuid(),
  understanding_id uuid not null references public.understandings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_date date not null,
  label text not null,
  created_at timestamptz not null default now()
);

create index understanding_history_understanding_idx on public.understanding_history (understanding_id);

-- ---------------------------------------------------------------------------
-- relationships: cross-domain strength, e.g. recovery -> energy
-- ---------------------------------------------------------------------------
create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_domain domain_type not null,
  to_domain domain_type not null,
  strength strength_type not null default 'emerging',
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, from_domain, to_domain)
);

-- ---------------------------------------------------------------------------
-- discoveries: understandings mature enough to become a story chapter
-- ---------------------------------------------------------------------------
create table public.discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  narrative text not null,
  detail text,
  confidence numeric,
  confidence_label text,
  understanding_ids uuid[] not null default '{}',
  status discovery_status not null default 'pending',
  user_named boolean not null default false,
  discovered_at timestamptz not null default now(),
  named_at timestamptz,
  created_at timestamptz not null default now()
);

create index discoveries_user_idx on public.discoveries (user_id);

-- ---------------------------------------------------------------------------
-- curiosities: questions the engine wants answered
-- ---------------------------------------------------------------------------
create table public.curiosities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  purpose text,
  domain domain_type,
  answer_options text[] not null default '{}',
  priority int not null default 0,
  channel text,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index curiosities_user_idx on public.curiosities (user_id);

-- ---------------------------------------------------------------------------
-- housekeeping: updated_at triggers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger relationships_set_updated_at
  before update on public.relationships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auto-create a profile row whenever a new auth user signs up
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.observations enable row level security;
alter table public.evidence enable row level security;
alter table public.understandings enable row level security;
alter table public.understanding_history enable row level security;
alter table public.relationships enable row level security;
alter table public.discoveries enable row level security;
alter table public.curiosities enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

create policy "observations: read own" on public.observations
  for select using (auth.uid() = user_id);
create policy "observations: insert own" on public.observations
  for insert with check (auth.uid() = user_id);
create policy "observations: delete own" on public.observations
  for delete using (auth.uid() = user_id);

create policy "evidence: read own" on public.evidence
  for select using (auth.uid() = user_id);

create policy "understandings: read own" on public.understandings
  for select using (auth.uid() = user_id);

create policy "understanding_history: read own" on public.understanding_history
  for select using (auth.uid() = user_id);

create policy "relationships: read own" on public.relationships
  for select using (auth.uid() = user_id);

create policy "discoveries: read own" on public.discoveries
  for select using (auth.uid() = user_id);
create policy "discoveries: name own" on public.discoveries
  for update using (auth.uid() = user_id);

create policy "curiosities: read own" on public.curiosities
  for select using (auth.uid() = user_id);
create policy "curiosities: answer own" on public.curiosities
  for update using (auth.uid() = user_id);
