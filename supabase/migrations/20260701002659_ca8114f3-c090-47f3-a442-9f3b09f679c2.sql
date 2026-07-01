
-- METAS
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, valor_destino)
  ON public.metas TO anon, authenticated;
GRANT SELECT (motivacao, valor_custodia) ON public.metas TO authenticated;

DROP POLICY IF EXISTS "Metas viewable by everyone" ON public.metas;
CREATE POLICY "Metas public columns viewable"
  ON public.metas FOR SELECT USING (true);

-- PROFILES
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, nome, username, avatar_url, bio, missao, perfil_publico, idioma, unidades, created_at)
  ON public.profiles TO anon, authenticated;
GRANT SELECT (nivel, streak_dias, reputacao_pts, creditos) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Profiles readable to auth or public" ON public.profiles;
CREATE POLICY "Profiles visible to self or if public"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR perfil_publico = true);

-- DUELOS guard
CREATE OR REPLACE FUNCTION public.duelos_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  NEW.id              := OLD.id;
  NEW.challenger_id   := OLD.challenger_id;
  NEW.opponent_id     := OLD.opponent_id;
  NEW.opponent_email  := OLD.opponent_email;
  NEW.titulo          := OLD.titulo;
  NEW.categoria       := OLD.categoria;
  NEW.prazo           := OLD.prazo;
  NEW.aposta_creditos := OLD.aposta_creditos;
  NEW.status          := OLD.status;
  NEW.winner_id       := OLD.winner_id;
  NEW.created_at      := OLD.created_at;
  IF auth.uid() = OLD.challenger_id THEN
    NEW.progresso_opponent := OLD.progresso_opponent;
  ELSIF auth.uid() = OLD.opponent_id THEN
    NEW.progresso_challenger := OLD.progresso_challenger;
  ELSE
    RAISE EXCEPTION 'not a duel participant';
  END IF;
  RETURN NEW;
END $$;

-- ARBITROS guard
CREATE OR REPLACE FUNCTION public.arbitros_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  NEW.id            := OLD.id;
  NEW.meta_id       := OLD.meta_id;
  NEW.arbitro_id    := OLD.arbitro_id;
  NEW.convidado_por := OLD.convidado_por;
  NEW.created_at    := OLD.created_at;
  IF NEW.status NOT IN ('pendente','aceito','recusado') THEN
    RAISE EXCEPTION 'invalid arbitro status';
  END IF;
  RETURN NEW;
END $$;

-- NOTIFICACOES: block client inserts (server-only via SECURITY DEFINER notify())
DROP POLICY IF EXISTS "No direct client inserts" ON public.notificacoes;
CREATE POLICY "No direct client inserts"
  ON public.notificacoes FOR INSERT WITH CHECK (false);

-- TEAM visibility
DROP POLICY IF EXISTS "Membros visiveis a envolvidos" ON public.equipe_membros;
CREATE POLICY "Membros visiveis a envolvidos"
  ON public.equipe_membros FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.equipes e
    WHERE e.id = equipe_membros.equipe_id
      AND (e.publica = true OR e.criador_id = auth.uid() OR public.is_equipe_member(e.id, auth.uid()))
  ));

DROP POLICY IF EXISTS "Desafios visiveis a envolvidos" ON public.desafios_equipe;
CREATE POLICY "Desafios visiveis a envolvidos"
  ON public.desafios_equipe FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.equipes e
    WHERE e.id = desafios_equipe.equipe_id
      AND (e.publica = true OR e.criador_id = auth.uid() OR public.is_equipe_member(e.id, auth.uid()))
  ));

REVOKE SELECT ON public.equipe_membros FROM anon;
REVOKE SELECT ON public.desafios_equipe FROM anon;

-- SECURITY DEFINER function execution
REVOKE ALL ON FUNCTION public.handle_new_user()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.duelos_guard()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arbitros_guard()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equipe_add_criador() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_meta_motivacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_meta_valor_custodia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meta_valor_custodia(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_meus_creditos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meus_creditos() TO authenticated;
REVOKE ALL ON FUNCTION public.notify(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_equipe_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_equipe_member(uuid, uuid) TO authenticated;
