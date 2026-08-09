-- Curiosity Engine: replaces the single hardcoded onboarding question with
-- a real, server-generated rotation. Mirrors the Understanding Engine's
-- philosophy — the client can only read and answer curiosities (see the
-- existing RLS policies), never invent or choose them. What to ask is
-- decided here, server-side, by ensure_daily_curiosity().
--
-- This also produces the subjective energy/mood data the cycle -> energy
-- Relationship rule needs to correlate against — nothing generates that
-- data today, so that rule has never had anything real to test.

-- Denormalized onto the curiosities row itself (from curiosity_bank) so
-- the client knows what Observation type to write on answer, without
-- needing read access to the bank table.
alter table public.curiosities add column observation_type text;

create table public.curiosity_bank (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  question text not null,
  purpose text not null,
  answer_options text[] not null,
  observation_type text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Static copy, not sensitive, but there's no reason to expose it to the
-- client either — RLS enabled with zero policies denies all client access;
-- only the security-definer function below (and service_role) can read it.
alter table public.curiosity_bank enable row level security;

insert into public.curiosity_bank (domain, question, purpose, answer_options, observation_type) values
  ('energy', 'How''s your energy today?',
   'This helps me understand how your energy moves through your cycle.',
   array['Low','Okay','Good','Great'], 'energy_rating'),
  ('mood', 'How''s your mood today?',
   'This helps me notice patterns in how you''re feeling.',
   array['Low','Okay','Good','Great'], 'mood_rating'),
  ('sleep', 'Did you wake up during the night?',
   'This helps me better understand your sleep today.',
   array['No','Yes','It went away'], 'sleep_interruption');

create or replace function public.ensure_daily_curiosity()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  u record;
  next_domain domain_type;
  picked record;
begin
  for u in
    select id from public.profiles where onboarded_at is not null
  loop
    -- Skip users who already have an unanswered curiosity queued.
    if exists (
      select 1 from public.curiosities where user_id = u.id and answer is null
    ) then
      continue;
    end if;

    -- Ask about whichever domain we've asked about least recently (or
    -- never), so the rotation is self-balancing rather than fixed-order.
    select cb.domain into next_domain
    from (select distinct domain from public.curiosity_bank where active) cb
    order by (
      select max(c.created_at) from public.curiosities c
      where c.user_id = u.id and c.domain = cb.domain
    ) asc nulls first
    limit 1;

    select * into picked
    from public.curiosity_bank
    where domain = next_domain and active
    order by random()
    limit 1;

    if picked.id is not null then
      insert into public.curiosities
        (user_id, question, purpose, domain, answer_options, observation_type, priority, channel)
      values
        (u.id, picked.question, picked.purpose, picked.domain, picked.answer_options,
         picked.observation_type, 0, 'today_card');
    end if;
  end loop;
end;
$$;

select cron.schedule(
  'ensure-daily-curiosity',
  '0 6 * * *', -- 06:00 UTC daily, ahead of most users' mornings
  $$ select public.ensure_daily_curiosity(); $$
);
