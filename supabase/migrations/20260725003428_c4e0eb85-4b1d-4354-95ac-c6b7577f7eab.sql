
-- 1) Fix arbitros UPDATE WITH CHECK (immutability enforced by arbitros_guard trigger)
DROP POLICY IF EXISTS "Arbitro updates own invite" ON public.arbitros;
CREATE POLICY "Arbitro updates own invite" ON public.arbitros
  FOR UPDATE TO authenticated
  USING (auth.uid() = arbitro_id)
  WITH CHECK (
    auth.uid() = arbitro_id
    AND status = ANY (ARRAY['pendente'::text, 'aceito'::text, 'recusado'::text])
  );

-- 2) metas: revoke sensitive columns from anon/authenticated (owner reads via RPCs)
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status,
              foto_capa_url, created_at, tipo_validacao, local_id, wearable_criterio,
              frequencia_tipo, frequencia_quantidade, is_seed)
  ON public.metas TO anon, authenticated;

-- 3) profiles: revoke cpf and asaas_customer_id from anon/authenticated
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, nome, username, avatar_url, bio, nivel, creditos, streak_dias,
              reputacao_pts, created_at, missao, perfil_publico, idioma, unidades,
              categorias_interesse, onboarding_done, is_seed)
  ON public.profiles TO anon, authenticated;

-- 4) Revoke EXECUTE from anon on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.arbitro_declarar_resultado_duelo(uuid, uuid, boolean, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.convidar_arbitro_duelo(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.responder_convite_arbitro_duelo(uuid, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_post_comments_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_post_likes_count() FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.arbitro_declarar_resultado_duelo(uuid, uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convidar_arbitro_duelo(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_convite_arbitro_duelo(uuid, boolean) TO authenticated;
