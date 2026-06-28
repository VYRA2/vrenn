
-- Add new columns to metas
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS motivacao TEXT,
  ADD COLUMN IF NOT EXISTS valor_custodia NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_destino TEXT;

-- Duelos table
CREATE TABLE IF NOT EXISTS public.duelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_email TEXT,
  titulo TEXT NOT NULL,
  categoria TEXT,
  prazo TIMESTAMPTZ,
  aposta_creditos INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  progresso_challenger INTEGER DEFAULT 0,
  progresso_opponent INTEGER DEFAULT 0,
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duelos TO authenticated;
GRANT ALL ON public.duelos TO service_role;
ALTER TABLE public.duelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duelos_select_participants" ON public.duelos FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id OR status IN ('concluido','em_andamento'));
CREATE POLICY "duelos_insert_challenger" ON public.duelos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "duelos_update_participants" ON public.duelos FOR UPDATE TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
