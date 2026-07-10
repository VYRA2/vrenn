
DROP VIEW IF EXISTS public.metas_public;

DROP POLICY IF EXISTS "metas_select_own" ON public.metas;

CREATE POLICY "Metas public columns viewable" ON public.metas
  FOR SELECT USING (true);

REVOKE SELECT (motivacao, valor_destino) ON public.metas FROM anon, authenticated;
