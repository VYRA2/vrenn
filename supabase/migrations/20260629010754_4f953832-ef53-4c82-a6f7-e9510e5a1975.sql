
-- 1) PROFILES: novos campos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS missao text,
  ADD COLUMN IF NOT EXISTS perfil_publico boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS unidades text NOT NULL DEFAULT 'kg';

-- 2) FOLLOWS: status para aprovação em perfis privados + unicidade
ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aceito';
CREATE UNIQUE INDEX IF NOT EXISTS follows_unique_pair ON public.follows(follower_id, following_id);

-- Permitir dono aceitar/recusar follow request
DROP POLICY IF EXISTS "Owner manages follow requests" ON public.follows;
CREATE POLICY "Owner manages follow requests" ON public.follows
  FOR UPDATE USING (auth.uid() = following_id);

-- 3) APOIOS
CREATE TABLE IF NOT EXISTS public.apoios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_id uuid NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, meta_id)
);
GRANT SELECT, INSERT, DELETE ON public.apoios TO authenticated;
GRANT ALL ON public.apoios TO service_role;
ALTER TABLE public.apoios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Apoios visible to all" ON public.apoios;
CREATE POLICY "Apoios visible to all" ON public.apoios FOR SELECT USING (true);
DROP POLICY IF EXISTS "User apoia" ON public.apoios;
CREATE POLICY "User apoia" ON public.apoios FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "User remove apoio" ON public.apoios;
CREATE POLICY "User remove apoio" ON public.apoios FOR DELETE USING (auth.uid() = user_id);

-- 4) USER_SEARCHES (buscas recentes)
CREATE TABLE IF NOT EXISTS public.user_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  termo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.user_searches TO authenticated;
GRANT ALL ON public.user_searches TO service_role;
ALTER TABLE public.user_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own searches" ON public.user_searches;
CREATE POLICY "Own searches" ON public.user_searches FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Insert own searches" ON public.user_searches;
CREATE POLICY "Insert own searches" ON public.user_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Delete own searches" ON public.user_searches;
CREATE POLICY "Delete own searches" ON public.user_searches FOR DELETE USING (auth.uid() = user_id);

-- 5) METAS: esconder coluna motivacao via grants por coluna
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, valor_custodia, valor_destino)
  ON public.metas TO anon, authenticated;

-- Função para o dono ler a própria motivação
CREATE OR REPLACE FUNCTION public.get_meta_motivacao(_meta_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT motivacao FROM public.metas
  WHERE id = _meta_id AND user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) TO authenticated;

-- 6) CHECKIN_VALIDACOES: visível apenas a dono da meta e árbitros daquela meta
DROP POLICY IF EXISTS "Validacoes viewable by signed in" ON public.checkin_validacoes;
CREATE POLICY "Validacoes meta participants" ON public.checkin_validacoes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.checkins c
    JOIN public.metas m ON m.id = c.meta_id
    WHERE c.id = checkin_validacoes.checkin_id
      AND (m.user_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.arbitros a
                      WHERE a.meta_id = m.id AND a.arbitro_id = auth.uid() AND a.status = 'aceito'))
  )
);

-- 7) DUELOS: cada participante atualiza apenas o próprio progresso, vencedor só por service_role
DROP POLICY IF EXISTS duelos_update_participants ON public.duelos;
CREATE POLICY duelos_update_self_progress ON public.duelos FOR UPDATE
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
  WITH CHECK (
    auth.uid() = challenger_id OR auth.uid() = opponent_id
  );

CREATE OR REPLACE FUNCTION public.duelos_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() = NEW.challenger_id THEN
    NEW.progresso_opponent := OLD.progresso_opponent;
    NEW.opponent_id := OLD.opponent_id;
  ELSIF auth.uid() = NEW.opponent_id THEN
    NEW.progresso_challenger := OLD.progresso_challenger;
    NEW.challenger_id := OLD.challenger_id;
  END IF;
  -- winner_id e status só por service_role
  NEW.winner_id := OLD.winner_id;
  NEW.status := OLD.status;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS duelos_guard_trg ON public.duelos;
CREATE TRIGGER duelos_guard_trg BEFORE UPDATE ON public.duelos
  FOR EACH ROW EXECUTE FUNCTION public.duelos_guard();

-- 8) NOTIFICACOES: bloquear INSERT direto pelo usuário; expor função controlada
DROP POLICY IF EXISTS "Insert notif via meta relationship" ON public.notificacoes;

CREATE OR REPLACE FUNCTION public.notify(
  _user_id uuid,
  _tipo text,
  _mensagem text,
  _link_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean := false;
  _caller uuid := auth.uid();
  _nid uuid;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF _tipo IN ('apoio','cobranca','comentario','curtida') THEN
    _ok := true;
  ELSIF _tipo = 'convite_arbitro' THEN
    _ok := EXISTS (SELECT 1 FROM metas m WHERE m.id = _link_id AND m.user_id = _caller);
  ELSIF _tipo = 'checkin_para_validar' THEN
    _ok := EXISTS (
      SELECT 1 FROM checkins c JOIN metas m ON m.id = c.meta_id
      WHERE c.id = _link_id AND m.user_id = _caller
        AND EXISTS (SELECT 1 FROM arbitros a WHERE a.meta_id = m.id AND a.arbitro_id = _user_id AND a.status='aceito')
    );
  ELSIF _tipo = 'desafio_duelo' THEN
    _ok := EXISTS (SELECT 1 FROM duelos d WHERE d.id = _link_id AND d.challenger_id = _caller AND d.opponent_id = _user_id);
  ELSIF _tipo = 'follow_request' THEN
    _ok := EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = _caller AND f.following_id = _user_id);
  END IF;

  IF NOT _ok THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO notificacoes(user_id, tipo, mensagem, link_id)
  VALUES (_user_id, _tipo, _mensagem, _link_id)
  RETURNING id INTO _nid;
  RETURN _nid;
END $$;
GRANT EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) TO authenticated;
