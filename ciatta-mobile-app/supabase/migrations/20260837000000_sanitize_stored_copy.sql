-- Sanitize stored product copy so old dashes cannot keep appearing.
-- IDs, ISO timestamps, and observation JSON are not rewritten.

create or replace function public.sanitize_user_copy(input text)
returns text
language sql
immutable
as $$
  select case
    when input is null then null
    else trim(both from regexp_replace(
      regexp_replace(
        regexp_replace(input, '[—–−]', '. ', 'g'),
        '[-‐‑‒]', ' ', 'g'
      ),
      '[ \t]+', ' ', 'g'
    ))
  end;
$$;

create or replace function public.sanitize_user_copy_array(input text[])
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(select public.sanitize_user_copy(x) from unnest(coalesce(input, '{}'::text[])) as x),
    '{}'::text[]
  );
$$;

update public.understandings set
  narrative = public.sanitize_user_copy(narrative),
  confidence_label = public.sanitize_user_copy(confidence_label),
  still_learning = public.sanitize_user_copy_array(still_learning),
  guidance = public.sanitize_user_copy(guidance),
  care_recommendation_reason = public.sanitize_user_copy(care_recommendation_reason);

update public.understanding_history set
  label = public.sanitize_user_copy(label);

update public.discoveries set
  name = public.sanitize_user_copy(name),
  narrative = public.sanitize_user_copy(narrative),
  detail = public.sanitize_user_copy(detail),
  confidence_label = public.sanitize_user_copy(confidence_label),
  suggested_names = public.sanitize_user_copy_array(suggested_names);

update public.curiosities set
  question = public.sanitize_user_copy(question),
  purpose = public.sanitize_user_copy(purpose),
  answer_options = public.sanitize_user_copy_array(answer_options);

update public.curiosity_bank set
  question = public.sanitize_user_copy(question),
  purpose = public.sanitize_user_copy(purpose),
  answer_options = public.sanitize_user_copy_array(answer_options);

update public.cross_domain_understandings set
  label = public.sanitize_user_copy(label),
  narrative = public.sanitize_user_copy(narrative),
  confidence_label = public.sanitize_user_copy(confidence_label),
  still_learning = public.sanitize_user_copy_array(still_learning),
  guidance = public.sanitize_user_copy(guidance),
  care_recommendation_reason = public.sanitize_user_copy(care_recommendation_reason);
