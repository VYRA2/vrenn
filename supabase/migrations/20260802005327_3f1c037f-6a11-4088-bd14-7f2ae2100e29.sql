CREATE OR REPLACE FUNCTION public.recusar_duelo(p_duelo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_duelo record;
BEGIN
  SELECT * INTO v_duelo FROM duelos WHERE id = p_duelo_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_duelo.opponent_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v_duelo.status <> 'pendente' THEN RAISE EXCEPTION 'duelo não está pendente'; END IF;

  UPDATE duelos SET status = 'recusado' WHERE id = p_duelo_id;

  IF COALESCE(v_duelo.valor_custodia, 0) > 0 THEN
    UPDATE wallets SET
      balance = balance + v_duelo.valor_custodia,
      locked_balance = GREATEST(0, locked_balance - v_duelo.valor_custodia),
      updated_at = now()
    WHERE user_id = v_duelo.challenger_id;
  END IF;

  INSERT INTO notificacoes (user_id, tipo, mensagem, link_id)
  VALUES (
    v_duelo.challenger_id,
    'duelo_recusado',
    'Seu duelo "' || COALESCE(v_duelo.titulo, '') || '" foi recusado.',
    p_duelo_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recusar_duelo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recusar_duelo(uuid) TO authenticated;