-- Continuous intelligence: debounce/batch queue in front of the existing
-- Understanding Engine. Observations still write exactly as they did;
-- this table is only the work-order the engine drains. Nightly
-- reconciliation (understanding-engine-nightly at 09:00 UTC) is unchanged.

create table public.intelligence_work (
  user_id uuid primary key references auth.users (id) on delete cascade,
  processors text[] not null default '{}',
  observation_types text[] not null default '{}',
  latest_observation_id uuid,
  not_before timestamptz not null default now(),
  last_run_at timestamptz,
  last_fingerprint text,
  force_run boolean not null default false,
  updated_at timestamptz not null default now()
);

create index intelligence_work_due_idx
  on public.intelligence_work (not_before)
  where cardinality(observation_types) > 0;

alter table public.intelligence_work enable row level security;

revoke all on public.intelligence_work from public, anon, authenticated;
grant all on public.intelligence_work to service_role;

-- Maps an observation type onto the existing processor names in
-- continuousIntelligence.ts. Empty / unknown types are not enqueued.
create or replace function public.intelligence_processors_for_type(obs_type text)
returns text[]
language sql
immutable
as $$
  select case obs_type
    when 'hrv' then array['recovery']
    when 'heart_rate' then array['recovery']
    when 'steps' then array['recovery']
    when 'resting_heart_rate' then array['cycle']
    when 'menstrual_flow' then array['cycle']
    when 'mood_rating' then array['mood']
    when 'energy_rating' then array['cycle', 'recovery']
    when 'health_concern' then array['contextual']
    when 'health_concern_detail' then array['contextual']
    when 'health_concern_recency' then array['contextual']
    when 'provider_assessment' then array['provider_feedback']
    when 'provider_outcome' then array['provider_feedback']
    else '{}'::text[]
  end;
$$;

create or replace function public.intelligence_debounce_for_type(obs_type text)
returns interval
language sql
immutable
as $$
  select case obs_type
    when 'mood_rating' then interval '0'
    when 'energy_rating' then interval '0'
    when 'health_concern' then interval '0'
    when 'health_concern_detail' then interval '0'
    when 'health_concern_recency' then interval '0'
    when 'provider_assessment' then interval '0'
    when 'provider_outcome' then interval '0'
    when 'hrv' then interval '2 minutes'
    when 'heart_rate' then interval '2 minutes'
    else interval '1 hour'
  end;
$$;

create or replace function public.enqueue_intelligence_work()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped text[];
  delay interval;
  force boolean;
begin
  mapped := public.intelligence_processors_for_type(NEW.type);
  if mapped is null or cardinality(mapped) = 0 then
    return NEW;
  end if;

  delay := public.intelligence_debounce_for_type(NEW.type);
  force := delay = interval '0'
    or coalesce((NEW.context->>'cycleStart')::boolean, false);

  insert into public.intelligence_work (
    user_id,
    processors,
    observation_types,
    latest_observation_id,
    not_before,
    force_run
  )
  values (
    NEW.user_id,
    mapped,
    array[NEW.type],
    NEW.id,
    case when force then now() else now() + delay end,
    force
  )
  on conflict (user_id) do update set
    processors = (
      select array(select distinct unnest(public.intelligence_work.processors || excluded.processors))
    ),
    observation_types = (
      select array(select distinct unnest(public.intelligence_work.observation_types || excluded.observation_types))
    ),
    latest_observation_id = excluded.latest_observation_id,
    not_before = least(public.intelligence_work.not_before, excluded.not_before),
    force_run = public.intelligence_work.force_run or excluded.force_run,
    updated_at = now();

  return NEW;
end;
$$;

create trigger observations_enqueue_intelligence_work
  after insert on public.observations
  for each row
  execute function public.enqueue_intelligence_work();

select cron.schedule(
  'understanding-engine-continuous',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://acqbpuxgewqvfpmtzciv.supabase.co/functions/v1/understanding-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'understanding_engine_key'
      )
    ),
    body := '{"mode":"continuous"}'::jsonb
  );
  $$
);
