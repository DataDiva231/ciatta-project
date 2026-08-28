-- Intelligence cron was posting to a previous project's functions host, so
-- queued work and nightly reconciliation never reached this project's
-- understanding-engine. Point every intelligence HTTP job at this project.

-- Intelligence cron was posting to a previous project's functions host, so
-- queued work and nightly reconciliation never reached this project's
-- understanding-engine. Point every intelligence HTTP job at this project.

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'understanding-engine-nightly',
  'understanding-engine-continuous',
  'notify-discoveries-nightly'
);

select cron.schedule(
  'understanding-engine-nightly',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://pghlquiwqnknpveyssui.supabase.co/functions/v1/understanding-engine',
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

select cron.schedule(
  'understanding-engine-continuous',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://pghlquiwqnknpveyssui.supabase.co/functions/v1/understanding-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'understanding_engine_key'
      )
    ),
    body := '{"mode":"continuous"}'::jsonb
  );
  $$
);

select cron.schedule(
  'notify-discoveries-nightly',
  '10 9 * * *',
  $$
  select net.http_post(
    url := 'https://pghlquiwqnknpveyssui.supabase.co/functions/v1/notify-discoveries',
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
