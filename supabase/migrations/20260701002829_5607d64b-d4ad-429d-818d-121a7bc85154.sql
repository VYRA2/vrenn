
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at)
  ON public.metas TO anon, authenticated;
GRANT SELECT (motivacao, valor_custodia, valor_destino) ON public.metas TO authenticated;

CREATE OR REPLACE FUNCTION public.get_meta_valor_destino(_meta_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT valor_destino FROM public.metas
  WHERE id = _meta_id AND user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_meta_valor_destino(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meta_valor_destino(uuid) TO authenticated;

REVOKE SELECT (nivel, streak_dias, reputacao_pts, creditos)
  ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile_stats()
RETURNS TABLE(nivel int, streak_dias int, reputacao_pts int, creditos int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT nivel, streak_dias, reputacao_pts, creditos
  FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_profile_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_stats() TO authenticated;
