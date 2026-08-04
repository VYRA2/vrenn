REVOKE ALL ON FUNCTION public.enqueue_story_media_cleanup() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Arbitro updates own invite" ON public.arbitros;
CREATE POLICY "Arbitro updates own invite" ON public.arbitros
FOR UPDATE TO authenticated
USING (auth.uid() = arbitro_id)
WITH CHECK (
  auth.uid() = arbitro_id
  AND status = ANY (ARRAY['pendente'::text, 'aceito'::text, 'recusado'::text])
);

DROP POLICY IF EXISTS "duelos_update_participants" ON public.duelos;
CREATE POLICY "duelos_update_participants" ON public.duelos
FOR UPDATE TO authenticated
USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
WITH CHECK (auth.uid() = challenger_id OR auth.uid() = opponent_id);

REVOKE SELECT (valor_custodia) ON public.metas FROM authenticated;