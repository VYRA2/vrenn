-- ═══════════════════════════════════════════════════════════════════
-- VRENN Master Season — Tabelas de Temporadas
-- ═══════════════════════════════════════════════════════════════════

-- 1. Tabela principal de temporadas
CREATE TABLE IF NOT EXISTS public.temporadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identidade
  numero integer NOT NULL,           -- ex: 1, 2, 3...
  titulo text NOT NULL,              -- ex: "Season 1 — 30 Dias de Movimento"
  descricao text,                    -- descrição pública da temporada
  modalidade text NOT NULL,          -- ex: "treino", "leitura", "alimentação"
  -- Datas
  data_inicio date NOT NULL,
  data_fim date NOT NULL,            -- data_inicio + 90 dias por padrão
  -- Participação
  taxa_entrada numeric(10,2) NOT NULL DEFAULT 10.00,
  max_participantes integer,         -- null = ilimitado
  -- Desafio
  frequencia_tipo text NOT NULL DEFAULT 'diario'
    CHECK (frequencia_tipo IN ('diario','semanal','total')),
  frequencia_quantidade integer NOT NULL DEFAULT 1,
  tolerancia_faltas integer NOT NULL DEFAULT 0, -- 0 = faltou uma = eliminado
  -- Prêmio
  tipo_premio text NOT NULL DEFAULT 'fundo'
    CHECK (tipo_premio IN ('fundo','externo','combinado')),
  descricao_premio text,             -- ex: "Viagem para Miami + fundo acumulado"
  valor_premio_externo numeric(10,2) DEFAULT 0,
  -- Regulamento e termo
  regulamento text,                  -- texto completo do regulamento da temporada
  -- Status
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','inscricoes_abertas','ativa','encerrada')),
  -- Fundo acumulado (atualizado via trigger)
  fundo_acumulado numeric(10,2) NOT NULL DEFAULT 0,
  -- Auditoria
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.temporadas ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.temporadas TO anon, authenticated;
GRANT ALL ON public.temporadas TO service_role;

CREATE POLICY "temporadas_select" ON public.temporadas
  FOR SELECT USING (true);
CREATE POLICY "temporadas_insert_moderador" ON public.temporadas
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());
CREATE POLICY "temporadas_update_moderador" ON public.temporadas
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid());

-- 2. Participantes da temporada
CREATE TABLE IF NOT EXISTS public.temporada_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada_id uuid NOT NULL REFERENCES public.temporadas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Financeiro
  taxa_paga numeric(10,2) NOT NULL DEFAULT 0,
  valor_custodia numeric(10,2) NOT NULL DEFAULT 0,
  -- Status
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','eliminado','concluido')),
  eliminado boolean NOT NULL DEFAULT false,
  eliminado_em timestamptz,
  motivo_eliminacao text,
  faltas integer NOT NULL DEFAULT 0,
  -- Progresso
  total_checkins integer NOT NULL DEFAULT 0,
  ultimo_checkin date,
  -- Aceite do termo
  termo_aceito_em timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (temporada_id, user_id)
);

ALTER TABLE public.temporada_participantes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.temporada_participantes TO authenticated;
GRANT ALL ON public.temporada_participantes TO service_role;

CREATE POLICY "temp_part_select" ON public.temporada_participantes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "temp_part_insert" ON public.temporada_participantes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "temp_part_update_self" ON public.temporada_participantes
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 3. Check-ins da temporada
CREATE TABLE IF NOT EXISTS public.temporada_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada_id uuid NOT NULL REFERENCES public.temporadas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  foto_url text,
  mensagem text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (temporada_id, user_id, (created_at::date)) -- 1 por dia por temporada
);

ALTER TABLE public.temporada_checkins ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.temporada_checkins TO authenticated;
GRANT ALL ON public.temporada_checkins TO service_role;

CREATE POLICY "temp_checkins_select" ON public.temporada_checkins
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "temp_checkins_insert" ON public.temporada_checkins
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 4. Trigger: check-in na temporada atualiza progresso do participante
CREATE OR REPLACE FUNCTION public.trg_temporada_checkin_progresso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE temporada_participantes
  SET
    total_checkins = total_checkins + 1,
    ultimo_checkin = NEW.created_at::date
  WHERE temporada_id = NEW.temporada_id AND user_id = NEW.user_id;

  -- Reputação: +5 pts por check-in na temporada
  PERFORM dar_reputacao(NEW.user_id, 5, 'checkin_master', NEW.temporada_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_temporada_checkin_progresso ON public.temporada_checkins;
CREATE TRIGGER trg_temporada_checkin_progresso
  AFTER INSERT ON public.temporada_checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_temporada_checkin_progresso();

-- 5. Trigger: entrada na temporada — taxa vai para o VRENN, custódia para o fundo
CREATE OR REPLACE FUNCTION public.trg_temporada_entrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Atualizar fundo acumulado da temporada com o valor em custódia
  UPDATE temporadas
  SET fundo_acumulado = fundo_acumulado + NEW.valor_custodia
  WHERE id = NEW.temporada_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_temporada_entrada ON public.temporada_participantes;
CREATE TRIGGER trg_temporada_entrada
  AFTER INSERT ON public.temporada_participantes
  FOR EACH ROW EXECUTE FUNCTION public.trg_temporada_entrada();

-- 6. Cron: verificação diária de eliminações do Master (00h15)
CREATE OR REPLACE FUNCTION public.processar_eliminacoes_master()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ontem date := current_date - 1;
  temp record;
  part record;
BEGIN
  FOR temp IN
    SELECT t.*
    FROM temporadas t
    WHERE t.status = 'ativa'
      AND t.frequencia_tipo = 'diario'
  LOOP
    FOR part IN
      SELECT tp.*
      FROM temporada_participantes tp
      WHERE tp.temporada_id = temp.id
        AND tp.eliminado = false
        AND tp.status = 'ativo'
    LOOP
      -- Verificar se fez check-in ontem
      IF NOT EXISTS (
        SELECT 1 FROM temporada_checkins tc
        WHERE tc.temporada_id = temp.id
          AND tc.user_id = part.user_id
          AND tc.created_at::date = ontem
      ) AND NOT EXISTS (
        SELECT 1 FROM justificativas_falta jf
        WHERE jf.user_id = part.user_id
          AND jf.data_referencia = ontem
          AND jf.status = 'aprovado'
      ) THEN
        -- Incrementar faltas
        UPDATE temporada_participantes
        SET faltas = faltas + 1
        WHERE id = part.id;

        -- Eliminar se ultrapassou tolerância
        IF part.faltas + 1 > temp.tolerancia_faltas THEN
          UPDATE temporada_participantes
          SET
            eliminado = true,
            eliminado_em = now(),
            motivo_eliminacao = 'ausencia',
            status = 'eliminado'
          WHERE id = part.id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.processar_eliminacoes_master() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'vrenn-master-eliminacoes',
  '15 0 * * *',
  $$ SELECT public.processar_eliminacoes_master(); $$
);

-- 7. Índices de performance
CREATE INDEX IF NOT EXISTS idx_temporadas_status ON public.temporadas (status);
CREATE INDEX IF NOT EXISTS idx_temp_part_temporada ON public.temporada_participantes (temporada_id, status);
CREATE INDEX IF NOT EXISTS idx_temp_part_user ON public.temporada_participantes (user_id);
CREATE INDEX IF NOT EXISTS idx_temp_checkins_temporada_user ON public.temporada_checkins (temporada_id, user_id, created_at DESC);

