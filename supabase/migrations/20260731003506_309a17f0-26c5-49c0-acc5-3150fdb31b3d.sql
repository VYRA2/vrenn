-- ========== BUG 1: duelos ==========
DROP POLICY IF EXISTS "duelos_insert_challenger" ON public.duelos;
DROP POLICY IF EXISTS "duelos_no_direct_update" ON public.duelos;
DROP POLICY IF EXISTS "duelos_select_participants" ON public.duelos;
DROP POLICY IF EXISTS "usuarios podem atualizar seus duelos" ON public.duelos;
DROP POLICY IF EXISTS "usuarios podem criar duelos" ON public.duelos;
DROP POLICY IF EXISTS "usuarios podem ver seus duelos" ON public.duelos;

ALTER TABLE public.duelos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duelos TO authenticated;
GRANT ALL ON public.duelos TO service_role;
REVOKE ALL ON public.duelos FROM anon;

CREATE POLICY "duelos_insert_challenger" ON public.duelos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "duelos_select_participants" ON public.duelos
  FOR SELECT TO authenticated USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
CREATE POLICY "duelos_update_participants" ON public.duelos
  FOR UPDATE TO authenticated USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
CREATE POLICY "duelos_delete_challenger" ON public.duelos
  FOR DELETE TO authenticated USING (auth.uid() = challenger_id);

-- ========== BUG 2: mensagens ==========
-- Gatilho quebrado: referencia NEW.user_id / NEW.conteudo (colunas inexistentes)
-- e current_setting('app.supabase_url') indefinido -> todo INSERT falhava.
DROP TRIGGER IF EXISTS trg_push_mensagem ON public.mensagens;
DROP FUNCTION IF EXISTS public.notify_push_mensagem();

-- ========== STORIES ==========
ALTER TABLE public.stories ALTER COLUMN media_url DROP NOT NULL;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'photo';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS text_content text;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS bg_gradient text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='story_views' AND column_name='user_id') THEN
    ALTER TABLE public.story_views RENAME COLUMN user_id TO viewer_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='story_views' AND column_name='created_at') THEN
    ALTER TABLE public.story_views RENAME COLUMN created_at TO viewed_at;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS story_views_unique ON public.story_views (story_id, viewer_id);
CREATE INDEX IF NOT EXISTS stories_active_idx ON public.stories (expires_at, user_id);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
REVOKE ALL ON public.stories FROM anon;
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
REVOKE ALL ON public.story_views FROM anon;

DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
DROP POLICY IF EXISTS "views_own_insert" ON public.story_views;
DROP POLICY IF EXISTS "views_own_select" ON public.story_views;

CREATE POLICY "stories_insert_own" ON public.stories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete_own" ON public.stories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "stories_select_visible" ON public.stories
  FOR SELECT TO authenticated USING (
    expires_at > now() AND (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = stories.user_id AND p.perfil_publico = true)
      OR EXISTS (SELECT 1 FROM public.follows f WHERE f.following_id = stories.user_id AND f.follower_id = auth.uid() AND f.status = 'aceito')
    )
  );

CREATE POLICY "story_views_insert_own" ON public.story_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "story_views_select" ON public.story_views
  FOR SELECT TO authenticated USING (
    auth.uid() = viewer_id
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
  );