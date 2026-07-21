-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Checkins de Desafio de Equipe + Progresso Automático
-- ═══════════════════════════════════════════════════════════════════

-- 1. Garantir que desafio_equipe_participantes existe
CREATE TABLE IF NOT EXISTS public.desafio_equipe_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id uuid NOT NULL REFERENCES public.desafios_equipe(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progresso integer NOT NULL DEFAULT 0,
  ultimo_checkin timestamptz,
  eliminado boolean DEFAULT false,
  eliminado_em timestamptz,
  motivo_eliminacao text CHECK (motivo_eliminacao IN ('ausencia','desistencia')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (desafio_id, user_id)
);

ALTER TABLE public.desafio_equipe_participantes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.desafio_equipe_participantes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.desafio_equipe_participantes TO authenticated;
GRANT ALL ON public.desafio_equipe_participantes TO service_role;

DROP POLICY IF EXISTS "dep_select" ON public.desafio_equipe_participantes;
CREATE POLICY "dep_select" ON public.desafio_equipe_participantes FOR SELECT USING (true);

DROP POLICY IF EXISTS "dep_insert" ON public.desafio_equipe_participantes;
CREATE POLICY "dep_insert" ON public.desafio_equipe_participantes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dep_update" ON public.desafio_equipe_participantes;
CREATE POLICY "dep_update" ON public.desafio_equipe_participantes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2. Tabela de checkins específica de desafio de equipe
CREATE TABLE IF NOT EXISTS public.checkins_desafio_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id uuid NOT NULL REFERENCES public.desafios_equipe(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensagem text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkins_desafio_equipe ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.checkins_desafio_equipe TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins_desafio_equipe TO authenticated;
GRANT ALL ON public.checkins_desafio_equipe TO service_role;

DROP POLICY IF EXISTS "cde_select" ON public.checkins_desafio_equipe;
CREATE POLICY "cde_select" ON public.checkins_desafio_equipe FOR SELECT USING (true);

DROP POLICY IF EXISTS "cde_insert" ON public.checkins_desafio_equipe;
CREATE POLICY "cde_insert" ON public.checkins_desafio_equipe
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. Trigger: atualiza progresso + ultimo_checkin + reputação ao fazer check-in
CREATE OR REPLACE FUNCTION public.trg_checkin_desafio_progresso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Upsert na tabela de participantes (entra automaticamente se ainda não estava)
  INSERT INTO public.desafio_equipe_participantes (desafio_id, user_id, progresso, ultimo_checkin)
  VALUES (NEW.desafio_id, NEW.user_id, 1, NEW.created_at)
  ON CONFLICT (desafio_id, user_id) DO UPDATE
    SET progresso = desafio_equipe_participantes.progresso + 1,
        ultimo_checkin = NEW.created_at;

  -- Reputação: +5 pts por check-in de desafio de equipe
  PERFORM public.dar_reputacao(NEW.user_id, 5, 'checkin_desafio_equipe', NEW.desafio_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkin_desafio_progresso ON public.checkins_desafio_equipe;
CREATE TRIGGER trg_checkin_desafio_progresso
  AFTER INSERT ON public.checkins_desafio_equipe
  FOR EACH ROW EXECUTE FUNCTION public.trg_checkin_desafio_progresso();

-- 4. Adicionar desafio_id na tabela checkins genérica também (caso o código use como fallback)
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS desafio_id uuid REFERENCES public.desafios_equipe(id) ON DELETE CASCADE;
