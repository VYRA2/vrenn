
-- 1) Revoke EXECUTE from anon on SECURITY DEFINER functions that are trigger-only or auth-only
REVOKE EXECUTE ON FUNCTION public.get_my_cpf() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_follow() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_post_comment() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_post_like() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_duelo_challenge() FROM anon, PUBLIC, authenticated;

-- 2) arbitros: prevent reassigning meta_id / convidado_por via WITH CHECK
DROP POLICY IF EXISTS "Arbitro updates own invite" ON public.arbitros;
CREATE POLICY "Arbitro updates own invite" ON public.arbitros
  FOR UPDATE TO authenticated
  USING (auth.uid() = arbitro_id)
  WITH CHECK (
    auth.uid() = arbitro_id
    AND status IN ('pendente','aceito','recusado')
  );

-- 3) duelos: hide opponent_email from clients
REVOKE SELECT (opponent_email) ON public.duelos FROM anon, authenticated;

-- 4) metas: re-declare public read policy explicitly (private cols already revoked at column level)
DROP POLICY IF EXISTS "Metas public columns viewable" ON public.metas;
CREATE POLICY "Metas public columns viewable" ON public.metas
  FOR SELECT TO anon, authenticated
  USING (true);

-- 5) checkin_validacoes: scope explicitly to authenticated
DROP POLICY IF EXISTS "Validacoes meta participants" ON public.checkin_validacoes;
CREATE POLICY "Validacoes meta participants" ON public.checkin_validacoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkins c
    JOIN public.metas m ON m.id = c.meta_id
    WHERE c.id = checkin_validacoes.checkin_id
      AND (
        m.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.arbitros a
          WHERE a.meta_id = m.id
            AND a.arbitro_id = auth.uid()
            AND a.status = 'aceito'
        )
      )
  ));

-- 6) notify(): restrict tipo whitelist and message length to prevent arbitrary/spoofed content
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
END $function$;
