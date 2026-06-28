
CREATE TABLE public.arbitros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  arbitro_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  convidado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_id, arbitro_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arbitros TO authenticated;
GRANT ALL ON public.arbitros TO service_role;
ALTER TABLE public.arbitros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arbitros visible to involved" ON public.arbitros FOR SELECT TO authenticated
USING (
  auth.uid() = arbitro_id
  OR auth.uid() = convidado_por
  OR EXISTS (SELECT 1 FROM public.metas m WHERE m.id = meta_id AND m.user_id = auth.uid())
);
CREATE POLICY "Meta owner invites arbitros" ON public.arbitros FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = convidado_por
  AND EXISTS (SELECT 1 FROM public.metas m WHERE m.id = meta_id AND m.user_id = auth.uid())
);
CREATE POLICY "Arbitro updates own invite" ON public.arbitros FOR UPDATE TO authenticated
USING (auth.uid() = arbitro_id);
CREATE POLICY "Meta owner removes arbitros" ON public.arbitros FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.metas m WHERE m.id = meta_id AND m.user_id = auth.uid()));

CREATE TABLE public.checkin_validacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  arbitro_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkin_id, arbitro_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_validacoes TO authenticated;
GRANT ALL ON public.checkin_validacoes TO service_role;
ALTER TABLE public.checkin_validacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Validacoes viewable by signed in" ON public.checkin_validacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Arbitro creates validacao" ON public.checkin_validacoes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = arbitro_id
  AND EXISTS (
    SELECT 1 FROM public.checkins c
    JOIN public.arbitros a ON a.meta_id = c.meta_id
    WHERE c.id = checkin_id AND a.arbitro_id = auth.uid() AND a.status = 'aceito'
  )
);
CREATE POLICY "Arbitro updates own validacao" ON public.checkin_validacoes FOR UPDATE TO authenticated
USING (auth.uid() = arbitro_id);

CREATE POLICY "Checkin photos readable by signed in" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'checkins');
CREATE POLICY "Users upload own checkin photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'checkins' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own checkin photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'checkins' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow goal owner to insert notifications for arbiter invites, and arbiters to notify owners on validation
-- (notificacoes has no INSERT policy; allow inserts for own related users)
CREATE POLICY "Allow notif insert by authenticated" ON public.notificacoes FOR INSERT TO authenticated
WITH CHECK (true);
