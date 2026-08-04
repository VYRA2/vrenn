-- Preferências do lembrete inteligente de check-in.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkin_reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_reminder_time time NOT NULL DEFAULT '21:00:00',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE TABLE IF NOT EXISTS public.checkin_reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commitment_type text NOT NULL CHECK (commitment_type IN ('meta', 'duelo', 'desafio_equipe')),
  commitment_id uuid NOT NULL,
  local_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  push_sent boolean NOT NULL DEFAULT false,
  notification_id uuid NULL REFERENCES public.notificacoes(id) ON DELETE SET NULL,
  UNIQUE (user_id, commitment_type, commitment_id, local_date)
);

ALTER TABLE public.checkin_reminder_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário lê seus lembretes enviados" ON public.checkin_reminder_deliveries;
CREATE POLICY "Usuário lê seus lembretes enviados"
  ON public.checkin_reminder_deliveries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.checkin_reminder_deliveries FROM anon, authenticated;
GRANT SELECT ON public.checkin_reminder_deliveries TO authenticated;

CREATE INDEX IF NOT EXISTS checkin_reminder_deliveries_user_date_idx
  ON public.checkin_reminder_deliveries (user_id, local_date DESC);

COMMENT ON TABLE public.checkin_reminder_deliveries IS
  'Registra um único lembrete por compromisso, usuário e data local.';
COMMENT ON COLUMN public.profiles.checkin_reminder_enabled IS
  'Controla o lembrete inteligente de check-in pendente.';
COMMENT ON COLUMN public.profiles.checkin_reminder_time IS
  'Horário local escolhido pelo usuário; 21:00 por padrão.';
COMMENT ON COLUMN public.profiles.timezone IS
  'Fuso IANA usado para calcular o horário local do lembrete.';
