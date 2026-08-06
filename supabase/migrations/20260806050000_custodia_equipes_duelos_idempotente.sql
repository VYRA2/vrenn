-- Custódia idempotente e rastreável para desafios de equipe e duelos.
-- Equipe concluída: 100% da própria custódia de volta, sem taxa.

ALTER TABLE public.desafio_equipe_participantes
  ADD COLUMN IF NOT EXISTS concluiu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluiu_em timestamptz,
  ADD COLUMN IF NOT EXISTS premio_recebido numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custodia_resolvida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custodia_resolvida_em timestamptz;

ALTER TABLE public.duelos
  ADD COLUMN IF NOT EXISTS custodia_resolvida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custodia_resolvida_em timestamptz;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS desafio_equipe_id uuid,
  ADD COLUMN IF NOT EXISTS duelo_id uuid;

CREATE INDEX IF NOT EXISTS transactions_desafio_equipe_idx
  ON public.transactions(desafio_equipe_id) WHERE desafio_equipe_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_duelo_idx
  ON public.transactions(duelo_id) WHERE duelo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_team_lock_once_idx
  ON public.transactions(desafio_equipe_id,user_id,type)
  WHERE desafio_equipe_id IS NOT NULL AND type='lock';
CREATE UNIQUE INDEX IF NOT EXISTS transactions_team_unlock_once_idx
  ON public.transactions(desafio_equipe_id,user_id,type)
  WHERE desafio_equipe_id IS NOT NULL AND type='unlock';
CREATE UNIQUE INDEX IF NOT EXISTS transactions_duel_lock_once_idx
  ON public.transactions(duelo_id,user_id,type)
  WHERE duelo_id IS NOT NULL AND type='lock';
CREATE UNIQUE INDEX IF NOT EXISTS transactions_duel_unlock_once_idx
  ON public.transactions(duelo_id,user_id,type)
  WHERE duelo_id IS NOT NULL AND type='unlock';

CREATE OR REPLACE FUNCTION public.lock_desafio_equipe_entrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _value numeric;
BEGIN
  SELECT valor_entrada INTO _value FROM public.desafios_equipe WHERE id=NEW.desafio_id;
  IF COALESCE(_value,0)<=0 THEN RETURN NEW; END IF;
  UPDATE public.wallets
  SET balance=balance-_value,locked_balance=locked_balance+_value,updated_at=now()
  WHERE user_id=NEW.user_id AND balance>=_value;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saldo insuficiente para entrar neste desafio de equipe'; END IF;
  INSERT INTO public.transactions(user_id,type,amount,status,description,desafio_equipe_id)
  VALUES(NEW.user_id,'lock',_value,'confirmed','Entrada em desafio de equipe',NEW.desafio_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.vrenn_settle_team_participant(
  _desafio_id uuid,_user_id uuid,_success boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _p public.desafio_equipe_participantes; _d public.desafios_equipe;
  _value numeric; _pool numeric; _fund numeric; _fee numeric;
BEGIN
  SELECT * INTO _p FROM public.desafio_equipe_participantes
  WHERE desafio_id=_desafio_id AND user_id=_user_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'participação não encontrada'; END IF;
  IF _p.custodia_resolvida THEN RETURN jsonb_build_object('status','ja_resolvida'); END IF;
  SELECT * INTO _d FROM public.desafios_equipe WHERE id=_desafio_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'desafio não encontrado'; END IF;
  _value:=COALESCE(_d.valor_entrada,0);
  IF _value<=0 THEN
    UPDATE public.desafio_equipe_participantes SET custodia_resolvida=true,custodia_resolvida_em=now()
    WHERE id=_p.id;
    RETURN jsonb_build_object('status','sem_custodia');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wallets WHERE user_id=_user_id AND locked_balance>=_value FOR UPDATE) THEN
    RAISE EXCEPTION 'custódia de equipe inconsistente para o participante';
  END IF;
  IF _success THEN
    UPDATE public.wallets SET balance=balance+_value,locked_balance=locked_balance-_value,updated_at=now()
    WHERE user_id=_user_id;
    INSERT INTO public.transactions(user_id,type,amount,status,description,desafio_equipe_id)
    VALUES(_user_id,'unlock',_value,'confirmed','Desafio de equipe concluído — devolução integral da custódia',_desafio_id)
    ON CONFLICT DO NOTHING;
  ELSE
    _pool:=ROUND(_value*0.75,2); _fund:=ROUND(_value*0.125,2); _fee:=_value-_pool-_fund;
    UPDATE public.wallets SET locked_balance=locked_balance-_value,updated_at=now() WHERE user_id=_user_id;
    UPDATE public.desafios_equipe SET premio_acumulado=premio_acumulado+_pool WHERE id=_desafio_id;
    UPDATE public.fundo_temporada SET valor_acumulado=valor_acumulado+_fund,updated_at=now();
    IF NOT FOUND THEN INSERT INTO public.fundo_temporada(valor_acumulado) VALUES(_fund); END IF;
    INSERT INTO public.transactions(user_id,type,amount,status,description,desafio_equipe_id) VALUES
      (_user_id,'prize',_pool,'confirmed','Falha em desafio de equipe → prêmio do desafio (75%)',_desafio_id),
      (_user_id,'prize',_fund,'confirmed','Falha em desafio de equipe → fundo da temporada (12,5%)',_desafio_id),
      (_user_id,'fee',_fee,'confirmed','Taxa VRENN — desafio de equipe (12,5%)',_desafio_id);
  END IF;
  PERFORM set_config('vrenn.trusted_outcome','1',true);
  UPDATE public.desafio_equipe_participantes
  SET custodia_resolvida=true,custodia_resolvida_em=now(),concluiu=_success,
      concluiu_em=CASE WHEN _success THEN COALESCE(concluiu_em,now()) ELSE concluiu_em END,
      status=CASE WHEN _success THEN 'concluida' ELSE 'falhada' END
  WHERE id=_p.id;
  RETURN jsonb_build_object('status','resolvida','sucesso',_success);
END; $$;

REVOKE ALL ON FUNCTION public.vrenn_settle_team_participant(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_settle_team_participant(uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.vrenn_guard_team_participant_outcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.desafio_id IS DISTINCT FROM OLD.desafio_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'vínculo da participação é imutável';
  END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status OR
      NEW.concluiu IS DISTINCT FROM OLD.concluiu OR
      NEW.eliminado IS DISTINCT FROM OLD.eliminado OR
      NEW.custodia_resolvida IS DISTINCT FROM OLD.custodia_resolvida OR
      NEW.custodia_resolvida_em IS DISTINCT FROM OLD.custodia_resolvida_em OR
      NEW.premio_recebido IS DISTINCT FROM OLD.premio_recebido) AND
     COALESCE(auth.role(),'')<>'service_role' AND
     COALESCE(current_setting('vrenn.trusted_outcome',true),'')<>'1' THEN
    RAISE EXCEPTION 'resultado financeiro só pode ser alterado pelo servidor';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_vrenn_guard_team_participant_outcome ON public.desafio_equipe_participantes;
CREATE TRIGGER trg_vrenn_guard_team_participant_outcome
BEFORE UPDATE ON public.desafio_equipe_participantes
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_team_participant_outcome();

CREATE OR REPLACE FUNCTION public.resolve_desafio_equipe_participante()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.custodia_resolvida THEN RETURN NEW; END IF;
  IF (NEW.concluiu AND NOT COALESCE(OLD.concluiu,false)) OR
     (NEW.status='concluida' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.vrenn_settle_team_participant(NEW.desafio_id,NEW.user_id,true);
  ELSIF (COALESCE(NEW.eliminado,false) AND NOT COALESCE(OLD.eliminado,false)) OR
        (NEW.status='falhada' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.vrenn_settle_team_participant(NEW.desafio_id,NEW.user_id,false);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_resolve_desafio_participante ON public.desafio_equipe_participantes;
CREATE TRIGGER trg_resolve_desafio_participante
AFTER UPDATE OF concluiu,eliminado,status ON public.desafio_equipe_participantes
FOR EACH ROW EXECUTE FUNCTION public.resolve_desafio_equipe_participante();

CREATE OR REPLACE FUNCTION public.vrenn_guard_team_finalization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('finalizado','concluido') AND EXISTS(
    SELECT 1 FROM public.desafio_equipe_participantes p
    WHERE p.desafio_id=NEW.id AND NOT p.custodia_resolvida AND COALESCE(NEW.valor_entrada,0)>0
  ) THEN RAISE EXCEPTION 'Não é possível finalizar: existem custódias de participantes sem resultado'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_vrenn_guard_team_finalization ON public.desafios_equipe;
CREATE TRIGGER trg_vrenn_guard_team_finalization BEFORE UPDATE OF status ON public.desafios_equipe
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_team_finalization();

CREATE OR REPLACE FUNCTION public.lock_duelo_custodia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status='pendente' AND NEW.status IN ('ativo','em_andamento') AND NEW.opponent_id IS NOT NULL
     AND COALESCE(NEW.valor_custodia,0)>0 THEN
    UPDATE public.wallets SET balance=balance-NEW.valor_custodia,
      locked_balance=locked_balance+NEW.valor_custodia,updated_at=now()
    WHERE user_id=NEW.challenger_id AND balance>=NEW.valor_custodia;
    IF NOT FOUND THEN RAISE EXCEPTION 'Saldo insuficiente do desafiante para este duelo'; END IF;
    UPDATE public.wallets SET balance=balance-NEW.valor_custodia,
      locked_balance=locked_balance+NEW.valor_custodia,updated_at=now()
    WHERE user_id=NEW.opponent_id AND balance>=NEW.valor_custodia;
    IF NOT FOUND THEN RAISE EXCEPTION 'Saldo insuficiente do oponente para este duelo'; END IF;
    INSERT INTO public.transactions(user_id,type,amount,status,description,duelo_id) VALUES
      (NEW.challenger_id,'lock',NEW.valor_custodia,'confirmed','Custódia travada — duelo aceito',NEW.id),
      (NEW.opponent_id,'lock',NEW.valor_custodia,'confirmed','Custódia travada — duelo aceito',NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_duelo_custodia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _loser uuid; _fee numeric; _fund numeric; _prize numeric;
BEGIN
  IF OLD.status NOT IN ('ativo','em_andamento') OR NEW.status<>'concluido'
     OR COALESCE(NEW.valor_custodia,0)<=0 OR NEW.custodia_resolvida THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wallets WHERE user_id=NEW.challenger_id
    AND locked_balance>=NEW.valor_custodia FOR UPDATE) OR
     NOT EXISTS(SELECT 1 FROM public.wallets WHERE user_id=NEW.opponent_id
    AND locked_balance>=NEW.valor_custodia FOR UPDATE) THEN
    RAISE EXCEPTION 'custódia do duelo inconsistente';
  END IF;
  IF NEW.winner_id IS NOT NULL THEN
    _loser:=CASE WHEN NEW.winner_id=NEW.challenger_id THEN NEW.opponent_id ELSE NEW.challenger_id END;
    _fee:=ROUND(NEW.valor_custodia*0.06,2); _fund:=ROUND(NEW.valor_custodia*0.06,2);
    _prize:=NEW.valor_custodia-_fee-_fund;
    UPDATE public.wallets SET balance=balance+NEW.valor_custodia+_prize,
      locked_balance=locked_balance-NEW.valor_custodia,updated_at=now() WHERE user_id=NEW.winner_id;
    UPDATE public.wallets SET locked_balance=locked_balance-NEW.valor_custodia,updated_at=now() WHERE user_id=_loser;
    UPDATE public.fundo_temporada SET valor_acumulado=valor_acumulado+_fund,updated_at=now();
    IF NOT FOUND THEN INSERT INTO public.fundo_temporada(valor_acumulado) VALUES(_fund); END IF;
    INSERT INTO public.transactions(user_id,type,amount,status,description,duelo_id) VALUES
      (NEW.winner_id,'unlock',NEW.valor_custodia,'confirmed','Devolução da própria custódia — duelo',NEW.id),
      (NEW.winner_id,'prize',_prize,'confirmed','Prêmio de duelo (88% da custódia rival)',NEW.id),
      (_loser,'prize',_fund,'confirmed','Duelo perdido → fundo da temporada (6%)',NEW.id),
      (_loser,'fee',_fee,'confirmed','Taxa VRENN — duelo perdido (6%)',NEW.id);
  ELSIF NEW.progresso_challenger>=100 AND NEW.progresso_opponent>=100 THEN
    UPDATE public.wallets SET balance=balance+NEW.valor_custodia,
      locked_balance=locked_balance-NEW.valor_custodia,updated_at=now()
    WHERE user_id IN(NEW.challenger_id,NEW.opponent_id);
    INSERT INTO public.transactions(user_id,type,amount,status,description,duelo_id) VALUES
      (NEW.challenger_id,'unlock',NEW.valor_custodia,'confirmed','Empate com sucesso — devolução integral',NEW.id),
      (NEW.opponent_id,'unlock',NEW.valor_custodia,'confirmed','Empate com sucesso — devolução integral',NEW.id);
  ELSE
    _fund:=ROUND(NEW.valor_custodia*0.75,2); _fee:=NEW.valor_custodia-_fund;
    UPDATE public.wallets SET locked_balance=locked_balance-NEW.valor_custodia,updated_at=now()
    WHERE user_id IN(NEW.challenger_id,NEW.opponent_id);
    UPDATE public.fundo_temporada SET valor_acumulado=valor_acumulado+(_fund*2),updated_at=now();
    IF NOT FOUND THEN INSERT INTO public.fundo_temporada(valor_acumulado) VALUES(_fund*2); END IF;
    INSERT INTO public.transactions(user_id,type,amount,status,description,duelo_id) VALUES
      (NEW.challenger_id,'prize',_fund,'confirmed','Empate sem sucesso → fundo (75%)',NEW.id),
      (NEW.challenger_id,'fee',_fee,'confirmed','Empate sem sucesso → taxa (25%)',NEW.id),
      (NEW.opponent_id,'prize',_fund,'confirmed','Empate sem sucesso → fundo (75%)',NEW.id),
      (NEW.opponent_id,'fee',_fee,'confirmed','Empate sem sucesso → taxa (25%)',NEW.id);
  END IF;
  UPDATE public.duelos SET custodia_resolvida=true,custodia_resolvida_em=now() WHERE id=NEW.id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.vrenn_team_duel_custody_audit()
RETURNS TABLE(tipo text,referencia_id uuid,user_id uuid,status text,valor numeric,motivo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT 'equipe',d.id,p.user_id,p.status,d.valor_entrada,
    CASE WHEN d.status IN('finalizado','concluido') THEN 'desafio finalizado com custódia pendente'
         ELSE 'resultado registrado sem liquidação' END
  FROM public.desafios_equipe d JOIN public.desafio_equipe_participantes p ON p.desafio_id=d.id
  WHERE d.valor_entrada>0 AND NOT p.custodia_resolvida
    AND (d.status IN('finalizado','concluido') OR p.status IN('concluida','falhada') OR p.concluiu OR p.eliminado)
  UNION ALL
  SELECT 'duelo',d.id,d.challenger_id,d.status,d.valor_custodia,'duelo concluído sem liquidação'
  FROM public.duelos d WHERE COALESCE(d.valor_custodia,0)>0 AND d.status='concluido' AND NOT d.custodia_resolvida;
$$;
REVOKE ALL ON FUNCTION public.vrenn_team_duel_custody_audit() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_team_duel_custody_audit() TO service_role;

-- Mantém o diagnóstico administrativo alinhado à regra de devolução integral.
CREATE OR REPLACE FUNCTION public.teste_desafio_equipe_financeiro()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _participants int:=50; _winners int:=5; _losers int:=45; _entry numeric:=50;
  _custody numeric; _loser_value numeric; _pool numeric; _fund numeric; _fee numeric;
  _refund numeric; _pcts numeric[]:=ARRAY[35,25,18,12,10]; _sum numeric:=0;
  _distributed numeric:=0; _distribution jsonb:='[]'::jsonb; _award numeric; i int;
BEGIN
  _custody:=_participants*_entry; _loser_value:=_losers*_entry;
  _pool:=_loser_value*0.75; _fund:=_loser_value*0.125; _fee:=_loser_value*0.125;
  _refund:=_winners*_entry;
  FOREACH i IN ARRAY _pcts LOOP _sum:=_sum+i; END LOOP;
  FOR i IN 1..array_length(_pcts,1) LOOP
    _award:=CASE WHEN i=array_length(_pcts,1) THEN _pool-_distributed
      ELSE ROUND(_pool*_pcts[i]/_sum,2) END;
    _distributed:=_distributed+_award;
    _distribution:=_distribution||jsonb_build_object('posicao',i,'pct_pool',_pcts[i],
      'premio_extra',_award,'total_recebe',_entry+_award);
  END LOOP;
  RETURN jsonb_build_object('config',jsonb_build_object('participantes',_participants,
    'vencedores',_winners,'perdedores',_losers,'entrada',_entry),
    'financeiro',jsonb_build_object('custodia_total',_custody,'pool_premios',_pool,
      'taxa_vrenn_total',_fee,'fundo_temporada',_fund,'devolucao_vencedores_total',_refund),
    'verificacoes',jsonb_build_object('custodia_total_bate',
      (_refund+_pool+_fund+_fee)=_custody,'pool_distribuido_bate',ROUND(_distributed,2)=ROUND(_pool,2),
      'soma_pcts_100',_sum=100),'distribuicao',_distribution);
END; $$;
