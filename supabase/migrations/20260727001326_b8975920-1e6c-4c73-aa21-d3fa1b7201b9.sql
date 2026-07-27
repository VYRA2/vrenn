
-- ============ METAS ============
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (
  id, user_id, titulo, categoria, descricao, prazo, progresso, status,
  foto_capa_url, created_at, tipo_validacao, wearable_criterio,
  frequencia_tipo, frequencia_quantidade, is_seed
) ON public.metas TO anon, authenticated;
-- Owner-only sensitive columns available to authenticated (row policy "Owners read own metas full" restricts to owner)
GRANT SELECT (motivacao, valor_destino, valor_custodia, local_id) ON public.metas TO authenticated;

-- ============ LOCAIS_VALIDACAO ============
REVOKE SELECT ON public.locais_validacao FROM anon, authenticated;
GRANT SELECT (id, nome, latitude, longitude, raio_geofence_metros, criado_por, created_at)
  ON public.locais_validacao TO authenticated;
-- qrcode_token intentionally NOT granted; access via get_local_qrcode_token()

CREATE OR REPLACE FUNCTION public.get_local_qrcode_token(_local_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qrcode_token::text FROM public.locais_validacao
  WHERE id = _local_id AND criado_por = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_local_qrcode_token(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_local_qrcode_token(uuid) TO authenticated;

-- ============ TEMPORADA_PARTICIPANTES ============
REVOKE SELECT ON public.temporada_participantes FROM anon, authenticated;
GRANT SELECT (
  id, temporada_id, user_id, status, eliminado, eliminado_em,
  motivo_eliminacao, faltas, total_checkins, ultimo_checkin,
  termo_aceito_em, created_at
) ON public.temporada_participantes TO authenticated;
-- Financial columns (taxa_paga, valor_custodia) only via get_my_temporada_participacao RPC (owner/organizer)
