-- Auditoria administrativa e fechamento dos vetores financeiros restantes.

CREATE OR REPLACE FUNCTION public.vrenn_wallet_custody_reconciliation()
RETURNS TABLE(user_id uuid,balance numeric,locked_balance numeric,metas numeric,equipes numeric,duelos numeric,esperado numeric,diferenca numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH meta AS (
    SELECT m.user_id,COALESCE(SUM(m.valor_custodia),0) total FROM public.metas m
    WHERE COALESCE(m.valor_custodia,0)>0 AND NOT m.custodia_resolvida
      AND m.status NOT IN('concluida','falhada') GROUP BY m.user_id
  ), team AS (
    SELECT p.user_id,COALESCE(SUM(d.valor_entrada),0) total
    FROM public.desafio_equipe_participantes p JOIN public.desafios_equipe d ON d.id=p.desafio_id
    WHERE COALESCE(d.valor_entrada,0)>0 AND NOT p.custodia_resolvida GROUP BY p.user_id
  ), duel AS (
    SELECT x.user_id,COALESCE(SUM(x.valor_custodia),0) total FROM (
      SELECT challenger_id user_id,valor_custodia FROM public.duelos
      WHERE status IN('ativo','em_andamento') AND NOT custodia_resolvida AND COALESCE(valor_custodia,0)>0
      UNION ALL
      SELECT opponent_id,valor_custodia FROM public.duelos
      WHERE opponent_id IS NOT NULL AND status IN('ativo','em_andamento')
        AND NOT custodia_resolvida AND COALESCE(valor_custodia,0)>0
    ) x GROUP BY x.user_id
  )
  SELECT w.user_id,w.balance,w.locked_balance,COALESCE(m.total,0),COALESCE(t.total,0),COALESCE(d.total,0),
    COALESCE(m.total,0)+COALESCE(t.total,0)+COALESCE(d.total,0),
    w.locked_balance-(COALESCE(m.total,0)+COALESCE(t.total,0)+COALESCE(d.total,0))
  FROM public.wallets w LEFT JOIN meta m ON m.user_id=w.user_id
  LEFT JOIN team t ON t.user_id=w.user_id LEFT JOIN duel d ON d.user_id=w.user_id
  WHERE NOT COALESCE(w.is_seed,false);
$$;
REVOKE ALL ON FUNCTION public.vrenn_wallet_custody_reconciliation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_wallet_custody_reconciliation() TO service_role;

CREATE OR REPLACE FUNCTION public.vrenn_admin_financial_audit()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _wallets jsonb; _pending jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM '52fd9ebb-5d88-4b33-acc3-97b70c62a426'::uuid THEN
    RAISE EXCEPTION 'acesso restrito ao administrador';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY ABS(r.diferenca) DESC),'[]') INTO _wallets
  FROM public.vrenn_wallet_custody_reconciliation() r WHERE r.diferenca<>0;
  SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]') INTO _pending
  FROM public.vrenn_team_duel_custody_audit() a;
  RETURN jsonb_build_object('carteiras_divergentes',_wallets,'custodias_pendentes',_pending,'gerado_em',now());
END; $$;
REVOKE ALL ON FUNCTION public.vrenn_admin_financial_audit() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vrenn_admin_financial_audit() TO authenticated;

-- O token é sempre criado no banco e não pode ser escolhido ou trocado pelo cliente.
CREATE OR REPLACE FUNCTION public.vrenn_guard_qrcode_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.qrcode_token:=gen_random_uuid();
  ELSE NEW.qrcode_token:=OLD.qrcode_token; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_vrenn_guard_qrcode_token ON public.locais_validacao;
CREATE TRIGGER trg_vrenn_guard_qrcode_token BEFORE INSERT OR UPDATE ON public.locais_validacao
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_qrcode_token();

-- Entrada na temporada: taxa exata, débito, participação e extrato na mesma transação.
CREATE OR REPLACE FUNCTION public.vrenn_join_temporada(_temporada_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid:=auth.uid(); _season public.temporadas; _wallet public.wallets; _participant uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'autenticação obrigatória'; END IF;
  SELECT * INTO _season FROM public.temporadas WHERE id=_temporada_id FOR UPDATE;
  IF _season.id IS NULL OR _season.status<>'ativa' THEN RAISE EXCEPTION 'temporada indisponível'; END IF;
  IF EXISTS(SELECT 1 FROM public.temporada_participantes WHERE temporada_id=_temporada_id AND user_id=_uid) THEN
    RAISE EXCEPTION 'você já participa desta temporada';
  END IF;
  SELECT * INTO _wallet FROM public.wallets WHERE user_id=_uid FOR UPDATE;
  IF _wallet.id IS NULL OR _wallet.balance<COALESCE(_season.taxa_entrada,0) THEN
    RAISE EXCEPTION 'saldo insuficiente para a taxa de inscrição';
  END IF;
  UPDATE public.wallets SET balance=balance-COALESCE(_season.taxa_entrada,0),updated_at=now() WHERE id=_wallet.id;
  INSERT INTO public.temporada_participantes(temporada_id,user_id,taxa_paga,valor_custodia,termo_aceito_em)
  VALUES(_temporada_id,_uid,COALESCE(_season.taxa_entrada,0),0,now()) RETURNING id INTO _participant;
  IF COALESCE(_season.taxa_entrada,0)>0 THEN
    INSERT INTO public.transactions(user_id,amount,type,description,reference_id,status)
    VALUES(_uid,_season.taxa_entrada,'fee','Taxa de inscrição — VRENN Master Season '||_season.numero,
      _temporada_id,'confirmed');
  END IF;
  RETURN jsonb_build_object('status','inscrito','participante_id',_participant,'taxa',_season.taxa_entrada);
END; $$;
REVOKE ALL ON FUNCTION public.vrenn_join_temporada(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vrenn_join_temporada(uuid) TO authenticated;

-- Toda inscrição comum deve passar pela RPC atômica acima.
REVOKE INSERT,UPDATE,DELETE ON public.temporada_participantes FROM anon,authenticated;
GRANT ALL ON public.temporada_participantes TO service_role;
