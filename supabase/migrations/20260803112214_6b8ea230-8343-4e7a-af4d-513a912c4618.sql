-- 1) Fila de arquivos a remover do bucket
CREATE TABLE IF NOT EXISTS public.story_storage_cleanup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

REVOKE ALL ON public.story_storage_cleanup_queue FROM anon, authenticated;
GRANT ALL ON public.story_storage_cleanup_queue TO service_role;

ALTER TABLE public.story_storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS story_storage_cleanup_queue_pending_idx
  ON public.story_storage_cleanup_queue (created_at) WHERE processed_at IS NULL;

-- 2) Trigger BEFORE DELETE em stories -> enfileira media_url
CREATE OR REPLACE FUNCTION public.enqueue_story_media_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.media_url IS NOT NULL AND OLD.media_url <> '' AND OLD.media_url NOT LIKE 'http%' THEN
    INSERT INTO public.story_storage_cleanup_queue (path) VALUES (OLD.media_url);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_story_media_cleanup ON public.stories;
CREATE TRIGGER trg_enqueue_story_media_cleanup
BEFORE DELETE ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.enqueue_story_media_cleanup();

-- 3) Estado interno de manutenção (trava + rate limit)
CREATE TABLE IF NOT EXISTS public.story_cleanup_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  running boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  last_run_at timestamptz
);

REVOKE ALL ON public.story_cleanup_state FROM anon, authenticated;
GRANT ALL ON public.story_cleanup_state TO service_role;
ALTER TABLE public.story_cleanup_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.story_cleanup_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.try_begin_story_cleanup()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _ok boolean := false;
BEGIN
  UPDATE public.story_cleanup_state
     SET running = true, started_at = now()
   WHERE id = true
     AND (running = false OR started_at < now() - interval '10 minutes')
     AND (last_run_at IS NULL OR last_run_at < now() - interval '5 minutes')
  RETURNING true INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.end_story_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.story_cleanup_state
     SET running = false, last_run_at = now()
   WHERE id = true;
END;
$$;

REVOKE ALL ON FUNCTION public.try_begin_story_cleanup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.end_story_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_begin_story_cleanup() TO service_role;
GRANT EXECUTE ON FUNCTION public.end_story_cleanup() TO service_role;

-- 4) Agendamento a cada 15 minutos
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('cleanup-expired-stories')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-stories');

SELECT cron.schedule(
  'cleanup-expired-stories',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pitgdiekkshtrvlkdnvg.supabase.co/functions/v1/cleanup-expired-stories',
    headers := '{"Content-Type":"application/json","x-vrenn-cron":"story-cleanup","apikey":"sb_publishable_WKygjpu9wiB4aRJCpSMPMA_SV98Lvh0"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );
  $$
);