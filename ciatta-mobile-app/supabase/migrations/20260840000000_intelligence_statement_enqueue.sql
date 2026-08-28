-- Statement-level enqueue so a batched HealthKit import does not run
-- intelligence work once per sample. The work row is still one per user.
drop trigger if exists observations_enqueue_intelligence_work on public.observations;

create or replace function public.enqueue_intelligence_work_statement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  mapped text[];
  delay interval;
  force boolean;
begin
  for rec in
    select
      n.user_id,
      n.type,
      (array_agg(n.id order by n.created_at desc))[1] as latest_id,
      bool_or(coalesce((n.context->>'cycleStart')::boolean, false)) as cycle_start
    from new_rows n
    group by n.user_id, n.type
  loop
    mapped := public.intelligence_processors_for_type(rec.type);
    if mapped is null or cardinality(mapped) = 0 then
      continue;
    end if;

    delay := public.intelligence_debounce_for_type(rec.type);
    force := delay = interval '0' or rec.cycle_start;

    insert into public.intelligence_work (
      user_id,
      processors,
      observation_types,
      latest_observation_id,
      not_before,
      force_run
    )
    values (
      rec.user_id,
      mapped,
      array[rec.type],
      rec.latest_id,
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
  end loop;

  return null;
end;
$$;

create trigger observations_enqueue_intelligence_work
  after insert on public.observations
  referencing new table as new_rows
  for each statement
  execute function public.enqueue_intelligence_work_statement();
