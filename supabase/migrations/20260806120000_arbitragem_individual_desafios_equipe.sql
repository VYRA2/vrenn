-- VRENN — arbitragem individual e recurso em desafios de equipe

ALTER TABLE public.desafios_equipe
  ADD COLUMN IF NOT EXISTS modo_arbitragem text NOT NULL DEFAULT 'admin_equipe';
ALTER TABLE public.desafios_equipe DROP CONSTRAINT IF EXISTS desafios_equipe_modo_arbitragem_check;
ALTER TABLE public.desafios_equipe ADD CONSTRAINT desafios_equipe_modo_arbitragem_check
  CHECK (modo_arbitragem IN ('admin_equipe','sorteio_vrenn'));

CREATE TABLE IF NOT EXISTS public.desafio_equipe_arbitragens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id uuid NOT NULL REFERENCES public.desafios_equipe(id) ON DELETE CASCADE,
  participante_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  arbitro_original_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  modo text NOT NULL CHECK (modo IN ('admin_equipe','sorteio_vrenn')),
  status text NOT NULL DEFAULT 'aguardando_decisao'
    CHECK (status IN ('aguardando_decisao','prazo_recurso','em_recurso','revisao_central','finalizada')),
  decisao_original boolean,
  motivo_decisao text,
  evidencia_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  decidida_em timestamptz,
  recurso_ate timestamptz,
  recurso_motivo text,
  recurso_anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisao_central_motivo text,
  resultado_final boolean,
  finalizada_em timestamptz,
  selection_nonce uuid NOT NULL DEFAULT gen_random_uuid(),
  selection_proof text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (desafio_id, participante_id)
);

CREATE TABLE IF NOT EXISTS public.desafio_equipe_painel_recurso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arbitragem_id uuid NOT NULL REFERENCES public.desafio_equipe_arbitragens(id) ON DELETE CASCADE,
  arbitro_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  voto boolean,
  justificativa text,
  votado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (arbitragem_id, arbitro_id)
);

ALTER TABLE public.desafio_equipe_arbitragens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafio_equipe_painel_recurso ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.desafio_equipe_arbitragens, public.desafio_equipe_painel_recurso TO authenticated;
GRANT ALL ON public.desafio_equipe_arbitragens, public.desafio_equipe_painel_recurso TO service_role;

DROP POLICY IF EXISTS desafio_equipe_arbitragens_visible ON public.desafio_equipe_arbitragens;
CREATE POLICY desafio_equipe_arbitragens_visible ON public.desafio_equipe_arbitragens
FOR SELECT TO authenticated USING (
  participante_id=auth.uid() OR arbitro_original_id=auth.uid() OR
  EXISTS (SELECT 1 FROM public.desafio_equipe_painel_recurso p WHERE p.arbitragem_id=id AND p.arbitro_id=auth.uid()) OR
  EXISTS (SELECT 1 FROM public.desafios_equipe d JOIN public.equipes e ON e.id=d.equipe_id WHERE d.id=desafio_id AND e.criador_id=auth.uid())
);
DROP POLICY IF EXISTS desafio_equipe_painel_visible ON public.desafio_equipe_painel_recurso;
CREATE POLICY desafio_equipe_painel_visible ON public.desafio_equipe_painel_recurso
FOR SELECT TO authenticated USING (arbitro_id=auth.uid());

CREATE OR REPLACE FUNCTION public.vrenn_solicitar_arbitragem_equipe(_desafio_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid:=auth.uid(); _d public.desafios_equipe; _arb uuid; _id uuid; _eligible int; _nonce uuid:=gen_random_uuid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'não autorizado'; END IF;
  SELECT * INTO _d FROM public.desafios_equipe WHERE id=_desafio_id;
  IF _d.id IS NULL OR _d.tipo_validacao<>'foto_arbitro' THEN RAISE EXCEPTION 'desafio não usa foto + árbitro'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.desafio_equipe_participantes WHERE desafio_id=_desafio_id AND user_id=_uid) THEN
    RAISE EXCEPTION 'você não participa deste desafio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.checkins_desafio_equipe WHERE desafio_id=_desafio_id AND user_id=_uid AND foto_url IS NOT NULL) THEN
    RAISE EXCEPTION 'envie ao menos uma comprovação por foto';
  END IF;

  IF _d.modo_arbitragem='admin_equipe' THEN
    SELECT e.criador_id INTO _arb FROM public.equipes e WHERE e.id=_d.equipe_id;
    IF _arb=_uid THEN
      SELECT m.user_id INTO _arb FROM public.equipe_membros m
      WHERE m.equipe_id=_d.equipe_id AND m.user_id<>_uid AND m.papel IN ('admin','co_admin')
      ORDER BY CASE m.papel WHEN 'admin' THEN 0 ELSE 1 END,m.created_at LIMIT 1;
    END IF;
    IF _arb IS NULL THEN RAISE EXCEPTION 'não há outro administrador elegível para analisar sua própria prova'; END IF;
    _eligible:=1;
  ELSE
    SELECT count(*) INTO _eligible FROM public.profiles p
    WHERE COALESCE(p.aceita_ser_arbitro,false) AND p.id<>_uid
      AND NOT EXISTS (SELECT 1 FROM public.equipe_membros m WHERE m.equipe_id=_d.equipe_id AND m.user_id=p.id);
    IF _eligible=0 THEN RAISE EXCEPTION 'nenhum árbitro VRENN elegível disponível'; END IF;
    SELECT p.id INTO _arb FROM public.profiles p
    WHERE COALESCE(p.aceita_ser_arbitro,false) AND p.id<>_uid
      AND NOT EXISTS (SELECT 1 FROM public.equipe_membros m WHERE m.equipe_id=_d.equipe_id AND m.user_id=p.id)
    ORDER BY encode(digest(_desafio_id::text||':'||_uid::text||':'||_nonce::text||':'||p.id::text,'sha256'),'hex') LIMIT 1;
  END IF;

  INSERT INTO public.desafio_equipe_arbitragens(desafio_id,participante_id,arbitro_original_id,modo,evidencia_snapshot,selection_nonce,selection_proof)
  SELECT _desafio_id,_uid,_arb,_d.modo_arbitragem,
    COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'foto_url',c.foto_url,'mensagem',c.mensagem,'created_at',c.created_at) ORDER BY c.created_at),'[]'::jsonb),
    _nonce,encode(digest(_desafio_id::text||':'||_uid::text||':'||_nonce::text||':'||_arb::text||':'||_eligible::text,'sha256'),'hex')
  FROM public.checkins_desafio_equipe c WHERE c.desafio_id=_desafio_id AND c.user_id=_uid
  ON CONFLICT (desafio_id,participante_id) DO UPDATE SET updated_at=now()
  RETURNING id INTO _id;
  INSERT INTO public.notificacoes(user_id,tipo,mensagem,link_id,lida) VALUES (_arb,'arbitragem_pendente','Existe uma comprovação de desafio em equipe aguardando sua decisão.',_desafio_id,false);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.vrenn_decidir_arbitragem_equipe(_arbitragem_id uuid,_aprovado boolean,_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF char_length(trim(COALESCE(_motivo,'')))<10 THEN RAISE EXCEPTION 'informe uma justificativa com pelo menos 10 caracteres'; END IF;
  UPDATE public.desafio_equipe_arbitragens SET decisao_original=_aprovado,motivo_decisao=trim(_motivo),decidida_em=now(),recurso_ate=now()+interval '48 hours',status='prazo_recurso',updated_at=now()
  WHERE id=_arbitragem_id AND arbitro_original_id=auth.uid() AND status='aguardando_decisao';
  IF NOT FOUND THEN RAISE EXCEPTION 'arbitragem indisponível ou sem permissão'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.vrenn_recorrer_arbitragem_equipe(_arbitragem_id uuid,_motivo text,_anexos jsonb DEFAULT '[]'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _a public.desafio_equipe_arbitragens; _d public.desafios_equipe; _count int;
BEGIN
  IF char_length(trim(COALESCE(_motivo,'')))<20 THEN RAISE EXCEPTION 'descreva o recurso com pelo menos 20 caracteres'; END IF;
  SELECT * INTO _a FROM public.desafio_equipe_arbitragens WHERE id=_arbitragem_id FOR UPDATE;
  IF _a.participante_id<>auth.uid() OR _a.status<>'prazo_recurso' OR now()>_a.recurso_ate THEN RAISE EXCEPTION 'recurso indisponível'; END IF;
  SELECT * INTO _d FROM public.desafios_equipe WHERE id=_a.desafio_id;
  INSERT INTO public.desafio_equipe_painel_recurso(arbitragem_id,arbitro_id)
  SELECT _a.id,p.id FROM public.profiles p
  WHERE COALESCE(p.aceita_ser_arbitro,false) AND p.id NOT IN (_a.participante_id,_a.arbitro_original_id)
    AND NOT EXISTS (SELECT 1 FROM public.equipe_membros m WHERE m.equipe_id=_d.equipe_id AND m.user_id=p.id)
  ORDER BY encode(digest(_a.id::text||':'||p.id::text,'sha256'),'hex') LIMIT 3;
  GET DIAGNOSTICS _count=ROW_COUNT;
  UPDATE public.desafio_equipe_arbitragens SET recurso_motivo=trim(_motivo),recurso_anexos=COALESCE(_anexos,'[]'::jsonb),status=CASE WHEN _count=3 THEN 'em_recurso' ELSE 'revisao_central' END,updated_at=now() WHERE id=_a.id;
  INSERT INTO public.notificacoes(user_id,tipo,mensagem,link_id,lida)
  SELECT p.arbitro_id,'arbitragem_pendente','Você foi sorteado para revisar um recurso de desafio em equipe.',_a.desafio_id,false
  FROM public.desafio_equipe_painel_recurso p WHERE p.arbitragem_id=_a.id;
END $$;

CREATE OR REPLACE FUNCTION public.vrenn_aplicar_resultado_arbitragem_equipe(_arbitragem_id uuid,_resultado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _a public.desafio_equipe_arbitragens;
BEGIN
  SELECT * INTO _a FROM public.desafio_equipe_arbitragens WHERE id=_arbitragem_id FOR UPDATE;
  IF _a.status='finalizada' THEN RETURN; END IF;
  PERFORM set_config('vrenn.trusted_outcome','1',true);
  UPDATE public.desafio_equipe_participantes SET concluiu=_resultado,concluiu_em=CASE WHEN _resultado THEN now() ELSE concluiu_em END,eliminado=NOT _resultado,eliminado_em=CASE WHEN NOT _resultado THEN now() ELSE eliminado_em END,status=CASE WHEN _resultado THEN 'concluida' ELSE 'falhada' END,updated_at=now()
  WHERE desafio_id=_a.desafio_id AND user_id=_a.participante_id;
  UPDATE public.desafio_equipe_arbitragens SET resultado_final=_resultado,status='finalizada',finalizada_em=now(),updated_at=now() WHERE id=_a.id;
END $$;
REVOKE ALL ON FUNCTION public.vrenn_aplicar_resultado_arbitragem_equipe(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_aplicar_resultado_arbitragem_equipe(uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.vrenn_finalizar_arbitragem_equipe(_arbitragem_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _a public.desafio_equipe_arbitragens;
BEGIN
  SELECT * INTO _a FROM public.desafio_equipe_arbitragens WHERE id=_arbitragem_id;
  IF _a.status<>'prazo_recurso' OR now()<=_a.recurso_ate THEN RAISE EXCEPTION 'prazo de recurso ainda aberto ou decisão indisponível'; END IF;
  IF auth.uid() IS DISTINCT FROM _a.participante_id AND auth.role()<>'service_role' THEN RAISE EXCEPTION 'não autorizado'; END IF;
  PERFORM public.vrenn_aplicar_resultado_arbitragem_equipe(_a.id,_a.decisao_original);
END $$;

CREATE OR REPLACE FUNCTION public.vrenn_votar_recurso_equipe(_arbitragem_id uuid,_voto boolean,_justificativa text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _total int; _sim int;
BEGIN
  IF char_length(trim(COALESCE(_justificativa,'')))<10 THEN RAISE EXCEPTION 'justifique seu voto'; END IF;
  UPDATE public.desafio_equipe_painel_recurso SET voto=_voto,justificativa=trim(_justificativa),votado_em=now()
  WHERE arbitragem_id=_arbitragem_id AND arbitro_id=auth.uid() AND voto IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'voto indisponível ou sem permissão'; END IF;
  SELECT count(voto),count(*) FILTER (WHERE voto) INTO _total,_sim FROM public.desafio_equipe_painel_recurso WHERE arbitragem_id=_arbitragem_id;
  IF _total=3 THEN PERFORM public.vrenn_aplicar_resultado_arbitragem_equipe(_arbitragem_id,_sim>=2); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.vrenn_decidir_revisao_central_equipe(_arbitragem_id uuid,_resultado boolean,_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'somente a administração central do VRENN'; END IF;
  IF char_length(trim(COALESCE(_motivo,'')))<10 THEN RAISE EXCEPTION 'justificativa central obrigatória'; END IF;
  UPDATE public.desafio_equipe_arbitragens SET decisao_central_motivo=trim(_motivo),updated_at=now()
  WHERE id=_arbitragem_id AND status='revisao_central';
  IF NOT FOUND THEN RAISE EXCEPTION 'revisão central indisponível'; END IF;
  PERFORM public.vrenn_aplicar_resultado_arbitragem_equipe(_arbitragem_id,_resultado);
END $$;

REVOKE ALL ON FUNCTION public.vrenn_solicitar_arbitragem_equipe(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vrenn_decidir_arbitragem_equipe(uuid,boolean,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vrenn_recorrer_arbitragem_equipe(uuid,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vrenn_finalizar_arbitragem_equipe(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vrenn_votar_recurso_equipe(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vrenn_solicitar_arbitragem_equipe(uuid),public.vrenn_decidir_arbitragem_equipe(uuid,boolean,text),public.vrenn_recorrer_arbitragem_equipe(uuid,text,jsonb),public.vrenn_finalizar_arbitragem_equipe(uuid),public.vrenn_votar_recurso_equipe(uuid,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.vrenn_decidir_revisao_central_equipe(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_decidir_revisao_central_equipe(uuid,boolean,text) TO service_role;
