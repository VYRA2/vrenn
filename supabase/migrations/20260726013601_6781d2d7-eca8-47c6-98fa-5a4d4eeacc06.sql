
-- 1) METAS: revoke broad SELECT, grant only public columns
DROP POLICY IF EXISTS "Metas public columns viewable" ON public.metas;
REVOKE SELECT ON public.metas FROM anon, authenticated;

GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, tipo_validacao, wearable_criterio, frequencia_tipo, frequencia_quantidade, is_seed) ON public.metas TO anon, authenticated;

-- Owner needs full read of own metas (including motivacao, valor_destino, valor_custodia, local_id)
CREATE POLICY "Owners read own metas full"
  ON public.metas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Public read of non-sensitive columns for everyone else
CREATE POLICY "Public reads metas non-sensitive"
  ON public.metas FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2) PROFILES: revoke broad SELECT, hide cpf and asaas_customer_id
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, nome, username, avatar_url, bio, nivel, creditos, streak_dias, reputacao_pts, created_at, missao, perfil_publico, idioma, unidades, categorias_interesse, onboarding_done, is_seed) ON public.profiles TO anon, authenticated;

-- Owner still needs to read own cpf/asaas_customer_id (also available via get_my_cpf RPC)
-- Column-level grant to owner only via a policy is not possible; keep existing row policy which already restricts to self OR perfil_publico.
-- Combined with column-level revoke, cpf/asaas_customer_id are unreadable by anyone directly. Owner uses RPC.

-- 3) CHECKIN_VALIDACOES: tighten read to meta owner OR the specific arbitro that authored the validacao
DROP POLICY IF EXISTS "Validacoes meta participants" ON public.checkin_validacoes;
CREATE POLICY "Validacoes owner or author arbitro"
  ON public.checkin_validacoes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = arbitro_id
    OR EXISTS (
      SELECT 1 FROM public.checkins c
      JOIN public.metas m ON m.id = c.meta_id
      WHERE c.id = checkin_validacoes.checkin_id
        AND m.user_id = auth.uid()
    )
  );

-- 4) DESAFIO_EQUIPE_PARTICIPANTES: drop redundant permissive policy
DROP POLICY IF EXISTS "dep_select" ON public.desafio_equipe_participantes;
-- "Users view own or teammates participation" remains and is properly scoped.

-- 5) DUELOS: revoke broad SELECT, hide opponent_email
REVOKE SELECT ON public.duelos FROM anon, authenticated;

GRANT SELECT (id, challenger_id, opponent_id, titulo, categoria, prazo, valor_custodia, status, progresso_challenger, progresso_opponent, winner_id, created_at, frequencia_tipo, frequencia_quantidade, challenger_eliminado, challenger_eliminado_em, opponent_eliminado, opponent_eliminado_em, is_seed, arbitro_id, arbitro_status) ON public.duelos TO authenticated;

-- 6) NOTIFICACOES: harden notify() so relationship-based tipos use fixed templates,
-- ignoring caller-supplied message content.
CREATE OR REPLACE FUNCTION public.notify(_user_id uuid, _tipo text, _mensagem text, _link_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ok boolean := false;
  _caller uuid := auth.uid();
  _nid uuid;
  _final_msg text := _mensagem;
  _allowed_tipos text[] := ARRAY[
    'apoio','cobranca','comentario','curtida',
    'convite_arbitro','checkin_para_validar',
    'desafio_duelo','follow_request'
  ];
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF _tipo IS NULL OR NOT (_tipo = ANY(_allowed_tipos)) THEN
    RAISE EXCEPTION 'invalid notification type';
  END IF;

  IF _mensagem IS NULL OR length(_mensagem) = 0 OR length(_mensagem) > 280 THEN
    RAISE EXCEPTION 'invalid notification message';
  END IF;

  IF _tipo IN ('apoio','cobranca','comentario','curtida') THEN
    _ok := true;
  ELSIF _tipo = 'convite_arbitro' THEN
    _ok := EXISTS (SELECT 1 FROM metas m WHERE m.id = _link_id AND m.user_id = _caller);
    IF _ok THEN _final_msg := 'Você foi convidado para ser árbitro de uma meta.'; END IF;
  ELSIF _tipo = 'checkin_para_validar' THEN
    _ok := EXISTS (
      SELECT 1 FROM checkins c JOIN metas m ON m.id = c.meta_id
      WHERE c.id = _link_id AND m.user_id = _caller
        AND EXISTS (SELECT 1 FROM arbitros a WHERE a.meta_id = m.id AND a.arbitro_id = _user_id AND a.status='aceito')
    );
    IF _ok THEN _final_msg := 'Novo check-in aguardando sua validação.'; END IF;
  ELSIF _tipo = 'desafio_duelo' THEN
    _ok := EXISTS (SELECT 1 FROM duelos d WHERE d.id = _link_id AND d.challenger_id = _caller AND d.opponent_id = _user_id);
    IF _ok THEN _final_msg := 'Você recebeu um novo desafio de duelo.'; END IF;
  ELSIF _tipo = 'follow_request' THEN
    _ok := EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = _caller AND f.following_id = _user_id);
    IF _ok THEN _final_msg := 'Você recebeu uma nova solicitação de seguidor.'; END IF;
  END IF;

  IF NOT _ok THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO notificacoes(user_id, tipo, mensagem, link_id)
  VALUES (_user_id, _tipo, _final_msg, _link_id)
  RETURNING id INTO _nid;
  RETURN _nid;
END $function$;
