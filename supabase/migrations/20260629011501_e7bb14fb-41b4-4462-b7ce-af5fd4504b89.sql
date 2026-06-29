
-- 1) Remover valor_destino do grant público
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, valor_custodia)
  ON public.metas TO anon, authenticated;

-- 2) DUELOS: apertar SELECT para participantes apenas
DROP POLICY IF EXISTS duelos_select_participants ON public.duelos;
CREATE POLICY duelos_select_participants ON public.duelos FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- 3) ARBITROS: WITH CHECK impede troca de meta_id
DROP POLICY IF EXISTS "Arbitro updates own invite" ON public.arbitros;
CREATE POLICY "Arbitro updates own invite" ON public.arbitros FOR UPDATE
  USING (auth.uid() = arbitro_id)
  WITH CHECK (auth.uid() = arbitro_id);

CREATE OR REPLACE FUNCTION public.arbitros_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.meta_id := OLD.meta_id;
  NEW.arbitro_id := OLD.arbitro_id;
  NEW.convidado_por := OLD.convidado_por;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS arbitros_guard_trg ON public.arbitros;
CREATE TRIGGER arbitros_guard_trg BEFORE UPDATE ON public.arbitros
  FOR EACH ROW EXECUTE FUNCTION public.arbitros_guard();

-- 4) DUELOS WITH CHECK (defesa adicional sobre o trigger existente)
DROP POLICY IF EXISTS duelos_update_self_progress ON public.duelos;
CREATE POLICY duelos_update_self_progress ON public.duelos FOR UPDATE
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
  WITH CHECK (auth.uid() = challenger_id OR auth.uid() = opponent_id);
