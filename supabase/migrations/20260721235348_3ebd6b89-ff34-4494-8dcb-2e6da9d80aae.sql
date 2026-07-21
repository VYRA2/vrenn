
-- 1) metas: revoke table-wide SELECT for anon/authenticated, grant only safe columns
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, tipo_validacao, local_id, wearable_criterio, frequencia_tipo, frequencia_quantidade)
  ON public.metas TO anon, authenticated;

-- 2) locais_validacao: hide qrcode_token
REVOKE SELECT ON public.locais_validacao FROM anon, authenticated;
GRANT SELECT (id, nome, latitude, longitude, raio_geofence_metros, criado_por, created_at)
  ON public.locais_validacao TO anon, authenticated;

-- 3) arbitros: prevent meta_id/arbitro_id reassignment via policy WITH CHECK subquery
DROP POLICY IF EXISTS "Arbitro updates own invite" ON public.arbitros;
CREATE POLICY "Arbitro updates own invite" ON public.arbitros
  FOR UPDATE
  USING (auth.uid() = arbitro_id)
  WITH CHECK (
    auth.uid() = arbitro_id
    AND status = ANY (ARRAY['pendente','aceito','recusado'])
    AND meta_id = (SELECT meta_id FROM public.arbitros WHERE id = arbitros.id)
    AND arbitro_id = (SELECT arbitro_id FROM public.arbitros WHERE id = arbitros.id)
    AND convidado_por = (SELECT convidado_por FROM public.arbitros WHERE id = arbitros.id)
  );

-- 4) Fix mutable search_path on remaining functions
ALTER FUNCTION public.criar_post_conquista_duelo() SET search_path = public;
ALTER FUNCTION public.criar_post_conquista_meta() SET search_path = public;
ALTER FUNCTION public.notify_equipe_atualizada() SET search_path = public;
ALTER FUNCTION public.notify_novo_desafio_equipe() SET search_path = public;
ALTER FUNCTION public.update_conversa_ultima_mensagem() SET search_path = public;

-- 5) Revoke EXECUTE from PUBLIC/anon/authenticated on trigger functions (they run via triggers as definer, no direct RPC needed)
REVOKE EXECUTE ON FUNCTION public.trg_meta_concluida_reputacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_duelo_vencedor_reputacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_desafio_equipe_concluido_reputacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_checkin_desafio_progresso() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_conquistas_checkin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_conquistas_duelo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_conquistas_equipe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_conquistas_aceitar_duelo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_conquistas_nivel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_checkin_reputacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_conquistas_meta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_conquistas_social() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_post_conquista_meta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_post_conquista_duelo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_novo_desafio_equipe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversa_ultima_mensagem() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_equipe_atualizada() FROM PUBLIC, anon, authenticated;
