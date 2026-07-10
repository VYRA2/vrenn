
-- Enable RLS on previously unprotected tables
ALTER TABLE public.fundo_temporada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locais_validacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fundo_read_authenticated" ON public.fundo_temporada
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "locais_read_authenticated" ON public.locais_validacao
  FOR SELECT TO authenticated USING (true);

-- Restrict metas SELECT to owners only; expose safe public columns via a view
DROP POLICY IF EXISTS "Metas public columns viewable" ON public.metas;
CREATE POLICY "metas_select_own" ON public.metas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.metas_public
  WITH (security_invoker = false) AS
  SELECT id, user_id, titulo, categoria, descricao, prazo, progresso,
         status, foto_capa_url, created_at
  FROM public.metas;
GRANT SELECT ON public.metas_public TO anon, authenticated;

-- Block direct updates on duelos and require RPCs for progress / response
DROP POLICY IF EXISTS "duelos_update_self_progress" ON public.duelos;
CREATE POLICY "duelos_no_direct_update" ON public.duelos
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.duelo_respond(_duelo_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.duelos;
BEGIN
  SELECT * INTO _d FROM public.duelos WHERE id = _duelo_id;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'duelo not found'; END IF;
  IF _d.opponent_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not opponent'; END IF;
  IF _d.status <> 'pendente' THEN RAISE EXCEPTION 'duelo not pending'; END IF;
  UPDATE public.duelos
     SET status = CASE WHEN _accept THEN 'em_andamento' ELSE 'recusado' END
   WHERE id = _duelo_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.duelo_respond(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duelo_respond(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.duelo_update_progresso(_duelo_id uuid, _progresso int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.duelos;
BEGIN
  IF _progresso < 0 OR _progresso > 100 THEN RAISE EXCEPTION 'invalid progresso'; END IF;
  SELECT * INTO _d FROM public.duelos WHERE id = _duelo_id;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'duelo not found'; END IF;
  IF _d.status <> 'em_andamento' THEN RAISE EXCEPTION 'duelo not active'; END IF;
  IF auth.uid() = _d.challenger_id THEN
    UPDATE public.duelos SET progresso_challenger = _progresso WHERE id = _duelo_id;
  ELSIF auth.uid() = _d.opponent_id THEN
    UPDATE public.duelos SET progresso_opponent = _progresso WHERE id = _duelo_id;
  ELSE
    RAISE EXCEPTION 'not a duel participant';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.duelo_update_progresso(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duelo_update_progresso(uuid, int) TO authenticated;

-- Pin search_path on functions that were missing it
ALTER FUNCTION public.distancia_metros(numeric, numeric, numeric, numeric) SET search_path = public;
ALTER FUNCTION public.validar_checkin() SET search_path = public;
ALTER FUNCTION public.atualizar_progresso_meta() SET search_path = public;
ALTER FUNCTION public.lock_meta_deposit() SET search_path = public;
ALTER FUNCTION public.resolve_meta_custodia() SET search_path = public;
ALTER FUNCTION public.lock_duelo_custodia() SET search_path = public;
ALTER FUNCTION public.resolve_duelo_custodia() SET search_path = public;
ALTER FUNCTION public.lock_desafio_equipe_entrada() SET search_path = public;
ALTER FUNCTION public.resolve_desafio_equipe_participante() SET search_path = public;

-- Revoke public EXECUTE on SECURITY DEFINER trigger/internal functions
REVOKE EXECUTE ON FUNCTION public.atualizar_progresso_meta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.equipe_add_criador() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_desafio_equipe_entrada() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_duelo_custodia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_meta_deposit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_duelo_challenge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_desafio_equipe_participante() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_duelo_custodia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_meta_custodia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_checkin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
