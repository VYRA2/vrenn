
-- 1. locais_validacao: drop public 'true' policy, keep authenticated-only
DROP POLICY IF EXISTS "Locais viewable by all" ON public.locais_validacao;
-- Ensure qrcode_token is never SELECT-able by anon/authenticated
REVOKE SELECT (qrcode_token) ON public.locais_validacao FROM anon, authenticated;

-- 2. metas: reinforce column-level restriction on sensitive fields
REVOKE SELECT (motivacao, valor_destino, valor_custodia, local_id) ON public.metas FROM anon, authenticated;

-- 3. Storage: replace broad checkins bucket read with scoped policy
DROP POLICY IF EXISTS "Checkin photos readable by signed in" ON storage.objects;
CREATE POLICY "Checkin photos readable via checkin row"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'checkins'
    AND EXISTS (
      SELECT 1 FROM public.checkins c
      WHERE c.foto_url IS NOT NULL
        AND c.foto_url LIKE '%' || storage.objects.name
    )
  );

-- 4. temporada_participantes: scope reads; expose only non-financial cols publicly for leaderboard
DROP POLICY IF EXISTS "temp_part_select" ON public.temporada_participantes;

-- Owner or season creator can read the full row
CREATE POLICY "temp_part_select_owner_or_organizer"
  ON public.temporada_participantes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.temporadas t
      WHERE t.id = temporada_id AND t.criado_por = auth.uid()
    )
  );

-- Public leaderboard: allow reading only non-financial columns for everyone
CREATE POLICY "temp_part_public_leaderboard"
  ON public.temporada_participantes FOR SELECT TO authenticated
  USING (true);

-- Grant only non-financial columns to authenticated so the second policy is meaningful
GRANT SELECT (id, temporada_id, user_id, status, eliminado, eliminado_em, total_checkins, ultimo_checkin, created_at)
  ON public.temporada_participantes TO authenticated;
GRANT SELECT (taxa_paga, valor_custodia, motivo_eliminacao, faltas, termo_aceito_em)
  ON public.temporada_participantes TO authenticated;
-- Above grant is broad; revoke financial cols so RLS + column-grants combined block them
REVOKE SELECT (taxa_paga, valor_custodia, motivo_eliminacao, faltas, termo_aceito_em)
  ON public.temporada_participantes FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON public.temporada_participantes TO authenticated;
GRANT ALL ON public.temporada_participantes TO service_role;

-- Owner can still read own financial columns via explicit owner-scoped access through RPC or by granting to owner only:
-- (Postgres column grants are role-wide; owner-only read of financial fields is enforced via RLS row scope combined
-- with a dedicated RPC. Add a helper RPC for the owner to fetch own financial data.)
CREATE OR REPLACE FUNCTION public.get_my_temporada_participacao(_temporada_id uuid)
RETURNS TABLE (taxa_paga numeric, valor_custodia numeric, motivo_eliminacao text, faltas int, termo_aceito_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT taxa_paga, valor_custodia, motivo_eliminacao, faltas, termo_aceito_em
  FROM public.temporada_participantes
  WHERE temporada_id = _temporada_id AND user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_temporada_participacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_temporada_participacao(uuid) TO authenticated;

-- 5. Revoke anon EXECUTE on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.encerrar_temporada(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.encerrar_temporada_manual(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_temporada_manual(uuid, uuid) TO authenticated;
-- encerrar_temporada is called internally by encerrar_temporada_manual; no direct client need
