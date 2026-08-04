CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'send-checkin-reminders'
  LIMIT 1;

  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
END $$;

SELECT cron.schedule(
  'send-checkin-reminders',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pitgdiekkshtrvlkdnvg.supabase.co/functions/v1/send-checkin-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CHECKIN_REMINDER_CRON_SECRET' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

COMMENT ON EXTENSION pg_cron IS
  'Executa a verificação de lembretes a cada cinco minutos; a função filtra pelo horário local escolhido por cada usuário.';
