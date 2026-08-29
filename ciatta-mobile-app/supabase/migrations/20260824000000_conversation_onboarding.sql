-- Conversation Onboarding: merges onboarding into the existing Curiosity
-- Engine rather than building a parallel system. Onboarding becomes a
-- sequence of curiosity_bank-driven questions, asked one at a time through
-- the same curiosities table and the same client-side answerCuriosity()
-- pipeline the daily rotation already uses — the only new pieces are the
-- bank rows themselves and next_onboarding_question(), which decides what
-- to ask next the same way ensure_daily_curiosity() decides what to ask
-- today: server-side, the client only ever reads and answers.

-- ---------------------------------------------------------------------------
-- profiles: two baseline biometrics the conversation collects that don't
-- already have a column (life_stage already covers reproductive stage).
-- ---------------------------------------------------------------------------
alter table public.profiles add column height_cm numeric;
alter table public.profiles add column weight_kg numeric;

-- curiosities has no context column today (only observations does) — added
-- here purely for next_onboarding_question()'s own "which tag was this"
-- bookkeeping; the client never needs to read or write it directly.
alter table public.curiosities add column context jsonb not null default '{}';

-- ---------------------------------------------------------------------------
-- curiosity_bank: enough structure to let the same table serve both the
-- existing daily rotation and an adaptive onboarding sequence.
--   is_onboarding   — keeps onboarding rows out of ensure_daily_curiosity(),
--                     which must keep behaving exactly as it did before.
--   tag             — a stable id for backbone ordering and for follow-ups
--                     to reference (curiosity_bank has no natural key
--                     usable for this; `id` is a fresh uuid per row and
--                     `question` text is too fragile to depend on).
--   depends_on_tag / depends_on_answer_contains — the adaptive part: a row
--                     with these set is only offered right after its
--                     trigger tag is answered, and only if the answer
--                     matches. This is what keeps onboarding from being a
--                     fixed questionnaire without needing an LLM in the
--                     loop — the branching is explicit and server-decided,
--                     same philosophy as the rest of this engine.
--   input_kind      — tells the client whether to default to a chip grid
--                     or a text field; chips remain available as
--                     `answer_options` either way; a row with a real
--                     answer_options list can still be typed instead, per
--                     "voice and text should feel like equal input
--                     methods" — same principle extends to chips vs typing.
-- ---------------------------------------------------------------------------
alter table public.curiosity_bank add column is_onboarding boolean not null default false;
alter table public.curiosity_bank add column tag text;
alter table public.curiosity_bank add column depends_on_tag text;
alter table public.curiosity_bank add column depends_on_answer_contains text;
alter table public.curiosity_bank add column input_kind text not null default 'chip';

-- One tag should never resolve to more than one bank row, or next_onboarding_
-- question()'s "already asked this tag" check can't tell rows apart.
create unique index curiosity_bank_tag_idx on public.curiosity_bank (tag) where tag is not null;

insert into public.curiosity_bank
  (domain, question, purpose, answer_options, observation_type, is_onboarding, tag, input_kind)
values
  ('energy', 'What brings you to Ciatta?',
   'This helps me know what to focus on first.',
   array[
     'I want to understand my energy.',
     'I want to understand my cycle.',
     'I''m preparing for pregnancy.',
     'I''m entering menopause.',
     'I simply want to understand my body better.'
   ],
   'primary_intent', true, 'intent', 'chip'),

  ('energy', 'Is there anything on your mind about your body right now?',
   'This helps me know where to start paying attention.',
   array['My energy', 'My sleep', 'My mood', 'My cycle', 'Recovery & fatigue', 'Nothing specific right now'],
   'health_concern', true, 'concern', 'chip'),

  -- domain_type has no "general context" value, so medications/supplements/
  -- health-history — none of which are one specific domain — are filed
  -- under 'recovery' as the closest fit; it's a required column, not a
  -- meaningful categorization for these three.
  ('recovery', 'Are you currently taking any medications?',
   'Some medications change how your body responds — this helps me tell a pattern from a side effect.',
   array['None right now'],
   'medications', true, 'medications', 'text'),

  ('recovery', 'What about supplements?',
   'Supplements can influence energy, sleep and cycle symptoms just like medications can.',
   array['None right now'],
   'supplements', true, 'supplements', 'text'),

  ('recovery', 'Is there any health history or condition I should know about?',
   'This gives me context so I don''t mistake a known condition for a new pattern.',
   array['Nothing to add'],
   'health_history', true, 'health_history', 'text'),

  -- Follow-ups: only ever offered right after 'concern' is answered with a
  -- matching value. Each is its own tag so it's only asked once.
  ('cycle', 'Are your cycles fairly regular, or do they vary a lot?',
   'This helps me judge what "normal" looks like for you specifically.',
   array['Pretty regular', 'They vary a lot', 'I''m not tracking them', 'Not applicable right now'],
   'cycle_regularity', true, 'concern_cycle_followup', 'chip'),

  ('sleep', 'How many nights a week do you struggle to fall or stay asleep?',
   'This helps me understand how much sleep is actually costing you.',
   array['Rarely', '1-2 nights', '3-4 nights', 'Most nights'],
   'sleep_difficulty', true, 'concern_sleep_followup', 'chip'),

  ('energy', 'When is your energy lowest?',
   'This helps me look for a rhythm rather than treating every low day the same.',
   array['Mornings', 'Afternoons', 'Evenings', 'It''s unpredictable'],
   'energy_low_time', true, 'concern_energy_followup', 'chip'),

  ('mood', 'Does your mood tend to shift with your cycle?',
   'This helps me know whether to look for a cyclical pattern.',
   array['Yes, noticeably', 'A little', 'Not that I''ve noticed', 'I''m not sure'],
   'mood_cycle_correlation', true, 'concern_mood_followup', 'chip'),

  ('recovery', 'Do you feel like you recover slower than you used to?',
   'This helps me pay attention to recovery specifically, not just activity.',
   array['Yes', 'No', 'Hard to say'],
   'recovery_speed', true, 'concern_recovery_followup', 'chip');

update public.curiosity_bank set depends_on_tag = 'concern', depends_on_answer_contains = 'cycle'
  where tag = 'concern_cycle_followup';
update public.curiosity_bank set depends_on_tag = 'concern', depends_on_answer_contains = 'sleep'
  where tag = 'concern_sleep_followup';
update public.curiosity_bank set depends_on_tag = 'concern', depends_on_answer_contains = 'energy'
  where tag = 'concern_energy_followup';
update public.curiosity_bank set depends_on_tag = 'concern', depends_on_answer_contains = 'mood'
  where tag = 'concern_mood_followup';
update public.curiosity_bank set depends_on_tag = 'concern', depends_on_answer_contains = 'recovery'
  where tag = 'concern_recovery_followup';

-- ---------------------------------------------------------------------------
-- ensure_daily_curiosity(): unchanged behavior, scoped to explicitly exclude
-- the new onboarding-only rows so the daily rotation can never surface
-- "are you taking any medications?" as a today_card.
-- ---------------------------------------------------------------------------
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
    if exists (
      select 1 from public.curiosities where user_id = u.id and answer is null
    ) then
      continue;
    end if;

    select cb.domain into next_domain
    from (select distinct domain from public.curiosity_bank where active and not is_onboarding) cb
    order by (
      select max(c.created_at) from public.curiosities c
      where c.user_id = u.id and c.domain = cb.domain
    ) asc nulls first
    limit 1;

    select * into picked
    from public.curiosity_bank
    where domain = next_domain and active and not is_onboarding
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

-- ---------------------------------------------------------------------------
-- next_onboarding_question(): the onboarding equivalent of
-- ensure_daily_curiosity() — decides what to ask next, inserts the queued
-- curiosities row itself (mirroring how the daily function does it), and
-- returns it so the client can render + later answer it through the
-- existing pipeline. Returns no rows once nothing is left to ask.
--
-- Call shape: first call with p_last_tag/p_last_answer null; each
-- subsequent call passes the tag and answer just given, so a follow-up
-- unlocked by that answer is offered before the fixed backbone resumes.
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

grant execute on function public.next_onboarding_question(uuid, text, text) to authenticated;
