-- Corrige e torna idempotente o ciclo financeiro de metas.
-- Regra vigente: conclusão devolve 97% e cobra 3%; falha destina 75% ao fundo e 25% à taxa.

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS custodia_resolvida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custodia_resolvida_em timestamptz;

-- O extrato precisa registrar também a entrada em custódia.
INSERT INTO public.transactions (user_id, type, amount, status, description, meta_id)
SELECT m.user_id, 'lock', m.valor_custodia, 'confirmed', 'Custódia bloqueada — meta criada', m.id
FROM public.metas m
WHERE COALESCE(m.valor_custodia, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.meta_id = m.id AND t.type = 'lock'
  );

CREATE UNIQUE INDEX IF NOT EXISTS transactions_meta_lock_once_idx
  ON public.transactions(meta_id, type)
  WHERE meta_id IS NOT NULL AND type = 'lock';

CREATE UNIQUE INDEX IF NOT EXISTS transactions_meta_unlock_once_idx
  ON public.transactions(meta_id, type)
  WHERE meta_id IS NOT NULL AND type = 'unlock';

-- Marca liquidações históricas comprovadas pelo extrato, sem movimentar saldo novamente.
UPDATE public.metas m
SET custodia_resolvida = true,
    custodia_resolvida_em = COALESCE(
      (SELECT MAX(t.created_at) FROM public.transactions t
       WHERE t.meta_id = m.id AND t.type IN ('unlock', 'fee', 'prize')),
      now()
    )
WHERE COALESCE(m.valor_custodia, 0) > 0
  AND m.status IN ('concluida', 'falhada')
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.meta_id = m.id
      AND (
        (m.status = 'concluida' AND t.type = 'unlock')
        OR (m.status = 'falhada' AND t.type IN ('fee', 'prize'))
      )
  );

CREATE OR REPLACE FUNCTION public.lock_meta_deposit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.valor_custodia, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.wallets
  SET balance = balance - NEW.valor_custodia,
      locked_balance = locked_balance + NEW.valor_custodia,
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND balance >= NEW.valor_custodia;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo insuficiente para custodiar R$ %.', NEW.valor_custodia;
  END IF;

  INSERT INTO public.transactions(user_id, type, amount, status, description, meta_id)
  VALUES (NEW.user_id, 'lock', NEW.valor_custodia, 'confirmed', 'Custódia bloqueada — meta criada', NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_settle_meta_custody(_meta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _m public.metas;
  _wallet public.wallets;
  _return numeric(12,2);
  _fee numeric(12,2);
  _fund numeric(12,2);
BEGIN
  SELECT * INTO _m FROM public.metas WHERE id = _meta_id FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'meta não encontrada'; END IF;
  IF COALESCE(_m.valor_custodia, 0) <= 0 THEN
    UPDATE public.metas SET custodia_resolvida = true, custodia_resolvida_em = now()
    WHERE id = _meta_id AND NOT custodia_resolvida;
    RETURN jsonb_build_object('status', 'sem_custodia');
  END IF;
  IF _m.custodia_resolvida THEN
    RETURN jsonb_build_object('status', 'ja_resolvida');
  END IF;
  IF _m.status NOT IN ('concluida', 'falhada') THEN
    RETURN jsonb_build_object('status', 'pendente');
  END IF;

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _m.user_id FOR UPDATE;
  IF _wallet.id IS NULL THEN RAISE EXCEPTION 'carteira não encontrada'; END IF;
  IF _wallet.locked_balance < _m.valor_custodia THEN
    RAISE EXCEPTION 'custódia inconsistente: bloqueado R$ %, esperado R$ %',
      _wallet.locked_balance, _m.valor_custodia;
  END IF;

  IF _m.status = 'concluida' THEN
    _fee := ROUND(_m.valor_custodia * 0.03, 2);
    _return := _m.valor_custodia - _fee;

    UPDATE public.wallets
    SET balance = balance + _return,
        locked_balance = locked_balance - _m.valor_custodia,
        updated_at = now()
    WHERE id = _wallet.id;

    INSERT INTO public.transactions(user_id, type, amount, status, description, meta_id)
    VALUES (_m.user_id, 'unlock', _return, 'confirmed', 'Devolução de custódia — meta concluída', _m.id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.transactions(user_id, type, amount, status, description, meta_id)
    SELECT _m.user_id, 'fee', _fee, 'confirmed', 'Taxa VRENN (3%) — meta concluída', _m.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.meta_id = _m.id AND t.type = 'fee'
    );
  ELSE
    _fund := ROUND(_m.valor_custodia * 0.75, 2);
    _fee := _m.valor_custodia - _fund;

    UPDATE public.wallets
    SET locked_balance = locked_balance - _m.valor_custodia,
        updated_at = now()
    WHERE id = _wallet.id;

    UPDATE public.fundo_temporada
    SET valor_acumulado = valor_acumulado + _fund, updated_at = now();
    IF NOT FOUND THEN
      INSERT INTO public.fundo_temporada(valor_acumulado) VALUES (_fund);
    END IF;

    INSERT INTO public.transactions(user_id, type, amount, status, description, meta_id)
    SELECT _m.user_id, 'prize', _fund, 'confirmed', 'Custódia perdida → fundo da temporada (75%)', _m.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.meta_id = _m.id AND t.type = 'prize'
    );
    INSERT INTO public.transactions(user_id, type, amount, status, description, meta_id)
    SELECT _m.user_id, 'fee', _fee, 'confirmed', 'Taxa VRENN (25%) — meta falhada', _m.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.meta_id = _m.id AND t.type = 'fee'
    );
  END IF;

  UPDATE public.metas
  SET custodia_resolvida = true, custodia_resolvida_em = now()
  WHERE id = _m.id;

  RETURN jsonb_build_object('status', 'resolvida', 'resultado', _m.status);
END;
$$;

REVOKE ALL ON FUNCTION public.vrenn_settle_meta_custody(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_settle_meta_custody(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_meta_custodia()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('concluida', 'falhada')
     AND COALESCE(NEW.valor_custodia, 0) > 0 THEN
    PERFORM public.vrenn_settle_meta_custody(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_meta_custodia ON public.metas;
CREATE TRIGGER trg_resolve_meta_custodia
AFTER UPDATE OF status ON public.metas
FOR EACH ROW EXECUTE FUNCTION public.resolve_meta_custodia();

-- Remove a rotina antiga que, em metas por km, creditava 100% além dos 97%
-- já liberados pelo gatilho de custódia. A avaliação autoritativa atual já é
-- chamada por cada registrador de evidência validada.
DROP TRIGGER IF EXISTS trg_verificar_km_meta ON public.checkins;

-- Relatório administrativo: aponta valores que exigem revisão humana; não movimenta dinheiro.
CREATE OR REPLACE FUNCTION public.vrenn_meta_custody_audit()
RETURNS TABLE(
  meta_id uuid,
  user_id uuid,
  status text,
  valor_custodia numeric,
  custodia_resolvida boolean,
  total_lock numeric,
  total_unlock numeric,
  total_fee numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.status, m.valor_custodia, m.custodia_resolvida,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type='lock'),0),
    COALESCE(SUM(t.amount) FILTER (WHERE t.type='unlock'),0),
    COALESCE(SUM(t.amount) FILTER (WHERE t.type='fee'),0)
  FROM public.metas m
  LEFT JOIN public.transactions t ON t.meta_id=m.id
  WHERE COALESCE(m.valor_custodia,0)>0
  GROUP BY m.id,m.user_id,m.status,m.valor_custodia,m.custodia_resolvida
  HAVING
    (m.status IN ('concluida','falhada') AND NOT m.custodia_resolvida)
    OR COALESCE(SUM(t.amount) FILTER (WHERE t.type='lock'),0) <> m.valor_custodia
    OR (m.status='concluida' AND COALESCE(SUM(t.amount) FILTER (WHERE t.type='unlock'),0) <> ROUND(m.valor_custodia*0.97,2));
$$;

REVOKE ALL ON FUNCTION public.vrenn_meta_custody_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_meta_custody_audit() TO service_role;
