-- Schedules the Understanding Engine Edge Function to run nightly for every
-- user with relevant observations.
--
-- Prerequisites (both done): function deployed as `understanding-engine`,
-- and the service_role key stored in Vault under the name
-- 'understanding_engine_key'.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'understanding-engine-nightly',
  '0 9 * * *', -- 09:00 UTC daily
  $$
  select net.http_post(
    url := 'https://acqbpuxgewqvfpmtzciv.supabase.co/functions/v1/understanding-engine',
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
