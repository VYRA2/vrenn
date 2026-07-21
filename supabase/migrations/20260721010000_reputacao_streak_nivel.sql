-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Sistema de Reputação, Streak e Progressão de Nível
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- TABELA DE PONTOS (para auditoria e histórico)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reputacao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pontos integer NOT NULL,
  motivo text NOT NULL, -- 'checkin', 'meta_concluida', 'duelo_vencido', 'desafio_equipe', 'streak_bonus'
  ref_id uuid,          -- id da meta / duelo / desafio que gerou os pontos
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reputacao_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reputacao_log TO authenticated;
GRANT ALL ON public.reputacao_log TO service_role;
CREATE POLICY "reputacao_log_select" ON public.reputacao_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────
-- TABELA DE PONTOS POR EVENTO
-- ───────────────────────────────────────────────────────────────────
-- checkin aprovado:       +5 pts
-- meta concluída:         +50 pts
-- duelo vencido:          +80 pts
-- desafio equipe concluído: +40 pts
-- streak 7 dias:          +20 pts bonus
-- streak 30 dias:         +100 pts bonus
-- streak 100 dias:        +500 pts bonus

-- ───────────────────────────────────────────────────────────────────
-- FUNÇÃO CENTRAL: dar pontos + atualizar streak + subir nível
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dar_reputacao(
  p_user_id uuid,
  p_pontos integer,
  p_motivo text,
  p_ref_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_total integer;
  novo_nivel integer;
BEGIN
  -- Inserir log
  INSERT INTO reputacao_log (user_id, pontos, motivo, ref_id)
  VALUES (p_user_id, p_pontos, p_motivo, p_ref_id);

  -- Atualizar pontos
  UPDATE profiles
  SET reputacao_pts = reputacao_pts + p_pontos
  WHERE id = p_user_id
  RETURNING reputacao_pts INTO novo_total;

  -- Calcular novo nível baseado em pontos totais
  -- 1=Bronze: 0-199 | 2=Prata: 200-599 | 3=Ouro: 600-1499 | 4=Diamante: 1500-3999 | 5=Lenda: 4000+
  novo_nivel := CASE
    WHEN novo_total >= 4000 THEN 5
    WHEN novo_total >= 1500 THEN 4
    WHEN novo_total >= 600  THEN 3
    WHEN novo_total >= 200  THEN 2
    ELSE 1
  END;

  -- Subir nível se necessário (nunca desce)
  UPDATE profiles
  SET nivel = novo_nivel
  WHERE id = p_user_id AND nivel < novo_nivel;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dar_reputacao(uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dar_reputacao(uuid, integer, text, uuid) TO service_role;

-- ───────────────────────────────────────────────────────────────────
-- TRIGGER 1: Check-in aprovado → +5 pts + atualizar streak
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_checkin_reputacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ultimo_checkin_date date;
  hoje date := current_date;
  novo_streak integer;
  bonus_motivo text;
BEGIN
  -- Só processa quando um checkin é criado (INSERT)
  -- Para meta solo e duelo
  IF TG_OP = 'INSERT' THEN

    -- Calcular streak
    SELECT created_at::date INTO ultimo_checkin_date
    FROM checkins
    WHERE user_id = NEW.user_id
      AND id != NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF ultimo_checkin_date IS NULL THEN
      -- Primeiro check-in
      novo_streak := 1;
    ELSIF ultimo_checkin_date = hoje - 1 THEN
      -- Consecutivo
      SELECT streak_dias + 1 INTO novo_streak FROM profiles WHERE id = NEW.user_id;
    ELSIF ultimo_checkin_date = hoje THEN
      -- Já fez hoje, não incrementa streak
      novo_streak := NULL;
    ELSE
      -- Quebrou a sequência
      novo_streak := 1;
    END IF;

    -- Atualizar streak se mudou
    IF novo_streak IS NOT NULL THEN
      UPDATE profiles SET streak_dias = novo_streak WHERE id = NEW.user_id;

      -- Bonus de streak em marcos
      IF novo_streak = 7 THEN
        PERFORM dar_reputacao(NEW.user_id, 20, 'streak_bonus', NULL);
      ELSIF novo_streak = 30 THEN
        PERFORM dar_reputacao(NEW.user_id, 100, 'streak_bonus', NULL);
      ELSIF novo_streak = 100 THEN
        PERFORM dar_reputacao(NEW.user_id, 500, 'streak_bonus', NULL);
      END IF;
    END IF;

    -- +5 pts pelo check-in
    PERFORM dar_reputacao(NEW.user_id, 5, 'checkin', COALESCE(NEW.meta_id, NEW.duelo_id));

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkin_reputacao ON public.checkins;
CREATE TRIGGER trg_checkin_reputacao
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_checkin_reputacao();

-- ───────────────────────────────────────────────────────────────────
-- TRIGGER 2: Meta concluída → +50 pts
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_meta_concluida_reputacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só quando status muda para 'concluida'
  IF OLD.status != 'concluida' AND NEW.status = 'concluida' THEN
    PERFORM dar_reputacao(NEW.user_id, 50, 'meta_concluida', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_concluida_reputacao ON public.metas;
CREATE TRIGGER trg_meta_concluida_reputacao
  AFTER UPDATE OF status ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.trg_meta_concluida_reputacao();

-- ───────────────────────────────────────────────────────────────────
-- TRIGGER 3: Duelo com winner_id definido → +80 pts pro vencedor
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_duelo_vencedor_reputacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só quando winner_id é setado pela primeira vez
  IF (OLD.winner_id IS NULL) AND (NEW.winner_id IS NOT NULL) THEN
    PERFORM dar_reputacao(NEW.winner_id, 80, 'duelo_vencido', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duelo_vencedor_reputacao ON public.duelos;
CREATE TRIGGER trg_duelo_vencedor_reputacao
  AFTER UPDATE OF winner_id ON public.duelos
  FOR EACH ROW EXECUTE FUNCTION public.trg_duelo_vencedor_reputacao();

-- ───────────────────────────────────────────────────────────────────
-- TRIGGER 4: Desafio de equipe concluído → +40 pts para participantes ativos
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_desafio_equipe_concluido_reputacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participante record;
BEGIN
  IF OLD.status != 'concluido' AND NEW.status = 'concluido' THEN
    FOR participante IN
      SELECT user_id FROM desafio_equipe_participantes
      WHERE desafio_id = NEW.id AND eliminado = false
    LOOP
      PERFORM dar_reputacao(participante.user_id, 40, 'desafio_equipe_concluido', NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desafio_equipe_concluido_reputacao ON public.desafios_equipe;
CREATE TRIGGER trg_desafio_equipe_concluido_reputacao
  AFTER UPDATE OF status ON public.desafios_equipe
  FOR EACH ROW EXECUTE FUNCTION public.trg_desafio_equipe_concluido_reputacao();

-- ───────────────────────────────────────────────────────────────────
-- CRON: resetar streak de quem não fez check-in ontem (roda às 00h10)
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resetar_streaks_quebrados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles p
  SET streak_dias = 0
  WHERE p.streak_dias > 0
    AND NOT EXISTS (
      SELECT 1 FROM checkins c
      WHERE c.user_id = p.id
        AND c.created_at::date = current_date - 1
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resetar_streaks_quebrados() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'vrenn-resetar-streaks',
  '10 0 * * *',
  $$ SELECT public.resetar_streaks_quebrados(); $$
);

