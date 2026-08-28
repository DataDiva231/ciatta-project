-- Upsert from the app (HealthKit sync) needs UPDATE as well as INSERT.
-- Without this, ON CONFLICT rows are rejected by RLS even when the user
-- owns the observation.
create policy "observations: update own" on public.observations
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
