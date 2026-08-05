-- VRENN — Arbitragem sorteada, contestações e endurecimento antifraude

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Usuários entram voluntariamente no grupo de árbitros e aceitam os termos.
CREATE TABLE IF NOT EXISTS public.arbitro_pool (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  termos_aceitos_em timestamptz NOT NULL DEFAULT now(),
  suspenso_ate timestamptz,
  total_designacoes integer NOT NULL DEFAULT 0,
  total_contestacoes_procedentes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arbitro_pool ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.arbitro_pool TO authenticated;

DROP POLICY IF EXISTS arbitro_pool_select ON public.arbitro_pool;
CREATE POLICY arbitro_pool_select ON public.arbitro_pool
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS arbitro_pool_self_insert ON public.arbitro_pool;
CREATE POLICY arbitro_pool_self_insert ON public.arbitro_pool
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS arbitro_pool_self_update ON public.arbitro_pool;
CREATE POLICY arbitro_pool_self_update ON public.arbitro_pool
FOR UPDATE TO authenticated USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND total_designacoes = (SELECT p.total_designacoes FROM public.arbitro_pool p WHERE p.user_id = auth.uid())
  AND total_contestacoes_procedentes = (SELECT p.total_contestacoes_procedentes FROM public.arbitro_pool p WHERE p.user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.arbitration_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('meta','duelo','desafio_equipe')),
  entity_id uuid NOT NULL,
  arbitro_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'designado'
    CHECK (status IN ('designado','em_analise','decidido','substituido','cancelado')),
  selection_nonce uuid NOT NULL,
  selection_proof text NOT NULL,
  eligible_count integer NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decision jsonb,
  UNIQUE (entity_type, entity_id)
);

ALTER TABLE public.arbitration_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.arbitration_assignments TO authenticated;
GRANT ALL ON public.arbitration_assignments TO service_role;

DROP POLICY IF EXISTS arbitration_assignments_visible ON public.arbitration_assignments;
CREATE POLICY arbitration_assignments_visible ON public.arbitration_assignments
FOR SELECT TO authenticated USING (
  arbitro_id = auth.uid()
  OR CASE entity_type
    WHEN 'meta' THEN EXISTS (
      SELECT 1 FROM public.metas m WHERE m.id = entity_id AND m.user_id = auth.uid()
    )
    WHEN 'duelo' THEN EXISTS (
      SELECT 1 FROM public.duelos d
      WHERE d.id = entity_id AND auth.uid() IN (d.challenger_id,d.opponent_id)
    )
    WHEN 'desafio_equipe' THEN EXISTS (
      SELECT 1 FROM public.desafio_equipe_participantes p
      WHERE p.desafio_id = entity_id AND p.user_id = auth.uid()
    )
    ELSE false
  END
);

CREATE TABLE IF NOT EXISTS public.arbitration_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('meta','duelo','desafio_equipe')),
  entity_id uuid NOT NULL,
  appellant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.arbitration_assignments(id) ON DELETE SET NULL,
  motivo text NOT NULL CHECK (char_length(trim(motivo)) BETWEEN 20 AND 2000),
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','em_analise','procedente','improcedente','encerrada')),
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  support_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, appellant_id)
);

ALTER TABLE public.arbitration_appeals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.arbitration_appeals TO authenticated;
GRANT ALL ON public.arbitration_appeals TO service_role;

DROP POLICY IF EXISTS arbitration_appeals_owner_select ON public.arbitration_appeals;
CREATE POLICY arbitration_appeals_owner_select ON public.arbitration_appeals
FOR SELECT TO authenticated USING (appellant_id = auth.uid());

-- Retorna participantes que não podem arbitrar a própria disputa.
CREATE OR REPLACE FUNCTION public.vrenn_is_conflicted_arbitrator(
  _entity_type text,
  _entity_id uuid,
  _candidate uuid
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _entity_type = 'meta' THEN
    RETURN EXISTS (SELECT 1 FROM public.metas m WHERE m.id=_entity_id AND m.user_id=_candidate);
  ELSIF _entity_type = 'duelo' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.duelos d
      WHERE d.id=_entity_id AND _candidate IN (d.challenger_id,d.opponent_id)
    );
  ELSIF _entity_type = 'desafio_equipe' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.desafio_equipe_participantes p
      WHERE p.desafio_id=_entity_id AND p.user_id=_candidate
    );
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.vrenn_is_conflicted_arbitrator(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_is_conflicted_arbitrator(text,uuid,uuid) TO service_role;

-- Sorteio determinístico a partir de um nonce armazenado. O hash e a quantidade
-- de elegíveis ficam registrados para auditoria posterior.
CREATE OR REPLACE FUNCTION public.sortear_arbitro(
  _entity_type text,
  _entity_id uuid
)
RETURNS public.arbitration_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _existing public.arbitration_assignments;
  _nonce uuid := gen_random_uuid();
  _chosen uuid;
  _eligible integer;
  _proof text;
  _row public.arbitration_assignments;
  _method text;
BEGIN
  SELECT * INTO _existing FROM public.arbitration_assignments
  WHERE entity_type=_entity_type AND entity_id=_entity_id;
  IF _existing.id IS NOT NULL THEN RETURN _existing; END IF;

  IF _entity_type='meta' THEN
    SELECT tipo_validacao INTO _method FROM public.metas WHERE id=_entity_id;
  ELSIF _entity_type='duelo' THEN
    SELECT tipo_validacao INTO _method FROM public.duelos WHERE id=_entity_id;
  ELSIF _entity_type='desafio_equipe' THEN
    SELECT tipo_validacao INTO _method FROM public.desafios_equipe WHERE id=_entity_id;
  ELSE
    RAISE EXCEPTION 'entidade inválida';
  END IF;

  IF _method IS DISTINCT FROM 'foto_arbitro' THEN
    RAISE EXCEPTION 'esta entidade não usa foto + árbitro';
  END IF;

  SELECT count(*) INTO _eligible
  FROM public.arbitro_pool p
  WHERE p.ativo=true
    AND (p.suspenso_ate IS NULL OR p.suspenso_ate<now())
    AND NOT public.vrenn_is_conflicted_arbitrator(_entity_type,_entity_id,p.user_id);

  IF _eligible=0 THEN RAISE EXCEPTION 'nenhum árbitro elegível disponível'; END IF;

  SELECT p.user_id INTO _chosen
  FROM public.arbitro_pool p
  WHERE p.ativo=true
    AND (p.suspenso_ate IS NULL OR p.suspenso_ate<now())
    AND NOT public.vrenn_is_conflicted_arbitrator(_entity_type,_entity_id,p.user_id)
  ORDER BY encode(digest(_entity_type||':'||_entity_id::text||':'||_nonce::text||':'||p.user_id::text,'sha256'),'hex')
  LIMIT 1;

  _proof := encode(digest(_entity_type||':'||_entity_id::text||':'||_nonce::text||':'||_chosen::text||':'||_eligible::text,'sha256'),'hex');

  INSERT INTO public.arbitration_assignments(
    entity_type,entity_id,arbitro_id,selection_nonce,selection_proof,eligible_count
  ) VALUES (_entity_type,_entity_id,_chosen,_nonce,_proof,_eligible)
  RETURNING * INTO _row;

  UPDATE public.arbitro_pool
  SET total_designacoes=total_designacoes+1,updated_at=now()
  WHERE user_id=_chosen;

  IF _entity_type='duelo' THEN
    PERFORM set_config('vrenn.trusted_outcome','1',true);
    UPDATE public.duelos
    SET arbitro_id=_chosen,arbitro_status='aceito'
    WHERE id=_entity_id;
  END IF;

  INSERT INTO public.notificacoes(user_id,tipo,mensagem,link_id,lida)
  VALUES (_chosen,'arbitragem_pendente','Você foi sorteado para arbitrar uma validação por foto.',_entity_id,false);

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.sortear_arbitro(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sortear_arbitro(text,uuid) TO service_role;

-- Usuário participante pode abrir contestação; o resultado não é revertido automaticamente.
CREATE OR REPLACE FUNCTION public.contestar_resultado_arbitragem(
  _entity_type text,
  _entity_id uuid,
  _motivo text,
  _anexos jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _assignment public.arbitration_assignments;
  _allowed boolean := false;
  _snapshot jsonb := '{}'::jsonb;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'não autorizado'; END IF;
  IF char_length(trim(_motivo))<20 THEN RAISE EXCEPTION 'descreva o motivo com pelo menos 20 caracteres'; END IF;

  SELECT * INTO _assignment FROM public.arbitration_assignments
  WHERE entity_type=_entity_type AND entity_id=_entity_id;
  IF _assignment.id IS NULL OR _assignment.status<>'decidido' THEN
    RAISE EXCEPTION 'não existe decisão arbitral final para contestar';
  END IF;

  IF _entity_type='meta' THEN
    SELECT EXISTS(SELECT 1 FROM public.metas m WHERE m.id=_entity_id AND m.user_id=_uid),
           to_jsonb(m.*) INTO _allowed,_snapshot
    FROM public.metas m WHERE m.id=_entity_id;
  ELSIF _entity_type='duelo' THEN
    SELECT (_uid IN (d.challenger_id,d.opponent_id)),to_jsonb(d.*)
    INTO _allowed,_snapshot FROM public.duelos d WHERE d.id=_entity_id;
  ELSIF _entity_type='desafio_equipe' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.desafio_equipe_participantes p
      WHERE p.desafio_id=_entity_id AND p.user_id=_uid
    ),to_jsonb(d.*)
    INTO _allowed,_snapshot FROM public.desafios_equipe d WHERE d.id=_entity_id;
  ELSE
    RAISE EXCEPTION 'entidade inválida';
  END IF;

  IF NOT COALESCE(_allowed,false) THEN RAISE EXCEPTION 'você não participa desta validação'; END IF;

  INSERT INTO public.arbitration_appeals(
    entity_type,entity_id,appellant_id,assignment_id,motivo,anexos,result_snapshot
  ) VALUES (_entity_type,_entity_id,_uid,_assignment.id,trim(_motivo),COALESCE(_anexos,'[]'::jsonb),_snapshot)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.contestar_resultado_arbitragem(text,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contestar_resultado_arbitragem(text,uuid,text,jsonb) TO authenticated;

-- Impede inflação: respeita o limite configurado por período para provas sem distância.
CREATE OR REPLACE FUNCTION public.vrenn_check_validation_quota(
  _entity_type text,
  _entity_id uuid,
  _user_id uuid,
  _team boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _freq text;
  _qty integer;
  _objective numeric;
  _count integer;
  _start timestamptz;
BEGIN
  IF _entity_type='meta' THEN
    SELECT frequencia_tipo,frequencia_quantidade,objetivo_km INTO _freq,_qty,_objective
    FROM public.metas WHERE id=_entity_id;
  ELSIF _entity_type='duelo' THEN
    SELECT frequencia_tipo,frequencia_quantidade,objetivo_km INTO _freq,_qty,_objective
    FROM public.duelos WHERE id=_entity_id;
  ELSE
    SELECT frequencia_tipo,frequencia_quantidade,objetivo_km INTO _freq,_qty,_objective
    FROM public.desafios_equipe WHERE id=_entity_id;
  END IF;

  IF COALESCE(_objective,0)>0 THEN RETURN; END IF;
  _qty:=GREATEST(COALESCE(_qty,1),1);
  _start:=CASE
    WHEN _freq='diario' THEN date_trunc('day',now())
    WHEN _freq='semanal' THEN date_trunc('week',now())
    ELSE '1970-01-01'::timestamptz
  END;

  IF _team THEN
    SELECT count(*) INTO _count FROM public.checkins_desafio_equipe c
    WHERE c.desafio_id=_entity_id AND c.user_id=_user_id AND c.validado=true AND c.created_at>=_start;
  ELSE
    SELECT count(*) INTO _count FROM public.checkins c
    WHERE c.user_id=_user_id AND c.validado=true AND c.created_at>=_start
      AND ((_entity_type='meta' AND c.meta_id=_entity_id) OR (_entity_type='duelo' AND c.duelo_id=_entity_id));
  END IF;

  IF _count>=_qty THEN
    RAISE EXCEPTION 'limite de provas validadas deste período já atingido';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.vrenn_check_validation_quota(text,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_check_validation_quota(text,uuid,uuid,boolean) TO service_role;

-- Remove o gatilho financeiro antigo de desafios: o novo motor resolve uma única vez
-- por custodia_resolvida, evitando crédito ou débito duplicado.
DROP TRIGGER IF EXISTS trg_resolve_desafio_participante ON public.desafio_equipe_participantes;

-- O trigger antigo dava reputação e conquistas em check-ins ainda não validados.
DROP TRIGGER IF EXISTS trg_checkin_reputacao ON public.checkins;
DROP TRIGGER IF EXISTS trg_conquistas_checkin ON public.checkins;

-- Corrige a função de pós-validação: streak, reputação e conquistas só contam prova válida.
CREATE OR REPLACE FUNCTION public.vrenn_after_validated_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _previous date;
  _streak integer;
  _total integer;
BEGIN
  IF NOT (NEW.validado=true AND (TG_OP='INSERT' OR OLD.validado IS DISTINCT FROM true)) THEN
    RETURN NEW;
  END IF;

  IF NEW.meta_id IS NOT NULL THEN
    PERFORM public.vrenn_evaluate_meta(NEW.meta_id);
  ELSIF NEW.duelo_id IS NOT NULL THEN
    PERFORM public.vrenn_evaluate_duel(NEW.duelo_id,false);
  END IF;

  SELECT max(c.created_at::date) INTO _previous
  FROM public.checkins c
  WHERE c.user_id=NEW.user_id AND c.validado=true AND c.id<>NEW.id;

  SELECT streak_dias INTO _streak FROM public.profiles WHERE id=NEW.user_id FOR UPDATE;
  IF _previous IS NULL OR _previous<current_date-1 THEN _streak:=1;
  ELSIF _previous=current_date-1 THEN _streak:=COALESCE(_streak,0)+1;
  END IF;
  UPDATE public.profiles SET streak_dias=GREATEST(COALESCE(_streak,1),1) WHERE id=NEW.user_id;

  PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_validado',COALESCE(NEW.meta_id,NEW.duelo_id));
  IF _streak IN (7,30,100) THEN
    PERFORM public.dar_reputacao(NEW.user_id,CASE _streak WHEN 7 THEN 20 WHEN 30 THEN 100 ELSE 500 END,'streak_bonus',NULL);
  END IF;

  SELECT count(*) INTO _total FROM public.checkins WHERE user_id=NEW.user_id AND validado=true;
  IF _total>=1 THEN PERFORM public.desbloquear_conquista(NEW.user_id,'primeira_fagulha'); END IF;
  IF _total>=10 THEN PERFORM public.desbloquear_conquista(NEW.user_id,'comprometido'); END IF;
  IF _total>=50 THEN PERFORM public.desbloquear_conquista(NEW.user_id,'maquina'); END IF;
  IF _total>=200 THEN PERFORM public.desbloquear_conquista(NEW.user_id,'lendario_checkin'); END IF;
  IF _streak>=7 THEN PERFORM public.desbloquear_conquista(NEW.user_id,'chama_acesa'); END IF;
  IF _streak>=30 THEN PERFORM public.desbloquear_conquista(NEW.user_id,'rotina_de_ferro'); END IF;
  IF _streak>=100 THEN PERFORM public.desbloquear_conquista(NEW.user_id,'inabalavel'); END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contestar_resultado_arbitragem(text,uuid,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
