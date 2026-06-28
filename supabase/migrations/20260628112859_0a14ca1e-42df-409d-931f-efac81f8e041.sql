
DROP POLICY IF EXISTS "Allow notif insert by authenticated" ON public.notificacoes;

CREATE POLICY "Insert notif via meta relationship" ON public.notificacoes FOR INSERT TO authenticated
WITH CHECK (
  -- Meta owner notifying an invited arbiter
  EXISTS (
    SELECT 1 FROM public.arbitros a
    JOIN public.metas m ON m.id = a.meta_id
    WHERE m.user_id = auth.uid() AND a.arbitro_id = notificacoes.user_id
  )
  OR
  -- Arbiter notifying the meta owner
  EXISTS (
    SELECT 1 FROM public.arbitros a
    JOIN public.metas m ON m.id = a.meta_id
    WHERE a.arbitro_id = auth.uid() AND m.user_id = notificacoes.user_id
  )
);
