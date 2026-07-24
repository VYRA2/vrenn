-- ═══════════════════════════════════════════════════════════════════
-- VRENN Master Season — Encerramento automático e distribuição de prêmio
-- ═══════════════════════════════════════════════════════════════════

-- 1. Função principal de encerramento
CREATE OR REPLACE FUNCTION public.encerrar_temporada(p_temporada_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp            record;
  participante    record;
  vencedores      record[];
  total_vencedores int;
  premio_por_pessoa numeric(12,2);
  v_fundo         numeric(12,2);
  resultado       jsonb;
BEGIN
  -- Buscar temporada
  SELECT * INTO temp FROM temporadas WHERE id = p_temporada_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'Temporada não encontrada');
  END IF;
  IF temp.status = 'encerrada' THEN
    RETURN jsonb_build_object('erro', 'Temporada já encerrada');
  END IF;

  -- Marcar temporada como encerrada
  UPDATE temporadas SET status = 'encerrada', updated_at = now()
  WHERE id = p_temporada_id;

  -- Buscar participantes que completaram (não eliminados)
  SELECT COUNT(*) INTO total_vencedores
  FROM temporada_participantes
  WHERE temporada_id = p_temporada_id
    AND eliminado = false
    AND status = 'ativo';

  -- Marcar participantes que completaram
  UPDATE temporada_participantes
  SET status = 'concluido'
  WHERE temporada_id = p_temporada_id
    AND eliminado = false
    AND status = 'ativo';

  -- Calcular prêmio
  v_fundo := COALESCE(temp.fundo_acumulado, 0) + COALESCE(temp.valor_premio_externo, 0);

  IF total_vencedores > 0 AND v_fundo > 0 THEN
    premio_por_pessoa := ROUND(v_fundo / total_vencedores, 2);

    -- Distribuir para cada vencedor via transactions
    FOR participante IN
      SELECT tp.user_id
      FROM temporada_participantes tp
      WHERE tp.temporada_id = p_temporada_id AND tp.status = 'concluido'
    LOOP
      -- Registrar prêmio na wallet
      INSERT INTO transactions (user_id, amount, type, description, reference_id)
      VALUES (
        participante.user_id,
        premio_por_pessoa,
        'prize',
        'Prêmio VRENN Master Season ' || temp.numero,
        p_temporada_id
      ) ON CONFLICT DO NOTHING;

      -- Atualizar saldo
      UPDATE wallets
      SET balance = balance + premio_por_pessoa
      WHERE user_id = participante.user_id;

      -- Notificar vencedor
      PERFORM notify(
        participante.user_id,
        'justificativa_resultado',
        '🏆 Parabéns! Você concluiu o VRENN Master Season ' || temp.numero || ' e recebeu R$ ' ||
          to_char(premio_por_pessoa, 'FM999G999D90') || ' de prêmio!',
        p_temporada_id
      );

      -- Dar reputação extra por concluir o Master
      PERFORM dar_reputacao(participante.user_id, 200, 'master_concluido', p_temporada_id);

      -- Desbloquear conquista se ainda não tem
      PERFORM desbloquear_conquista(participante.user_id, 'master_concluido');
    END LOOP;
  END IF;

  -- Notificar eliminados também
  FOR participante IN
    SELECT tp.user_id
    FROM temporada_participantes tp
    WHERE tp.temporada_id = p_temporada_id AND tp.eliminado = true
  LOOP
    PERFORM notify(
      participante.user_id,
      'justificativa_resultado',
      'O VRENN Master Season ' || temp.numero || ' encerrou. Você foi eliminado antes do fim. Na próxima temporada vai ser diferente! 💪',
      p_temporada_id
    );
  END LOOP;

  resultado := jsonb_build_object(
    'temporada', temp.titulo,
    'vencedores', total_vencedores,
    'fundo_distribuido', v_fundo,
    'premio_por_pessoa', premio_por_pessoa
  );

  RETURN resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encerrar_temporada(uuid) TO authenticated;

-- 2. Cron: verificar diariamente se alguma temporada venceu o prazo (00h20)
CREATE OR REPLACE FUNCTION public.verificar_temporadas_encerradas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp record;
  resultado jsonb;
BEGIN
  FOR temp IN
    SELECT id, titulo, numero
    FROM temporadas
    WHERE status = 'ativa'
      AND data_fim < current_date
  LOOP
    resultado := encerrar_temporada(temp.id);
    RAISE NOTICE 'Temporada % encerrada: %', temp.numero, resultado;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verificar_temporadas_encerradas() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'vrenn-encerrar-temporadas',
  '20 0 * * *',
  $$ SELECT public.verificar_temporadas_encerradas(); $$
);

-- 3. Conquista de conclusão do Master (nova — adicionar ao catálogo)
-- (o slug 'master_concluido' precisa ser adicionado no frontend)

-- 4. Função para admin encerrar manualmente antes do prazo
CREATE OR REPLACE FUNCTION public.encerrar_temporada_manual(p_temporada_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só o criador da temporada pode encerrar manualmente
  IF NOT EXISTS (
    SELECT 1 FROM temporadas
    WHERE id = p_temporada_id AND criado_por = p_admin_id
  ) THEN
    RETURN jsonb_build_object('erro', 'Sem permissão');
  END IF;

  RETURN encerrar_temporada(p_temporada_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.encerrar_temporada_manual(uuid, uuid) TO authenticated;

