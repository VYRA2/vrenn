-- ═══════════════════════════════════════════════════════════
-- VRENN — Sistema de Frequência de Check-in + Eliminação
-- ═══════════════════════════════════════════════════════════

-- 1. Campos de frequência nas 3 entidades
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS frequencia_tipo text CHECK (frequencia_tipo IN ('diario','semanal','total')) DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS frequencia_quantidade integer DEFAULT 1;

ALTER TABLE public.duelos
  ADD COLUMN IF NOT EXISTS frequencia_tipo text CHECK (frequencia_tipo IN ('diario','semanal','total')) DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS frequencia_quantidade integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS challenger_eliminado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS challenger_eliminado_em timestamptz,
  ADD COLUMN IF NOT EXISTS opponent_eliminado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS opponent_eliminado_em timestamptz;

ALTER TABLE public.desafios_equipe
  ADD COLUMN IF NOT EXISTS frequencia_tipo text CHECK (frequencia_tipo IN ('diario','semanal','total')) DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS frequencia_quantidade integer DEFAULT 1;

-- 2. Eliminação nos participantes de equipe
ALTER TABLE public.desafio_equipe_participantes
  ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eliminado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_eliminacao text CHECK (motivo_eliminacao IN ('ausencia','desistencia'));

-- 3. duelo_id na tabela checkins + meta_id opcional
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS duelo_id uuid REFERENCES public.duelos(id) ON DELETE CASCADE;
ALTER TABLE public.checkins ALTER COLUMN meta_id DROP NOT NULL;

-- 4. Tabela de justificativas de falta
CREATE TABLE IF NOT EXISTS public.justificativas_falta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meta_id uuid REFERENCES public.metas(id) ON DELETE CASCADE,
  duelo_id uuid REFERENCES public.duelos(id) ON DELETE CASCADE,
  desafio_id uuid REFERENCES public.desafios_equipe(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  motivo text NOT NULL CHECK (length(motivo) BETWEEN 10 AND 500),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  aprovado_por uuid REFERENCES public.profiles(id),
  respondido_em timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (user_id, meta_id, data_referencia),
  UNIQUE NULLS NOT DISTINCT (user_id, duelo_id, data_referencia),
  UNIQUE NULLS NOT DISTINCT (user_id, desafio_id, data_referencia)
);

ALTER TABLE public.justificativas_falta ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.justificativas_falta TO authenticated;
GRANT ALL ON public.justificativas_falta TO service_role;

DROP POLICY IF EXISTS "jf_select" ON public.justificativas_falta;
CREATE POLICY "jf_select" ON public.justificativas_falta
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.duelos d
      WHERE d.id = duelo_id AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.equipe_membros em
      JOIN public.desafios_equipe de ON de.equipe_id = em.equipe_id
      WHERE de.id = desafio_id AND em.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "jf_insert" ON public.justificativas_falta;
CREATE POLICY "jf_insert" ON public.justificativas_falta
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "jf_update" ON public.justificativas_falta;
CREATE POLICY "jf_update" ON public.justificativas_falta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.duelos d WHERE d.id = duelo_id
        AND ((d.challenger_id = auth.uid() AND user_id = d.opponent_id)
          OR (d.opponent_id = auth.uid() AND user_id = d.challenger_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.equipe_membros em
      JOIN public.desafios_equipe de ON de.equipe_id = em.equipe_id
      WHERE de.id = desafio_id AND em.user_id = auth.uid() AND em.papel = 'admin'
    )
  );

-- 5. Função do cron
CREATE OR REPLACE FUNCTION public.processar_eliminacoes_diarias()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  ontem date := current_date - 1;
  semana_inicio date := date_trunc('week', current_date - 1)::date;
BEGIN

  -- METAS SOLO diário
  UPDATE metas m SET status = 'falhada'
  WHERE m.status = 'em_andamento' AND m.frequencia_tipo = 'diario'
    AND NOT EXISTS (
      SELECT 1 FROM checkins c WHERE c.meta_id = m.id AND c.created_at::date = ontem
    )
    AND NOT EXISTS (
      SELECT 1 FROM justificativas_falta j
      WHERE j.meta_id = m.id AND j.user_id = m.user_id
        AND j.data_referencia = ontem AND j.status = 'aprovado'
    );

  -- METAS SOLO semanal (só segunda-feira)
  IF extract(dow FROM current_date) = 1 THEN
    UPDATE metas m SET status = 'falhada'
    WHERE m.status = 'em_andamento' AND m.frequencia_tipo = 'semanal'
      AND (
        SELECT count(*) FROM checkins c
        WHERE c.meta_id = m.id AND c.created_at::date BETWEEN semana_inicio AND ontem
      ) < m.frequencia_quantidade;
  END IF;

  -- DUELOS diário — challenger
  UPDATE duelos d SET challenger_eliminado = true, challenger_eliminado_em = now()
  WHERE d.status = 'ativo' AND d.frequencia_tipo = 'diario' AND d.challenger_eliminado = false
    AND NOT EXISTS (
      SELECT 1 FROM checkins c
      WHERE c.duelo_id = d.id AND c.user_id = d.challenger_id AND c.created_at::date = ontem
    )
    AND NOT EXISTS (
      SELECT 1 FROM justificativas_falta j
      WHERE j.duelo_id = d.id AND j.user_id = d.challenger_id
        AND j.data_referencia = ontem AND j.status = 'aprovado'
    );

  -- DUELOS diário — opponent
  UPDATE duelos d SET opponent_eliminado = true, opponent_eliminado_em = now()
  WHERE d.status = 'ativo' AND d.frequencia_tipo = 'diario' AND d.opponent_eliminado = false
    AND NOT EXISTS (
      SELECT 1 FROM checkins c
      WHERE c.duelo_id = d.id AND c.user_id = d.opponent_id AND c.created_at::date = ontem
    )
    AND NOT EXISTS (
      SELECT 1 FROM justificativas_falta j
      WHERE j.duelo_id = d.id AND j.user_id = d.opponent_id
        AND j.data_referencia = ontem AND j.status = 'aprovado'
    );

  -- DESAFIOS EQUIPE diário
  UPDATE desafio_equipe_participantes dep
  SET eliminado = true, eliminado_em = now(), motivo_eliminacao = 'ausencia'
  FROM desafios_equipe de
  WHERE dep.desafio_id = de.id AND de.status = 'ativo'
    AND de.frequencia_tipo = 'diario' AND dep.eliminado = false
    AND NOT EXISTS (
      SELECT 1 FROM checkins c
      WHERE c.user_id = dep.user_id AND c.created_at::date = ontem
        AND c.meta_id IN (SELECT m.id FROM metas m WHERE m.user_id = dep.user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM justificativas_falta j
      WHERE j.desafio_id = de.id AND j.user_id = dep.user_id
        AND j.data_referencia = ontem AND j.status = 'aprovado'
    );

END;
$func$;

REVOKE EXECUTE ON FUNCTION public.processar_eliminacoes_diarias() FROM PUBLIC, anon, authenticated;

-- 6. Cron às 00:05
SELECT cron.schedule(
  'vrenn-checkin-eliminacao',
  '5 0 * * *',
  $$ SELECT public.processar_eliminacoes_diarias(); $$
);
