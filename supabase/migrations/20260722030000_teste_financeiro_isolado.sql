-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Função de teste financeiro isolada (sem dependências externas)
-- Calcula e retorna a distribuição sem tocar em tabelas reais
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.teste_desafio_equipe_financeiro()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n_total        int     := 50;
  _n_winners      int     := 5;
  _entrada        numeric := 50.00;
  _taxa_vrenn_pct numeric := 0.125;  -- 12.5% VRENN quando falha
  _fundo_pct      numeric := 0.125;  -- 12.5% fundo temporada
  _premio_pct     numeric := 0.75;   -- 75% vai pro pool de prêmios
  _vrenn_concluiu numeric := 0.03;   -- 3% VRENN quando conclui
  _n_losers       int;
  _custodias_total numeric;
  _taxa_vrenn_total numeric;
  _fundo_total     numeric;
  _pool_premios    numeric;
  _pcts_prop       numeric[] := ARRAY[0.35,0.25,0.18,0.12,0.10];
  _soma_pcts       numeric   := 0;
  _distribuicao    jsonb     := '[]'::jsonb;
  _pct             numeric;
  _premio          numeric;
  _total_distribuido numeric := 0;
  _seed_count      int;
BEGIN
  -- Verificar usuários seed disponíveis
  SELECT COUNT(*) INTO _seed_count FROM public.profiles WHERE is_seed = true;

  _n_losers        := _n_total - _n_winners;
  _custodias_total := _n_total * _entrada;

  -- Financeiro dos perdedores (45 pessoas)
  _taxa_vrenn_total := ROUND(_n_losers * _entrada * _taxa_vrenn_pct, 2)
                     + ROUND(_n_winners * _entrada * _vrenn_concluiu, 2);
  _fundo_total      := ROUND(_n_losers * _entrada * _fundo_pct, 2);
  _pool_premios     := ROUND(_n_losers * _entrada * _premio_pct, 2);

  -- Normalizar percentuais proporcionais para _n_winners posições
  FOR i IN 1.._n_winners LOOP
    _soma_pcts := _soma_pcts + _pcts_prop[i];
  END LOOP;

  -- Calcular distribuição por posição
  FOR i IN 1.._n_winners LOOP
    _pct    := ROUND(_pcts_prop[i] / _soma_pcts, 4);
    _premio := ROUND(_pool_premios * _pct, 2);
    _total_distribuido := _total_distribuido + _premio;

    _distribuicao := _distribuicao || jsonb_build_object(
      'posicao',         i,
      'pct_pool',        ROUND(_pct * 100, 1),
      'premio_extra',    _premio,
      'custodia_volta',  _entrada - ROUND(_entrada * _vrenn_concluiu, 2),
      'total_recebe',    (_entrada - ROUND(_entrada * _vrenn_concluiu, 2)) + _premio,
      'lucro_liquido',   _premio - ROUND(_entrada * _vrenn_concluiu, 2)
    );
  END LOOP;

  RETURN jsonb_build_object(
    -- Configuração do teste
    'config', jsonb_build_object(
      'n_participantes',   _n_total,
      'n_vencedores',      _n_winners,
      'n_perdedores',      _n_losers,
      'entrada_por_pessoa', _entrada,
      'modo_distribuicao', 'proporcional',
      'criterio_ranking',  'checkins'
    ),
    -- Usuários seed disponíveis
    'seed_usuarios_disponiveis', _seed_count,
    -- Fluxo financeiro completo
    'financeiro', jsonb_build_object(
      'custodia_total',          _custodias_total,
      'taxa_vrenn_total',        _taxa_vrenn_total,
      'fundo_temporada',         _fundo_total,
      'pool_premios',            _pool_premios,
      'total_distribuido',       _total_distribuido,
      'diferenca_arredondamento', ROUND(_pool_premios - _total_distribuido, 2)
    ),
    -- Verificações
    'verificacoes', jsonb_build_object(
      'soma_pcts_100pct',      ABS(_soma_pcts - 1.0) < 0.001,
      'pool_correto',          _pool_premios = ROUND(_n_losers * _entrada * 0.75, 2),
      'taxa_vrenn_correta',    _taxa_vrenn_total > 0,
      'total_fechado',         ABS(_custodias_total - _taxa_vrenn_total - _fundo_total - _pool_premios
                                   - (_n_winners * (_entrada * (1 - _vrenn_concluiu)))) < 1.0
    ),
    -- Distribuição por posição
    'distribuicao', _distribuicao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.teste_desafio_equipe_financeiro() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.teste_desafio_equipe_financeiro() FROM anon;

NOTIFY pgrst, 'reload schema';
