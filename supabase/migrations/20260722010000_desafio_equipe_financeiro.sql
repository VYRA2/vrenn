-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Motor financeiro completo de desafio de equipe
-- Percentuais conforme tabela oficial:
--   Concluiu: 97% de volta, 3% VRENN
--   Falhou:   0% de volta, 75% → premio_acumulado, 12.5% → fundo_temporada, 12.5% → VRENN
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Expandir desafios_equipe com campos financeiros e de configuração ───

ALTER TABLE public.desafios_equipe
  ADD COLUMN IF NOT EXISTS premio_acumulado     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modo_distribuicao    text NOT NULL DEFAULT 'proporcional'
    CHECK (modo_distribuicao IN ('igual', 'proporcional', 'personalizado')),
  ADD COLUMN IF NOT EXISTS colocacoes_premiadas int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS criterio_ranking     text NOT NULL DEFAULT 'checkins'
    CHECK (criterio_ranking IN ('checkins', 'progresso', 'streak', 'primeiro_a_concluir')),
  ADD COLUMN IF NOT EXISTS distribuicao_custom  jsonb DEFAULT NULL;

COMMENT ON COLUMN public.desafios_equipe.premio_acumulado IS
  '75% da custódia de cada participante que falhou — acumulado durante o desafio';
COMMENT ON COLUMN public.desafios_equipe.modo_distribuicao IS
  'igual=partes iguais entre concluintes, proporcional=35/25/18/12/10, personalizado=distribuicao_custom';
COMMENT ON COLUMN public.desafios_equipe.colocacoes_premiadas IS
  'Quantas posições recebem prêmio do premio_acumulado (NULL = todos que concluíram)';
COMMENT ON COLUMN public.desafios_equipe.criterio_ranking IS
  'Como ranquear vencedores: checkins=mais check-ins, progresso=% maior, streak=mais dias seguidos, primeiro_a_concluir=data de conclusão';
COMMENT ON COLUMN public.desafios_equipe.distribuicao_custom IS
  'Quando modo=personalizado: [{posicao:1,pct:0.60},{posicao:2,pct:0.25},{posicao:3,pct:0.15}]';

-- ─── 2. Adicionar campo concluiu em desafio_equipe_participantes ───

ALTER TABLE public.desafio_equipe_participantes
  ADD COLUMN IF NOT EXISTS concluiu          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluiu_em       timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS premio_recebido   numeric(12,2) DEFAULT 0;

-- ─── 3. Função auxiliar: calcular percentual por posição ───

CREATE OR REPLACE FUNCTION public.calcular_pct_distribuicao(
  _modo       text,
  _posicao    int,
  _n_winners  int,
  _custom     jsonb DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _pcts_proporcional numeric[] := ARRAY[0.35,0.25,0.18,0.12,0.10,0.07,0.05,0.04,0.03,0.02];
  _soma_proporcional numeric;
  _pct_por_posicao   numeric;
  _custom_entry      jsonb;
BEGIN
  IF _posicao < 1 OR _posicao > _n_winners THEN RETURN 0; END IF;

  IF _modo = 'igual' THEN
    RETURN 1.0 / _n_winners;

  ELSIF _modo = 'proporcional' THEN
    -- Usa os primeiros _n_winners itens do array e normaliza
    _soma_proporcional := 0;
    FOR i IN 1.._n_winners LOOP
      IF i <= array_length(_pcts_proporcional, 1) THEN
        _soma_proporcional := _soma_proporcional + _pcts_proporcional[i];
      ELSE
        _soma_proporcional := _soma_proporcional + 0.02;
      END IF;
    END LOOP;
    IF _posicao <= array_length(_pcts_proporcional, 1) THEN
      RETURN _pcts_proporcional[_posicao] / _soma_proporcional;
    ELSE
      RETURN 0.02 / _soma_proporcional;
    END IF;

  ELSIF _modo = 'personalizado' THEN
    IF _custom IS NULL THEN RETURN 1.0 / _n_winners; END IF;
    SELECT elem INTO _custom_entry
      FROM jsonb_array_elements(_custom) AS elem
     WHERE (elem->>'posicao')::int = _posicao
     LIMIT 1;
    IF _custom_entry IS NULL THEN RETURN 0; END IF;
    RETURN (_custom_entry->>'pct')::numeric;

  END IF;

  RETURN 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_pct_distribuicao(text, int, int, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_pct_distribuicao(text, int, int, jsonb) TO service_role;

-- ─── 4. Função: resolve_desafio_equipe_participante (trigger por participante) ───
-- Roda quando desafio_equipe_participantes.eliminado muda OU concluiu muda
-- Registra os valores financeiros intermediários mas NÃO distribui prêmio ainda

CREATE OR REPLACE FUNCTION public.resolve_desafio_equipe_participante()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _desafio         public.desafios_equipe;
  _wallet_id       uuid;
  _custodia        numeric(12,2);
  _vrenn_fee       numeric(12,2);
  _fundo_fatia     numeric(12,2);
  _premio_fatia    numeric(12,2);
BEGIN
  -- Só agir quando concluiu ou eliminado mudam de false → true
  IF NOT (
    (NEW.concluiu = true AND (OLD.concluiu IS DISTINCT FROM true)) OR
    (NEW.eliminado = true AND (OLD.eliminado IS DISTINCT FROM true))
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _desafio FROM public.desafios_equipe WHERE id = NEW.desafio_id;
  IF _desafio.id IS NULL OR _desafio.valor_entrada = 0 THEN RETURN NEW; END IF;

  _custodia := _desafio.valor_entrada;

  SELECT id INTO _wallet_id FROM public.wallets WHERE user_id = NEW.user_id;
  IF _wallet_id IS NULL THEN RETURN NEW; END IF;

  -- ── CONCLUIU: 97% de volta, 3% VRENN ──
  IF NEW.concluiu = true THEN
    _vrenn_fee := ROUND(_custodia * 0.03, 2);

    -- Devolver custódia (97%) → unlock e creditar balance
    UPDATE public.wallets
       SET locked_balance = GREATEST(0, locked_balance - _custodia),
           balance        = balance + (_custodia - _vrenn_fee),
           updated_at     = now()
     WHERE user_id = NEW.user_id;

    INSERT INTO public.transactions
      (user_id, type, amount, status, description, meta_id)
    VALUES
      (NEW.user_id, 'unlock', _custodia - _vrenn_fee, 'confirmed',
       'Desafio de equipe concluído — custódia devolvida (97%)', NULL),
      (NEW.user_id, 'fee',    _vrenn_fee,              'confirmed',
       'Taxa VRENN desafio de equipe (3%)', NULL);

    NEW.concluiu_em := now();

  -- ── FALHOU/ELIMINADO: 0% de volta, 75% premio, 12.5% fundo, 12.5% VRENN ──
  ELSIF NEW.eliminado = true THEN
    _premio_fatia := ROUND(_custodia * 0.75, 2);
    _fundo_fatia  := ROUND(_custodia * 0.125, 2);
    _vrenn_fee    := _custodia - _premio_fatia - _fundo_fatia; -- resto = 12.5%

    -- Remover do locked_balance (custódia absorvida)
    UPDATE public.wallets
       SET locked_balance = GREATEST(0, locked_balance - _custodia),
           updated_at     = now()
     WHERE user_id = NEW.user_id;

    -- Acumular 75% no prize pool do desafio
    UPDATE public.desafios_equipe
       SET premio_acumulado = premio_acumulado + _premio_fatia
     WHERE id = NEW.desafio_id;

    -- Registrar transações
    INSERT INTO public.transactions
      (user_id, type, amount, status, description, meta_id)
    VALUES
      (NEW.user_id, 'lock',  _custodia,     'confirmed',
       'Custódia absorvida — falhou no desafio de equipe', NULL),
      (NEW.user_id, 'fee',   _vrenn_fee,    'confirmed',
       'Taxa VRENN desafio de equipe falhou (12.5%)', NULL);

    -- Creditar fundo da temporada
    UPDATE public.fundo_temporada
       SET total = total + _fundo_fatia
     WHERE categoria = _desafio.categoria;

    IF NOT FOUND THEN
      INSERT INTO public.fundo_temporada (categoria, total)
      VALUES (_desafio.categoria, _fundo_fatia)
      ON CONFLICT (categoria) DO UPDATE
        SET total = fundo_temporada.total + EXCLUDED.total;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_desafio_equipe_participante() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_desafio_equipe_participante() TO service_role;

DROP TRIGGER IF EXISTS trg_resolve_desafio_participante ON public.desafio_equipe_participantes;
CREATE TRIGGER trg_resolve_desafio_participante
  BEFORE UPDATE OF concluiu, eliminado ON public.desafio_equipe_participantes
  FOR EACH ROW EXECUTE FUNCTION public.resolve_desafio_equipe_participante();

-- ─── 5. Função principal: resolver_desafio_equipe (chamada ao encerrar) ───
-- Distribui premio_acumulado entre os vencedores ranqueados

CREATE OR REPLACE FUNCTION public.resolver_desafio_equipe(_desafio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _desafio         public.desafios_equipe;
  _n_concluintes   int;
  _n_winners       int;
  _pool            numeric(12,2);
  _pos             int := 0;
  _pct             numeric;
  _premio          numeric(12,2);
  _rec             record;
  _resultado       jsonb := '[]'::jsonb;
  _order_clause    text;
BEGIN
  SELECT * INTO _desafio FROM public.desafios_equipe WHERE id = _desafio_id FOR UPDATE;
  IF _desafio.id IS NULL THEN RAISE EXCEPTION 'desafio não encontrado'; END IF;
  IF _desafio.status = 'concluido' THEN RAISE EXCEPTION 'desafio já foi resolvido'; END IF;

  -- Contar concluintes
  SELECT COUNT(*) INTO _n_concluintes
    FROM public.desafio_equipe_participantes
   WHERE desafio_id = _desafio_id AND concluiu = true AND eliminado = false;

  _pool := _desafio.premio_acumulado;

  -- Se ninguém concluiu → tudo vai pro fundo_temporada
  IF _n_concluintes = 0 THEN
    UPDATE public.fundo_temporada
       SET total = total + _pool
     WHERE categoria = _desafio.categoria;
    IF NOT FOUND THEN
      INSERT INTO public.fundo_temporada (categoria, total)
      VALUES (_desafio.categoria, _pool)
      ON CONFLICT (categoria) DO UPDATE
        SET total = fundo_temporada.total + EXCLUDED.total;
    END IF;
    UPDATE public.desafios_equipe
       SET status = 'concluido', premio_acumulado = 0 WHERE id = _desafio_id;
    RETURN jsonb_build_object('concluintes', 0, 'pool_redirecionado_fundo', _pool);
  END IF;

  -- Número real de posições premiadas
  _n_winners := COALESCE(_desafio.colocacoes_premiadas, _n_concluintes);
  _n_winners := LEAST(_n_winners, _n_concluintes);

  -- Critério de ranking → ORDER BY dinâmico
  _order_clause := CASE _desafio.criterio_ranking
    WHEN 'checkins'              THEN 'progresso DESC, concluiu_em ASC NULLS LAST'
    WHEN 'progresso'             THEN 'progresso DESC, concluiu_em ASC NULLS LAST'
    WHEN 'streak'                THEN 'progresso DESC, concluiu_em ASC NULLS LAST'
    WHEN 'primeiro_a_concluir'   THEN 'concluiu_em ASC NULLS LAST, progresso DESC'
    ELSE                              'progresso DESC, concluiu_em ASC NULLS LAST'
  END;

  -- Distribuir prêmio por posição
  FOR _rec IN EXECUTE format(
    'SELECT user_id, progresso, concluiu_em,
            row_number() OVER (ORDER BY %s) AS posicao
       FROM public.desafio_equipe_participantes
      WHERE desafio_id = %L AND concluiu = true AND eliminado = false
      LIMIT %s',
    _order_clause, _desafio_id, _n_winners
  ) LOOP
    _pct   := public.calcular_pct_distribuicao(
                _desafio.modo_distribuicao,
                _rec.posicao::int,
                _n_winners,
                _desafio.distribuicao_custom
              );
    _premio := ROUND(_pool * _pct, 2);

    IF _premio > 0 THEN
      UPDATE public.wallets
         SET balance    = balance + _premio,
             updated_at = now()
       WHERE user_id = _rec.user_id;

      INSERT INTO public.transactions
        (user_id, type, amount, status, description)
      VALUES
        (_rec.user_id, 'prize', _premio, 'confirmed',
         format('Prêmio desafio de equipe — %sº lugar', _rec.posicao));

      UPDATE public.desafio_equipe_participantes
         SET premio_recebido = _premio
       WHERE desafio_id = _desafio_id AND user_id = _rec.user_id;
    END IF;

    _resultado := _resultado || jsonb_build_object(
      'posicao',  _rec.posicao,
      'user_id',  _rec.user_id,
      'pct',      ROUND(_pct * 100, 1),
      'premio',   _premio
    );
  END LOOP;

  -- Fechar desafio
  UPDATE public.desafios_equipe
     SET status = 'concluido', premio_acumulado = 0
   WHERE id = _desafio_id;

  RETURN jsonb_build_object(
    'concluintes',  _n_concluintes,
    'premiados',    _n_winners,
    'pool_total',   _pool,
    'modo',         _desafio.modo_distribuicao,
    'criterio',     _desafio.criterio_ranking,
    'distribuicao', _resultado
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_desafio_equipe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_desafio_equipe(uuid) TO service_role;

-- ─── 6. Teste financeiro com dados seed ───
-- Simula: 50 participantes, R$50 entrada, 5 vencedores, modo proporcional, criterio checkins

CREATE OR REPLACE FUNCTION public.teste_desafio_equipe_financeiro()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _desafio_id   uuid;
  _equipe_id    uuid;
  _users        uuid[];
  _i            int;
  _u            uuid;
  _n_total      int := 50;
  _n_winners    int := 5;
  _entrada      numeric := 50.00;
  _resultado    jsonb;
BEGIN
  -- Verificar que há usuários seed disponíveis
  SELECT array_agg(id) INTO _users
    FROM (SELECT id FROM public.profiles WHERE is_seed = true LIMIT _n_total) t;

  IF array_length(_users, 1) IS NULL OR array_length(_users, 1) < _n_total THEN
    RAISE EXCEPTION 'Usuários seed insuficientes. Esperado %, encontrado %',
      _n_total, COALESCE(array_length(_users, 1), 0);
  END IF;

  -- Criar equipe seed
  INSERT INTO public.equipes (nome, descricao, categoria, criador_id, is_seed)
  VALUES ('Equipe Teste Financeiro', 'Teste automatizado de custódia', 'fitness', _users[1], true)
  RETURNING id INTO _equipe_id;

  -- Criar desafio seed com as configurações do teste
  INSERT INTO public.desafios_equipe (
    equipe_id, titulo, descricao, categoria,
    duracao_dias, data_inicio, data_fim,
    valor_entrada, status,
    modo_distribuicao, colocacoes_premiadas,
    criterio_ranking, criador_id, is_seed
  ) VALUES (
    _equipe_id,
    'Desafio 90 dias — Teste Financeiro',
    'Simulação: 50 participantes, R$50, 5 vencedores',
    'fitness',
    90, current_date - 90, current_date,
    _entrada, 'ativo',
    'proporcional', _n_winners,
    'checkins', _users[1], true
  ) RETURNING id INTO _desafio_id;

  -- Garantir wallets e lock de custódia para todos
  FOR _i IN 1.._n_total LOOP
    _u := _users[_i];

    INSERT INTO public.wallets (user_id, balance, locked_balance)
    VALUES (_u, 200.00, _entrada)
    ON CONFLICT (user_id) DO UPDATE
      SET locked_balance = wallets.locked_balance + _entrada,
          updated_at = now();

    INSERT INTO public.transactions (user_id, type, amount, status, description, is_seed)
    VALUES (_u, 'lock', _entrada, 'confirmed', 'Custódia seed desafio equipe', true);

    -- Inserir participante
    INSERT INTO public.desafio_equipe_participantes
      (desafio_id, user_id, progresso, ultimo_checkin, eliminado, concluiu)
    VALUES (_desafio_id, _u, 0, NULL, false, false)
    ON CONFLICT (desafio_id, user_id) DO NOTHING;
  END LOOP;

  -- Top 5 concluem (com progresso decrescente = ranking)
  FOR _i IN 1.._n_winners LOOP
    _u := _users[_i];
    UPDATE public.desafio_equipe_participantes
       SET progresso = (90 - (_i - 1) * 3), -- 90, 87, 84, 81, 78 checkins
           concluiu  = true,
           concluiu_em = now() - ((_i - 1) * interval '1 hour')
     WHERE desafio_id = _desafio_id AND user_id = _u;
  END LOOP;

  -- Restantes 45 são eliminados (ativa o trigger de resolve_desafio_equipe_participante)
  FOR _i IN (_n_winners + 1).._n_total LOOP
    _u := _users[_i];
    UPDATE public.desafio_equipe_participantes
       SET eliminado = true,
           motivo_eliminacao = 'ausencia'
     WHERE desafio_id = _desafio_id AND user_id = _u;
  END LOOP;

  -- Recarregar desafio para ver premio_acumulado
  -- (trigger já acumulou 75% de cada falha = 45 × R$50 × 0.75 = R$1.687,50)

  -- Executar resolução final
  SELECT public.resolver_desafio_equipe(_desafio_id) INTO _resultado;

  RETURN jsonb_build_object(
    'desafio_id',        _desafio_id,
    'equipe_id',         _equipe_id,
    'n_participantes',   _n_total,
    'n_vencedores',      _n_winners,
    'entrada',           _entrada,
    'pool_esperado',     ROUND((_n_total - _n_winners) * _entrada * 0.75, 2),
    'resultado',         _resultado
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teste_desafio_equipe_financeiro() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teste_desafio_equipe_financeiro() TO service_role;

NOTIFY pgrst, 'reload schema';
