-- Fix: tabelas conversas/mensagens existiam sem RLS/políticas rastreadas em migration
-- (criadas fora do histórico versionado). Resultado: INSERT passava mas SELECT
-- era bloqueado silenciosamente, então o chat nunca abria.

-- ===================== CONVERSAS =====================
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.conversas TO authenticated;
GRANT ALL ON public.conversas TO service_role;

DROP POLICY IF EXISTS "conversas_select_participants" ON public.conversas;
CREATE POLICY "conversas_select_participants" ON public.conversas
  FOR SELECT TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "conversas_insert_participant" ON public.conversas;
CREATE POLICY "conversas_insert_participant" ON public.conversas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "conversas_update_participants" ON public.conversas;
CREATE POLICY "conversas_update_participants" ON public.conversas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ===================== MENSAGENS =====================
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;

DROP POLICY IF EXISTS "mensagens_select_participants" ON public.mensagens;
CREATE POLICY "mensagens_select_participants" ON public.mensagens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = mensagens.conversa_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mensagens_insert_participant" ON public.mensagens;
CREATE POLICY "mensagens_insert_participant" ON public.mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = mensagens.conversa_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mensagens_update_lida" ON public.mensagens;
CREATE POLICY "mensagens_update_lida" ON public.mensagens
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = mensagens.conversa_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- ===================== REALTIME (para o chat atualizar ao vivo) =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
  END IF;
END $$;

-- ===================== BÔNUS: mantém a prévia da lista de conversas atualizada =====================
-- O frontend nunca atualiza conversas.ultima_mensagem/ultima_mensagem_at ao enviar uma
-- mensagem, então a lista de conversas sempre mostraria "Sem mensagens". Este trigger resolve isso.
CREATE OR REPLACE FUNCTION public.atualizar_ultima_mensagem()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversas
  SET ultima_mensagem = NEW.texto, ultima_mensagem_at = NEW.created_at
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.atualizar_ultima_mensagem() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_atualizar_ultima_mensagem ON public.mensagens;
CREATE TRIGGER trg_atualizar_ultima_mensagem
  AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_ultima_mensagem();
