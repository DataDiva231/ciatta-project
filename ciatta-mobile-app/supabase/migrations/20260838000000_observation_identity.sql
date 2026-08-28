-- Observation identity is the native sample id from the ingesting source
-- (HealthKit UUID, Health Connect metadata id, or a stable fallback for
-- manual/curiosity rows). Two devices writing the same metric at the same
-- timestamp must not collide.
alter table public.observations
  add column if not exists source_sample_id text;

update public.observations
set source_sample_id = coalesce(
  nullif(context->>'uuid', ''),
  nullif(context->>'sourceSampleId', ''),
  'legacy:' || type || ':' || recorded_at::text
)
where source_sample_id is null;

alter table public.observations
  alter column source_sample_id set not null;

alter table public.observations
  drop constraint if exists observations_dedupe_key;

alter table public.observations
  drop constraint if exists observations_identity_key;

alter table public.observations
  add constraint observations_identity_key
  unique (user_id, source, source_sample_id);
