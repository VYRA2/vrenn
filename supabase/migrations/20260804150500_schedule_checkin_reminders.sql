CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'CHECKIN_REMINDER_CRON_SECRET'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'CHECKIN_REMINDER_CRON_SECRET',
      'Segredo criado automaticamente para a rotina de lembretes de check-in.'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_checkin_reminder_cron_secret(_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'CHECKIN_REMINDER_CRON_SECRET'
      AND decrypted_secret = _secret
  );
$$;

REVOKE ALL ON FUNCTION public.verify_checkin_reminder_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_checkin_reminder_cron_secret(text) TO service_role;

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
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'CHECKIN_REMINDER_CRON_SECRET'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

COMMENT ON EXTENSION pg_cron IS
  'Executa a verificação de lembretes a cada cinco minutos; a função filtra pelo horário local escolhido por cada usuário.';
