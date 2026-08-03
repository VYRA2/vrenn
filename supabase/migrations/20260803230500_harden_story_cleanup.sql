-- Protege a rotina automática de expiração dos stories e aplica validações no servidor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Segredos usados pelo pg_cron ficam no Vault, nunca no comando do job.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'story_cleanup_token'
  ) THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'story_cleanup_token',
      'Token interno da rotina de limpeza dos stories'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'story_cleanup_project_url'
  ) THEN
    PERFORM vault.create_secret(
      'https://pitgdiekkshtrvlkdnvg.supabase.co',
      'story_cleanup_project_url',
      'URL do projeto usada pelo cron de stories'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'story_cleanup_publishable_key'
  ) THEN
    PERFORM vault.create_secret(
      'sb_publishable_WKygjpu9wiB4aRJCpSMPMA_SV98Lvh0',
      'story_cleanup_publishable_key',
      'Chave pública usada pelo gateway da Edge Function'
    );
  END IF;
END
$migration$;

-- Somente a Edge Function, autenticada como service_role, pode ler o token.
CREATE OR REPLACE FUNCTION public.get_story_cleanup_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'story_cleanup_token'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_story_cleanup_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_story_cleanup_token() TO service_role;

-- Restrições do bucket também são aplicadas no servidor.
UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4'
  ]::text[]
WHERE id = 'stories';

-- Garante que registros inválidos não entrem por chamadas diretas à API.
ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_media_type_allowed;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_media_type_allowed
  CHECK (media_type IN ('photo', 'video', 'text'))
  NOT VALID;

ALTER TABLE public.stories
  VALIDATE CONSTRAINT stories_media_type_allowed;

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_content_matches_type;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_content_matches_type
  CHECK (
    (
      media_type = 'text'
      AND nullif(btrim(text_content), '') IS NOT NULL
      AND media_url IS NULL
    )
    OR
    (
      media_type IN ('photo', 'video')
      AND nullif(btrim(media_url), '') IS NOT NULL
    )
  )
  NOT VALID;

ALTER TABLE public.stories
  VALIDATE CONSTRAINT stories_content_matches_type;

-- Substitui o header previsível pelo token aleatório armazenado no Vault.
SELECT cron.unschedule('cleanup-expired-stories')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-stories'
);

SELECT cron.schedule(
  'cleanup-expired-stories',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'story_cleanup_project_url'
      LIMIT 1
    ) || '/functions/v1/cleanup-expired-stories',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'story_cleanup_publishable_key'
        LIMIT 1
      ),
      'x-vrenn-cron-token', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'story_cleanup_token'
        LIMIT 1
      )
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
