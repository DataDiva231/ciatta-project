-- Redesigns the onboarding conversation's "concern" step around a single
-- open question — "What would you like me to understand about you?" — with
-- no medical taxonomy exposed to the user. The taxonomy still exists, but
-- entirely behind the scenes: the client classifies free-form answers
-- against it (src/lib/healthIntent.ts) and attaches the result as
-- Observation provenance, never as something the user chooses from. This
-- reuses the exact same tables, RPC, and answer pipeline the rest of the
-- onboarding conversation already runs on — no parallel engine.
--
-- Conversation shape after this migration (unchanged tag name 'concern' so
-- nothing upstream — the backbone order, the reflection screen — needs to
-- know anything changed):
--   concern            chip-or-text, open-ended entry point
--     -> concern_elaborate   text, "tell me a little more" (skipped only if
--                            the user picked "I'm not sure yet")
--       -> concern_recency   chip, recent vs long-standing
--
-- The second hop (concern_elaborate -> concern_recency) needs to fire for
-- *any* elaboration answer, which the existing depends_on_answer_contains
-- mechanism already supports (null = always matches). The first hop needs
-- the opposite — fire for *any* answer except the "I'm not sure yet"
-- bail-out — which nothing existing supports, hence the new column below.

alter table public.curiosity_bank add column depends_on_answer_not_contains text;

-- ---------------------------------------------------------------------------
-- Rewrite the entry-point question itself. Tag stays 'concern' — this is a
-- content change, not a new step.
-- ---------------------------------------------------------------------------
update public.curiosity_bank
set
  question = 'What would you like me to understand about you?',
  purpose = 'There''s no category to pick from — just tell me what''s on your mind, in your own words.',
  answer_options = array[
    'Something has changed',
    'I''m not feeling like myself',
    'I''m trying to improve something',
    'I''m managing a health condition',
    'I''m going through a life change',
    'I''m curious about something',
    'I''m not sure yet',
    'Something else'
  ]
where tag = 'concern';

-- The old domain-named follow-ups (cycle/sleep/energy/mood/recovery) were
-- keyed to the old chip wording ("My sleep", "My cycle", ...) which no
-- longer exists, and would otherwise sit around only ever firing on a lucky
-- keyword coincidence in free text. Deactivated, not deleted, so the
-- history of what was asked is still legible.
update public.curiosity_bank
set active = false
where tag in (
  'concern_cycle_followup',
  'concern_sleep_followup',
  'concern_energy_followup',
  'concern_mood_followup',
  'concern_recovery_followup'
);

-- ---------------------------------------------------------------------------
-- The two new follow-up hops. Both filed under 'recovery' for the same
-- reason medications/supplements/health_history are: domain_type has no
-- general-context value, and these aren't about one specific domain — the
-- real, fine-grained domain classification happens client-side and lives in
-- the Observation's context, not in this column.
-- ---------------------------------------------------------------------------
insert into public.curiosity_bank
  (domain, question, purpose, answer_options, observation_type, is_onboarding, tag, input_kind)
values
  ('recovery', 'Tell me a little more. What''s changed?',
   'Your own words tell me more than a category ever could.',
   array[]::text[], 'health_concern_detail', true, 'concern_elaborate', 'text'),

  ('recovery', 'Has this been happening recently, or has it been going on for a while?',
   'This helps me tell a new pattern from a long-standing one.',
   array['Just recently', 'A few weeks', 'A few months or longer', 'It comes and goes'],
   'health_concern_recency', true, 'concern_recency', 'chip');

update public.curiosity_bank
set depends_on_tag = 'concern', depends_on_answer_not_contains = 'not sure'
where tag = 'concern_elaborate';

update public.curiosity_bank
set depends_on_tag = 'concern_elaborate'
where tag = 'concern_recency';

-- ---------------------------------------------------------------------------
-- next_onboarding_question(): identical to the previous version except the
-- follow-up lookup now also honors depends_on_answer_not_contains.
-- ---------------------------------------------------------------------------
create or replace function public.next_onboarding_question(
  p_user_id uuid,
  p_last_tag text default null,
  p_last_answer text default null
)
returns table (
  curiosity_id uuid,
  tag text,
  question text,
  purpose text,
  domain domain_type,
  answer_options text[],
  observation_type text,
  input_kind text
)
language plpgsql
security definer set search_path = public
as $$
declare
  followup public.curiosity_bank%rowtype;
  candidate public.curiosity_bank%rowtype;
  backbone_tags text[] := array['intent', 'concern', 'medications', 'supplements', 'health_history'];
  t text;
  new_id uuid;
begin
  if p_last_tag is not null then
    select * into followup
    from public.curiosity_bank cb
    where cb.active and cb.is_onboarding
      and cb.depends_on_tag = p_last_tag
      and (
        cb.depends_on_answer_contains is null
        or p_last_answer ilike '%' || cb.depends_on_answer_contains || '%'
      )
      and (
        cb.depends_on_answer_not_contains is null
        or p_last_answer not ilike '%' || cb.depends_on_answer_not_contains || '%'
      )
      and not exists (
        select 1 from public.curiosities c
        where c.user_id = p_user_id and c.channel = 'onboarding' and c.context ->> 'tag' = cb.tag
      )
    order by random()
    limit 1;

    if found then
      insert into public.curiosities
        (user_id, question, purpose, domain, answer_options, observation_type, priority, channel, context)
      values
        (p_user_id, followup.question, followup.purpose, followup.domain, followup.answer_options,
         followup.observation_type, 0, 'onboarding',
         jsonb_build_object('tag', followup.tag, 'input_kind', followup.input_kind))
      returning id into new_id;

      return query
        select new_id, followup.tag, followup.question, followup.purpose,
          followup.domain, followup.answer_options, followup.observation_type, followup.input_kind;
      return;
    end if;
  end if;

  foreach t in array backbone_tags loop
    if exists (
      select 1 from public.curiosities
      where user_id = p_user_id and channel = 'onboarding' and context ->> 'tag' = t
    ) then
      continue;
    end if;

    select * into candidate
    from public.curiosity_bank
    where active and is_onboarding and tag = t
    limit 1;

    if found then
      insert into public.curiosities
        (user_id, question, purpose, domain, answer_options, observation_type, priority, channel, context)
      values
        (p_user_id, candidate.question, candidate.purpose, candidate.domain, candidate.answer_options,
         candidate.observation_type, 0, 'onboarding',
         jsonb_build_object('tag', candidate.tag, 'input_kind', candidate.input_kind))
      returning id into new_id;

      return query
        select new_id, candidate.tag, candidate.question, candidate.purpose,
          candidate.domain, candidate.answer_options, candidate.observation_type, candidate.input_kind;
      return;
    end if;
  end loop;

  -- Every backbone tag has been asked and no follow-up unlocked — return no
  -- rows; the client reads an empty result as "the conversation is done."
end;
$$;
