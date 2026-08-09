-- Health-source syncs (Health Connect, HealthKit) can legitimately be called
-- more than once for the same user (reconnect, manual re-sync, periodic
-- background sync). Without a dedup key, every re-sync re-inserts the same
-- historical records, silently multiplying rows the Understanding Engine
-- later aggregates. recorded_at is precise to the sample/session, so the
-- same (user, source, type, recorded_at) tuple can only ever represent the
-- same real-world reading.
alter table public.observations
  add constraint observations_dedupe_key
  unique (user_id, source, type, recorded_at);
