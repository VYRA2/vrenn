-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Sistema de Árbitro Completo
-- Sorteio automático, co-admin em equipes, reputação, auto-aprovação
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Schema ─────────────────────────────────────────────────────

-- Tentativas de sorteio de árbitro em duelos
ALTER TABLE public.duelos
  ADD COLUMN IF NOT EXISTS arbitro_tentativas int NOT NULL DEFAULT 0;

-- Co-admin em equipes (papel agora aceita 'co_admin')
ALTER TABLE public.equipe_membros
  DROP CONSTRAINT IF EXISTS equipe_membros_papel_check;
ALTER TABLE public.equipe_membros
  ADD CONSTRAINT equipe_membros_papel_check
  CHECK (papel IN ('membro', 'admin', 'co_admin'));

-- Validação dupla em justificativas de equipe
ALTER TABLE public.justificativas_falta
  ADD COLUMN IF NOT EXISTS aprovado_coadmin boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coadmin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.justificativas_falta.aprovado_coadmin IS
  'Aprovação do co-admin (necessária além do admin para decisões no desafio de equipe)';

-- Reputação de árbitro no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputacao_arbitro int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arbitragens_concluidas int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arbitragens_ativas int NOT NULL DEFAULT 0;

-- ─── 2. Função: dar reputação de árbitro ─────────────────────────

CREATE OR REPLACE FUNCTION public.dar_reputacao_arbitro(
  _arbitro_id uuid,
  _pontos int,
  _motivo text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
    SET reputacao_arbitro = GREATEST(0, reputacao_arbitro + _pontos)
  WHERE id = _arbitro_id;

  -- Log no reputacao_log para histórico
  INSERT INTO public.reputacao_log (user_id, pts, motivo)
  VALUES (_arbitro_id, _pontos, 'arbitro:' || _motivo)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dar_reputacao_arbitro(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dar_reputacao_arbitro(uuid, int, text) TO service_role;

-- ─── 3. Função: sortear árbitro para duelo ───────────────────────

CREATE OR REPLACE FUNCTION public.sortear_arbitro_duelo(_duelo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duelo        public.duelos;
  _candidato_id uuid;
  _tentativas   int;
BEGIN
  SELECT * INTO _duelo FROM public.duelos WHERE id = _duelo_id FOR UPDATE;
  IF _duelo.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _duelo.status != 'ativo' THEN RETURN; END IF;

  _tentativas := COALESCE(_duelo.arbitro_tentativas, 0);

  -- Máximo 3 tentativas — depois usa resolução automática
  IF _tentativas >= 3 THEN
    RAISE NOTICE 'Máximo de tentativas atingido para duelo %. Resolução automática.', _duelo_id;
    RETURN;
  END IF;

  -- Sortear candidato: ativo nos últimos 7 dias, não participante, máx 3 arbitragens ativas
  SELECT p.id INTO _candidato_id
  FROM public.profiles p
  WHERE p.id != _duelo.challenger_id
    AND p.id != _duelo.opponent_id
    AND p.id != COALESCE(_duelo.arbitro_id, gen_random_uuid()) -- excluir árbitro anterior que recusou
    AND p.arbitragens_ativas < 3
    AND EXISTS (
      SELECT 1 FROM public.checkins c
      WHERE c.user_id = p.id
        AND c.created_at > now() - interval '7 days'
    )
  ORDER BY RANDOM()
  LIMIT 1;

  IF _candidato_id IS NULL THEN
    -- Sem candidatos disponíveis — tentar sem restrição de check-in
    SELECT p.id INTO _candidato_id
    FROM public.profiles p
    WHERE p.id != _duelo.challenger_id
      AND p.id != _duelo.opponent_id
      AND p.arbitragens_ativas < 5
    ORDER BY p.reputacao_arbitro DESC, RANDOM()
    LIMIT 1;
  END IF;

  IF _candidato_id IS NULL THEN
    RAISE NOTICE 'Sem candidatos para árbitro no duelo %.', _duelo_id;
    RETURN;
  END IF;

  -- Registrar candidato e incrementar tentativas
  UPDATE public.duelos
    SET arbitro_id = _candidato_id,
        arbitro_status = 'pendente',
        arbitro_tentativas = _tentativas + 1
  WHERE id = _duelo_id;

  -- Incrementar arbitragens ativas do candidato
  UPDATE public.profiles SET arbitragens_ativas = arbitragens_ativas + 1 WHERE id = _candidato_id;

  -- Notificar candidato
  PERFORM public.notify(
    _candidato_id,
    'convite_arbitro',
    format('Você foi sorteado como árbitro de um duelo no VRENN! Aceite para acompanhar e declarar o resultado. Custódia: R$ %s cada.', _duelo.valor_custodia),
    _duelo_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sortear_arbitro_duelo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sortear_arbitro_duelo(uuid) TO service_role;

-- ─── 4. Função: sortear árbitro para meta solo ───────────────────

CREATE OR REPLACE FUNCTION public.sortear_arbitro_meta(_meta_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _meta         record;
  _candidato_id uuid;
  _tentativas   int;
BEGIN
  SELECT m.*, a.user_id as arbitro_atual, a.tentativas as arb_tentativas
  INTO _meta
  FROM public.metas m
  LEFT JOIN public.arbitros a ON a.meta_id = m.id AND a.status = 'pendente'
  WHERE m.id = _meta_id;

  IF _meta.id IS NULL THEN RAISE EXCEPTION 'meta não encontrada'; END IF;

  -- Contar tentativas anteriores
  SELECT COUNT(*) INTO _tentativas
  FROM public.arbitros WHERE meta_id = _meta_id AND status = 'recusado';

  IF _tentativas >= 3 THEN
    RAISE NOTICE 'Máximo de tentativas para meta %. Sem árbitro externo.', _meta_id;
    RETURN;
  END IF;

  -- Mesma categoria é preferencial mas não obrigatório
  SELECT p.id INTO _candidato_id
  FROM public.profiles p
  WHERE p.id != _meta.user_id
    AND p.arbitragens_ativas < 3
    AND NOT EXISTS (
      SELECT 1 FROM public.arbitros ar
      WHERE ar.meta_id = _meta_id AND ar.user_id = p.id
    )
    AND EXISTS (
      SELECT 1 FROM public.checkins c
      WHERE c.user_id = p.id AND c.created_at > now() - interval '7 days'
    )
  ORDER BY
    -- Preferir mesma categoria
    (EXISTS (
      SELECT 1 FROM public.metas m2
      WHERE m2.user_id = p.id AND m2.categoria = _meta.categoria AND m2.status = 'concluida'
    )) DESC,
    p.reputacao_arbitro DESC,
    RANDOM()
  LIMIT 1;

  IF _candidato_id IS NULL THEN RETURN; END IF;

  -- Inserir convite
  INSERT INTO public.arbitros (meta_id, user_id, status)
  VALUES (_meta_id, _candidato_id, 'pendente')
  ON CONFLICT (meta_id, user_id) DO NOTHING;

  UPDATE public.profiles SET arbitragens_ativas = arbitragens_ativas + 1 WHERE id = _candidato_id;

  PERFORM public.notify(
    _candidato_id,
    'convite_arbitro',
    format('O sistema selecionou você como árbitro sugerido para uma meta! Aceite para acompanhar os check-ins.'),
    _meta_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sortear_arbitro_meta(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sortear_arbitro_meta(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sortear_arbitro_meta(uuid) TO authenticated;

-- ─── 5. Função: árbitro responde convite de duelo ────────────────

CREATE OR REPLACE FUNCTION public.responder_convite_arbitro_duelo(
  _duelo_id uuid,
  _aceitar  boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duelo public.duelos;
BEGIN
  SELECT * INTO _duelo FROM public.duelos WHERE id = _duelo_id;
  IF _duelo.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _duelo.arbitro_id != auth.uid() THEN RAISE EXCEPTION 'você não é o árbitro deste duelo'; END IF;

  IF _aceitar THEN
    UPDATE public.duelos SET arbitro_status = 'aceito' WHERE id = _duelo_id;

    -- Reputação por aceitar
    PERFORM public.dar_reputacao_arbitro(auth.uid(), 5, 'aceitou_duelo_' || _duelo_id);

    -- Notificar challenger
    PERFORM public.notify(
      _duelo.challenger_id, 'arbitro_aceitou',
      'Um árbitro foi designado para o seu duelo e aceitou a responsabilidade! ⚖️',
      _duelo_id
    );
    PERFORM public.notify(
      _duelo.opponent_id, 'arbitro_aceitou',
      'Um árbitro foi designado para o duelo e aceitou a responsabilidade! ⚖️',
      _duelo_id
    );
  ELSE
    -- Recusou — decrementar ativas e tentar novo sorteio
    UPDATE public.duelos SET arbitro_status = 'recusado' WHERE id = _duelo_id;
    UPDATE public.profiles SET arbitragens_ativas = GREATEST(0, arbitragens_ativas - 1) WHERE id = auth.uid();

    -- Tentar novo sorteio
    PERFORM public.sortear_arbitro_duelo(_duelo_id);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.responder_convite_arbitro_duelo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_convite_arbitro_duelo(uuid, boolean) TO authenticated;

-- ─── 6. Função: árbitro declara resultado (com reputação) ─────────

CREATE OR REPLACE FUNCTION public.arbitro_declarar_resultado_duelo(
  _duelo_id  uuid,
  _winner_id uuid,
  _empate    boolean DEFAULT false,
  _sucesso   boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duelo public.duelos;
BEGIN
  SELECT * INTO _duelo FROM public.duelos WHERE id = _duelo_id;
  IF _duelo.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _duelo.status = 'concluido' THEN RAISE EXCEPTION 'duelo já foi encerrado'; END IF;
  IF auth.uid() IS NOT NULL AND _duelo.arbitro_id != auth.uid() THEN
    RAISE EXCEPTION 'apenas o árbitro pode declarar o resultado';
  END IF;

  -- Resolver custódia financeira
  PERFORM public.resolve_duelo_custodia(
    _duelo_id  := _duelo_id,
    _winner_id := _winner_id,
    _empate    := _empate,
    _sucesso   := _sucesso
  );

  -- Reputação por concluir arbitragem
  IF _duelo.arbitro_id IS NOT NULL THEN
    PERFORM public.dar_reputacao_arbitro(_duelo.arbitro_id, 20, 'concluiu_duelo_' || _duelo_id);
    UPDATE public.profiles
      SET arbitragens_ativas = GREATEST(0, arbitragens_ativas - 1),
          arbitragens_concluidas = arbitragens_concluidas + 1
    WHERE id = _duelo.arbitro_id;
  END IF;

  -- Notificar participantes
  PERFORM public.notify(
    _duelo.challenger_id, 'desafio_duelo',
    CASE
      WHEN _empate AND _sucesso     THEN 'Empate! Ambos completaram. Custódias devolvidas ✨'
      WHEN _empate AND NOT _sucesso THEN 'Duelo encerrado sem sucesso para nenhum dos dois.'
      WHEN _winner_id = _duelo.challenger_id THEN 'Você venceu o duelo! Árbitro declarou sua vitória 🏆'
      ELSE 'O árbitro declarou o rival como vencedor do duelo.'
    END, _duelo_id
  );
  PERFORM public.notify(
    _duelo.opponent_id, 'desafio_duelo',
    CASE
      WHEN _empate AND _sucesso     THEN 'Empate! Ambos completaram. Custódias devolvidas ✨'
      WHEN _empate AND NOT _sucesso THEN 'Duelo encerrado sem sucesso para nenhum dos dois.'
      WHEN _winner_id = _duelo.opponent_id THEN 'Você venceu o duelo! Árbitro declarou sua vitória 🏆'
      ELSE 'O árbitro declarou o rival como vencedor do duelo.'
    END, _duelo_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.arbitro_declarar_resultado_duelo(uuid, uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arbitro_declarar_resultado_duelo(uuid, uuid, boolean, boolean) TO authenticated, service_role;

-- ─── 7. Trigger: duelo aceito → sortear árbitro automaticamente ──

CREATE OR REPLACE FUNCTION public.trg_duelo_aceito_sortear_arbitro()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Quando duelo muda para ativo e não tem árbitro ainda
  IF NEW.status = 'ativo' AND OLD.status != 'ativo'
     AND NEW.arbitro_id IS NULL
  THEN
    PERFORM public.sortear_arbitro_duelo(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duelo_aceito_sortear_arbitro ON public.duelos;
CREATE TRIGGER trg_duelo_aceito_sortear_arbitro
  AFTER UPDATE OF status ON public.duelos
  FOR EACH ROW EXECUTE FUNCTION public.trg_duelo_aceito_sortear_arbitro();

-- ─── 8. Função: promover co-admin em equipe ──────────────────────

CREATE OR REPLACE FUNCTION public.promover_coadmin_equipe(
  _equipe_id uuid,
  _user_id   uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _equipe public.equipes;
BEGIN
  SELECT * INTO _equipe FROM public.equipes WHERE id = _equipe_id;
  IF _equipe.id IS NULL THEN RAISE EXCEPTION 'equipe não encontrada'; END IF;
  IF _equipe.criador_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.equipe_membros
    WHERE equipe_id = _equipe_id AND user_id = auth.uid() AND papel = 'admin'
  ) THEN
    RAISE EXCEPTION 'apenas o admin pode promover co-admin';
  END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'você não pode se promover'; END IF;

  UPDATE public.equipe_membros
    SET papel = 'co_admin'
  WHERE equipe_id = _equipe_id AND user_id = _user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'usuário não é membro desta equipe'; END IF;

  -- Notificar promovido
  PERFORM public.notify(
    _user_id, 'equipe_atualizada',
    format('Você foi promovido a co-admin da equipe! Suas aprovações serão necessárias em decisões importantes.'),
    _equipe_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.promover_coadmin_equipe(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promover_coadmin_equipe(uuid, uuid) TO authenticated;

-- ─── 9. Função: rebaixar co-admin ────────────────────────────────

CREATE OR REPLACE FUNCTION public.rebaixar_coadmin_equipe(
  _equipe_id uuid,
  _user_id   uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.equipes
    WHERE id = _equipe_id AND criador_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.equipe_membros
    WHERE equipe_id = _equipe_id AND user_id = auth.uid() AND papel = 'admin'
  ) THEN
    RAISE EXCEPTION 'apenas o admin pode rebaixar co-admin';
  END IF;

  UPDATE public.equipe_membros
    SET papel = 'membro'
  WHERE equipe_id = _equipe_id AND user_id = _user_id AND papel = 'co_admin';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rebaixar_coadmin_equipe(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebaixar_coadmin_equipe(uuid, uuid) TO authenticated;

-- ─── 10. Função: validação dupla — justificativa de equipe ────────

CREATE OR REPLACE FUNCTION public.validar_justificativa_equipe_dupla(
  _justificativa_id uuid,
  _aprovar          boolean,
  _comentario       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _just   public.justificativas_falta;
  _equipe public.equipes;
  _papel  text;
  _tem_coadmin boolean;
  _ambos_aprovaram boolean;
BEGIN
  SELECT * INTO _just FROM public.justificativas_falta WHERE id = _justificativa_id;
  IF _just.id IS NULL THEN RAISE EXCEPTION 'justificativa não encontrada'; END IF;

  -- Identificar papel do chamador
  SELECT em.papel INTO _papel
  FROM public.desafios_equipe de
  JOIN public.equipes e ON e.id = de.equipe_id
  JOIN public.equipe_membros em ON em.equipe_id = e.id AND em.user_id = auth.uid()
  WHERE de.id = _just.desafio_id;

  IF _papel NOT IN ('admin', 'co_admin') AND NOT EXISTS (
    SELECT 1 FROM public.equipes e
    JOIN public.desafios_equipe de ON de.equipe_id = e.id
    WHERE de.id = _just.desafio_id AND e.criador_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'apenas admin ou co-admin pode validar justificativas';
  END IF;

  -- Verificar se há co-admin nesta equipe
  SELECT EXISTS (
    SELECT 1 FROM public.desafios_equipe de
    JOIN public.equipe_membros em ON em.equipe_id = de.equipe_id
    WHERE de.id = _just.desafio_id AND em.papel = 'co_admin'
  ) INTO _tem_coadmin;

  IF _papel IN ('admin') OR NOT _tem_coadmin THEN
    -- Admin principal ou sem co-admin → registrar aprovação do admin
    UPDATE public.justificativas_falta
      SET aprovado_por = auth.uid(),
          status = CASE
            WHEN NOT _tem_coadmin THEN (CASE WHEN _aprovar THEN 'aprovada' ELSE 'recusada' END)
            ELSE 'aguardando_coadmin'
          END
    WHERE id = _justificativa_id;

  ELSIF _papel = 'co_admin' THEN
    -- Co-admin → registrar aprovação do co-admin
    UPDATE public.justificativas_falta
      SET aprovado_coadmin = _aprovar,
          coadmin_id = auth.uid()
    WHERE id = _justificativa_id;
  END IF;

  -- Recarregar para verificar se ambos aprovaram
  SELECT * INTO _just FROM public.justificativas_falta WHERE id = _justificativa_id;

  -- Se admin e co-admin já decidiram → definir status final
  IF _just.aprovado_por IS NOT NULL AND _just.aprovado_coadmin IS NOT NULL THEN
    _ambos_aprovaram := (_just.aprovado_coadmin = true);
    UPDATE public.justificativas_falta
      SET status = CASE WHEN _ambos_aprovaram THEN 'aprovada' ELSE 'recusada' END
    WHERE id = _justificativa_id;

    -- Notificar solicitante
    PERFORM public.notify(
      _just.user_id, 'justificativa_resultado',
      CASE WHEN _ambos_aprovaram
        THEN 'Sua justificativa foi aprovada pelo admin e co-admin da equipe! ✓'
        ELSE 'Sua justificativa foi recusada. Admin e co-admin precisavam aprovar.'
      END,
      _just.desafio_id
    );
  ELSIF _just.status = 'aguardando_coadmin' AND _just.aprovado_por IS NOT NULL THEN
    -- Notificar co-admin que há uma justificativa aguardando
    DECLARE _coadmin_id uuid;
    BEGIN
      SELECT em.user_id INTO _coadmin_id
      FROM public.desafios_equipe de
      JOIN public.equipe_membros em ON em.equipe_id = de.equipe_id
      WHERE de.id = _just.desafio_id AND em.papel = 'co_admin'
      LIMIT 1;

      IF _coadmin_id IS NOT NULL THEN
        PERFORM public.notify(
          _coadmin_id, 'justificativa_pendente',
          'O admin aprovou uma justificativa que precisa da sua confirmação como co-admin.',
          _just.desafio_id
        );
      END IF;
    END;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validar_justificativa_equipe_dupla(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_justificativa_equipe_dupla(uuid, boolean, text) TO authenticated;

-- ─── 11. pg_cron: auto-aprovação de check-ins após 24h ───────────

CREATE OR REPLACE FUNCTION public.auto_aprovar_checkins_arbitro()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rec record;
BEGIN
  -- Buscar check-ins pendentes há mais de 24h
  FOR _rec IN
    SELECT c.id, c.meta_id, c.user_id, c.created_at,
           a.user_id as arbitro_id
    FROM public.checkins c
    JOIN public.arbitros a ON a.meta_id = c.meta_id AND a.status = 'aceito'
    LEFT JOIN public.checkin_validacoes cv ON cv.checkin_id = c.id AND cv.arbitro_id = a.user_id
    WHERE c.validado = false
      AND c.created_at < now() - interval '24 hours'
      AND cv.id IS NULL
  LOOP
    -- Auto-aprovar
    UPDATE public.checkins SET validado = true WHERE id = _rec.id;

    INSERT INTO public.checkin_validacoes (checkin_id, arbitro_id, status, comentario)
    VALUES (_rec.id, _rec.arbitro_id, 'validado', 'Auto-aprovado após 24h sem resposta do árbitro')
    ON CONFLICT DO NOTHING;

    -- Penalizar árbitro por não validar no prazo
    PERFORM public.dar_reputacao_arbitro(
      _rec.arbitro_id, -2, 'nao_validou_prazo_checkin_' || _rec.id
    );

    -- Notificar usuário
    PERFORM public.notify(
      _rec.user_id, 'checkin_validado',
      'Seu check-in foi aprovado automaticamente pois o árbitro não respondeu em 24h.',
      _rec.meta_id
    );
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auto_aprovar_checkins_arbitro() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_aprovar_checkins_arbitro() TO service_role;

-- Agendar às 01:00 (após todos os outros crons noturnos)
SELECT cron.unschedule('vrenn-auto-aprovar-checkins') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'vrenn-auto-aprovar-checkins'
);
SELECT cron.schedule(
  'vrenn-auto-aprovar-checkins',
  '0 1 * * *',
  $$ SELECT public.auto_aprovar_checkins_arbitro(); $$
);

-- ─── 12. Função: validar check-in pelo árbitro (com reputação) ───

CREATE OR REPLACE FUNCTION public.arbitro_validar_checkin(
  _checkin_id  uuid,
  _status      text,  -- 'validado' ou 'questionado'
  _comentario  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _checkin record;
  _arbitro_id uuid := auth.uid();
  _horas_decorridas numeric;
BEGIN
  IF _status NOT IN ('validado', 'questionado') THEN
    RAISE EXCEPTION 'status inválido: use validado ou questionado';
  END IF;
  IF _status = 'questionado' AND (_comentario IS NULL OR length(trim(_comentario)) = 0) THEN
    RAISE EXCEPTION 'comentário obrigatório ao questionar um check-in';
  END IF;

  SELECT c.*, a.user_id as arb_id
  INTO _checkin
  FROM public.checkins c
  JOIN public.arbitros a ON a.meta_id = c.meta_id AND a.user_id = _arbitro_id AND a.status = 'aceito'
  WHERE c.id = _checkin_id;

  IF _checkin.id IS NULL THEN RAISE EXCEPTION 'check-in não encontrado ou você não é árbitro desta meta'; END IF;

  -- Inserir/atualizar validação
  INSERT INTO public.checkin_validacoes (checkin_id, arbitro_id, status, comentario)
  VALUES (_checkin_id, _arbitro_id, _status, _comentario)
  ON CONFLICT (checkin_id, arbitro_id) DO UPDATE
    SET status = EXCLUDED.status, comentario = EXCLUDED.comentario;

  IF _status = 'validado' THEN
    UPDATE public.checkins SET validado = true WHERE id = _checkin_id;
  END IF;

  -- Calcular horas decorridas desde o check-in
  _horas_decorridas := EXTRACT(EPOCH FROM (now() - _checkin.created_at)) / 3600;

  -- Reputação por validar no prazo (< 24h)
  IF _horas_decorridas < 24 THEN
    PERFORM public.dar_reputacao_arbitro(_arbitro_id, 3, 'validou_checkin_prazo_' || _checkin_id);
  END IF;

  -- Notificar dono do check-in
  PERFORM public.notify(
    _checkin.user_id,
    CASE WHEN _status = 'validado' THEN 'checkin_validado' ELSE 'checkin_questionado' END,
    CASE WHEN _status = 'validado'
      THEN 'Seu check-in foi aprovado pelo árbitro ✓'
      ELSE format('Seu check-in foi questionado: %s', _comentario)
    END,
    _checkin.meta_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.arbitro_validar_checkin(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arbitro_validar_checkin(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
