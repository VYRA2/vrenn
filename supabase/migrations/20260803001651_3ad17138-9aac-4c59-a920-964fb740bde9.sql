-- 1. ARBITROS: policy-level immutability of meta_id / arbitro_id / convidado_por
DROP POLICY IF EXISTS "Arbitro updates own invite" ON public.arbitros;
CREATE POLICY "Arbitro updates own invite"
ON public.arbitros FOR UPDATE TO authenticated
USING (auth.uid() = arbitro_id)
WITH CHECK (
  auth.uid() = arbitro_id
  AND status = ANY (ARRAY['pendente'::text,'aceito'::text,'recusado'::text])
  AND meta_id       = (SELECT a.meta_id       FROM public.arbitros a WHERE a.id = arbitros.id)
  AND arbitro_id    = (SELECT a.arbitro_id    FROM public.arbitros a WHERE a.id = arbitros.id)
  AND convidado_por = (SELECT a.convidado_por FROM public.arbitros a WHERE a.id = arbitros.id)
);

-- 2. DUELOS: block client-side manipulation of outcome/payout fields
DROP POLICY IF EXISTS "duelos_update_participants" ON public.duelos;
CREATE POLICY "duelos_update_participants"
ON public.duelos FOR UPDATE TO authenticated
USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
WITH CHECK (
  (auth.uid() = challenger_id OR auth.uid() = opponent_id)
  AND challenger_id  = (SELECT d.challenger_id  FROM public.duelos d WHERE d.id = duelos.id)
  AND opponent_id IS NOT DISTINCT FROM (SELECT d.opponent_id FROM public.duelos d WHERE d.id = duelos.id)
  AND winner_id   IS NOT DISTINCT FROM (SELECT d.winner_id   FROM public.duelos d WHERE d.id = duelos.id)
  AND valor_custodia IS NOT DISTINCT FROM (SELECT d.valor_custodia FROM public.duelos d WHERE d.id = duelos.id)
  AND (
    status = (SELECT d.status FROM public.duelos d WHERE d.id = duelos.id)
    OR (
      -- only the invited opponent may accept/decline a pending duel
      auth.uid() = opponent_id
      AND (SELECT d.status FROM public.duelos d WHERE d.id = duelos.id) = 'pendente'
      AND status = ANY (ARRAY['em_andamento'::text,'recusado'::text])
    )
  )
);

-- 3. LOCAIS_VALIDACAO: hide coordinates from general authenticated reads
REVOKE SELECT (latitude, longitude) ON public.locais_validacao FROM authenticated, anon;

DROP POLICY IF EXISTS "locais_read_authenticated" ON public.locais_validacao;
DROP POLICY IF EXISTS "locais_select_authenticated" ON public.locais_validacao;
CREATE POLICY "locais_select_authenticated"
ON public.locais_validacao FOR SELECT TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.get_local_geo(_local_id uuid)
RETURNS TABLE(id uuid, nome text, latitude numeric, longitude numeric, raio_geofence_metros integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.nome, l.latitude, l.longitude, l.raio_geofence_metros
  FROM public.locais_validacao l
  WHERE l.id = _local_id
    AND (
      l.criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM public.metas m WHERE m.local_id = l.id AND m.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.desafios_equipe de
        WHERE de.local_id = l.id
          AND (de.criador_id = auth.uid()
               OR EXISTS (SELECT 1 FROM public.desafio_equipe_participantes p
                          WHERE p.desafio_id = de.id AND p.user_id = auth.uid()))
      )
      OR EXISTS (
        SELECT 1 FROM public.metas m
        JOIN public.arbitros a ON a.meta_id = m.id
        WHERE m.local_id = l.id AND a.arbitro_id = auth.uid()
      )
    )
$$;

REVOKE ALL ON FUNCTION public.get_local_geo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_local_geo(uuid) TO authenticated;