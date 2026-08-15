-- Announce new discoveries shortly after the Understanding Engine runs.
-- The engine is scheduled at 09:00 UTC; this runs at 09:10 to give it time
-- to finish writing, so a discovery found this morning is announced the same
-- morning rather than a day later.
select cron.schedule(
  'notify-discoveries-nightly',
  '10 9 * * *',
  $$
  select net.http_post(
    url := 'https://acqbpuxgewqvfpmtzciv.supabase.co/functions/v1/notify-discoveries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'understanding_engine_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
