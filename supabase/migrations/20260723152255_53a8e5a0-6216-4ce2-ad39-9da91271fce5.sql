
CREATE OR REPLACE FUNCTION public.teste_desafio_equipe_financeiro()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participantes int := 50;
  v_vencedores int := 5;
  v_perdedores int := 45;
  v_entrada numeric := 50;
  v_custodia_total numeric;
  v_valor_perdedores numeric;
  v_pool_premios numeric;
  v_fundo_temporada numeric;
  v_taxa_vrenn numeric;
  v_devolucao_vencedor numeric;
  v_devolucao_total numeric;
  v_pcts numeric[] := ARRAY[35, 25, 18, 12, 10];
  v_soma_pcts numeric;
  v_distribuicao jsonb := '[]'::jsonb;
  v_premio_extra numeric;
  v_total_recebe numeric;
  v_soma_premios numeric := 0;
  v_seed_count int;
  i int;
BEGIN
  SELECT COUNT(*) INTO v_seed_count FROM public.profiles WHERE is_seed = true;

  v_custodia_total := v_participantes * v_entrada;                    -- 2500
  v_valor_perdedores := v_perdedores * v_entrada;                     -- 2250
  v_pool_premios := v_valor_perdedores * 0.75;                        -- 1687.5
  v_fundo_temporada := v_valor_perdedores * 0.125;                    -- 281.25
  v_taxa_vrenn := v_valor_perdedores * 0.125;                         -- 281.25
  v_devolucao_vencedor := v_entrada * 0.97;                           -- 48.5
  v_devolucao_total := v_vencedores * v_devolucao_vencedor;           -- 242.5
  -- taxa VRENN também inclui 3% da custódia dos vencedores
  v_taxa_vrenn := v_taxa_vrenn + (v_vencedores * v_entrada * 0.03);   -- +7.5 = 288.75

  v_soma_pcts := 0;
  FOR i IN 1..array_length(v_pcts, 1) LOOP
    v_soma_pcts := v_soma_pcts + v_pcts[i];
  END LOOP;

  FOR i IN 1..array_length(v_pcts, 1) LOOP
    v_premio_extra := round((v_pool_premios * v_pcts[i] / v_soma_pcts)::numeric, 2);
    v_total_recebe := round((v_devolucao_vencedor + v_premio_extra)::numeric, 2);
    v_soma_premios := v_soma_premios + v_premio_extra;
    v_distribuicao := v_distribuicao || jsonb_build_object(
      'posicao', i,
      'pct_pool', v_pcts[i],
      'premio_extra', v_premio_extra,
      'total_recebe', v_total_recebe
    );
  END LOOP;

  RETURN jsonb_build_object(
    'config', jsonb_build_object(
      'participantes', v_participantes,
      'vencedores', v_vencedores,
      'perdedores', v_perdedores,
      'entrada', v_entrada,
      'pcts_pool_vencedores', to_jsonb(v_pcts),
      'seed_profiles_count', v_seed_count
    ),
    'financeiro', jsonb_build_object(
      'custodia_total', v_custodia_total,
      'pool_premios', v_pool_premios,
      'taxa_vrenn_total', v_taxa_vrenn,
      'fundo_temporada', v_fundo_temporada,
      'devolucao_vencedores_total', v_devolucao_total
    ),
    'verificacoes', jsonb_build_object(
      'soma_perdedores_bate', (v_pool_premios + v_fundo_temporada + (v_valor_perdedores * 0.125)) = v_valor_perdedores,
      'custodia_total_bate', (v_devolucao_total + v_pool_premios + v_fundo_temporada + v_taxa_vrenn) = v_custodia_total,
      'pool_distribuido_bate', round(v_soma_premios::numeric, 2) = round(v_pool_premios::numeric, 2),
      'soma_pcts_100', v_soma_pcts = 100
    ),
    'distribuicao', v_distribuicao
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teste_desafio_equipe_financeiro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teste_desafio_equipe_financeiro() TO authenticated;

NOTIFY pgrst, 'reload schema';
