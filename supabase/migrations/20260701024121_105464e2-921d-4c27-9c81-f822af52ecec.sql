
-- Restore lost table grants per repository migrations
GRANT SELECT ON public.metas TO anon;
GRANT INSERT, UPDATE, DELETE ON public.metas TO authenticated;
GRANT ALL ON public.metas TO service_role;
REVOKE SELECT ON public.metas FROM anon, authenticated;
GRANT SELECT (id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at)
  ON public.metas TO anon, authenticated;
GRANT SELECT (motivacao, valor_custodia, valor_destino) ON public.metas TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, nome, username, avatar_url, bio, missao, perfil_publico, idioma, unidades, created_at)
  ON public.profiles TO anon, authenticated;

GRANT SELECT ON public.checkins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;

GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

GRANT SELECT ON public.apoios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apoios TO authenticated;
GRANT ALL ON public.apoios TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arbitros TO authenticated;
GRANT ALL ON public.arbitros TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_validacoes TO authenticated;
GRANT ALL ON public.checkin_validacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duelos TO authenticated;
GRANT ALL ON public.duelos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_searches TO authenticated;
GRANT ALL ON public.user_searches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes TO authenticated;
GRANT ALL ON public.equipes TO service_role;
GRANT SELECT ON public.equipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_membros TO authenticated;
GRANT ALL ON public.equipe_membros TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.desafios_equipe TO authenticated;
GRANT ALL ON public.desafios_equipe TO service_role;

GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;
GRANT ALL ON public.post_saves TO service_role;
GRANT SELECT ON public.stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;

-- Function EXECUTE grants
REVOKE ALL ON FUNCTION public.get_my_profile_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_stats() TO authenticated;
REVOKE ALL ON FUNCTION public.get_meta_motivacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_meta_valor_custodia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meta_valor_custodia(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_meta_valor_destino(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meta_valor_destino(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_meus_creditos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meus_creditos() TO authenticated;
REVOKE ALL ON FUNCTION public.notify(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_equipe_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_equipe_member(uuid, uuid) TO authenticated;
