-- Fixes a real bug found while testing the JWT/PGRST303 fix, unrelated to
-- it: next_onboarding_question()'s backbone-tag lookup queried
-- `curiosity_bank` with no alias —
--   select * into candidate from public.curiosity_bank
--   where active and is_onboarding and tag = t
-- — and `tag` is also the name of one of this function's RETURNS TABLE
-- columns, which Postgres exposes as an implicit PL/pgSQL variable in scope
-- for the whole function body. The bare `tag` was ambiguous between that
-- variable and the curiosity_bank.tag column (SQLSTATE 42702), so every
-- call that reached the backbone loop (i.e. anyone past their first
-- follow-up) failed outright with "column reference \"tag\" is ambiguous."
-- Same fix pattern as the rest of the function: alias the table and
-- qualify every column reference.
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

    -- Aliased (was bare `curiosity_bank` with unqualified `tag` — the bug).
    select * into candidate
    from public.curiosity_bank cb
    where cb.active and cb.is_onboarding and cb.tag = t
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
