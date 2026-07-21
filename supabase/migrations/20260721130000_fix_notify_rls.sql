-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Fix RLS notificacoes: expandir notify() para todos os tipos
-- ═══════════════════════════════════════════════════════════════════
-- Problema: policy "No direct client inserts" (WITH CHECK false) bloqueia
-- todos os supabase.from("notificacoes").insert() do frontend. A solução
-- é passar tudo pela função SECURITY DEFINER notify() que tem bypass de RLS.
-- Esta migration expande o whitelist de tipos aceitos pela função.

CREATE OR REPLACE FUNCTION public.notify(
  _user_id uuid,
  _tipo text,
  _mensagem text,
  _link_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _nid uuid;
  _allowed_tipos text[] := ARRAY[
    'like', 'comment', 'follow',
    'convite_arbitro', 'arbitro_aceitou', 'arbitro_recusou',
    'checkin_para_validar', 'checkin_validado', 'checkin_questionado',
    'convite_duelo', 'desafio_duelo',
    'novo_desafio_equipe', 'equipe_atualizada',
    'justificativa_pendente', 'justificativa_resultado',
    'apoio', 'cobranca', 'comentario', 'curtida',
    'follow_request', 'achievement'
  ];
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _tipo IS NULL OR NOT (_tipo = ANY(_allowed_tipos)) THEN
    RAISE EXCEPTION 'invalid notification type: %', _tipo;
  END IF;

  IF _mensagem IS NULL OR length(_mensagem) = 0 OR length(_mensagem) > 500 THEN
    RAISE EXCEPTION 'invalid notification message';
  END IF;

  INSERT INTO notificacoes (user_id, tipo, mensagem, link_id)
  VALUES (_user_id, _tipo, _mensagem, _link_id)
  RETURNING id INTO _nid;

  RETURN _nid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) TO authenticated;

-- Manter policy de bloqueio direto (segurança — tudo passa pela RPC)
DROP POLICY IF EXISTS "No direct client inserts" ON public.notificacoes;
CREATE POLICY "No direct client inserts"
  ON public.notificacoes FOR INSERT WITH CHECK (false);

