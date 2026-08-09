-- Schedules the Understanding Engine Edge Function to run nightly for every
-- user with relevant observations.
--
-- NOT applied yet — this depends on two things only you should do, not me:
--
-- 1. Deploy the function first:
--      supabase login
--      supabase link --project-ref acqbpuxgewqvfpmtzciv
--      supabase functions deploy understanding-engine
--
-- 2. Store the service role key in Vault yourself (from the Supabase SQL
--    editor, or your own psql session — not pasted into this file or into
--    chat):
--      select vault.create_secret('<your service_role key>', 'understanding_engine_key');
--
-- Then replace <project-ref> below with the real project ref and apply
-- this migration.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'understanding-engine-nightly',
  '0 9 * * *', -- 09:00 UTC daily
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/understanding-engine',
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
