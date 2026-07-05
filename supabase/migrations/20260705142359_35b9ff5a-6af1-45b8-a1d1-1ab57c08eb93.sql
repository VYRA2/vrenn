
-- 1. duelos.opponent_email: hide from all client reads
REVOKE SELECT (opponent_email) ON public.duelos FROM anon, authenticated;

-- 2. metas: hide sensitive columns from all direct client reads (owners use SECURITY DEFINER RPCs)
REVOKE SELECT (motivacao, valor_destino, valor_custodia) ON public.metas FROM anon, authenticated;

-- 3. duelos: enforce participants can only change their own progress column
DROP TRIGGER IF EXISTS trg_duelos_guard ON public.duelos;
CREATE TRIGGER trg_duelos_guard
  BEFORE UPDATE ON public.duelos
  FOR EACH ROW EXECUTE FUNCTION public.duelos_guard();

-- 4. Storage checkins bucket: remove anon-readable policy; keep signed-in read
DROP POLICY IF EXISTS "Checkins public read" ON storage.objects;

-- 5. SECURITY DEFINER functions: revoke PUBLIC/anon EXECUTE, keep authenticated
REVOKE EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_meta_valor_custodia(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_meta_valor_destino(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_meus_creditos() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_profile_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_equipe_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.equipe_add_criador() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_valor_custodia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_valor_destino(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meus_creditos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_equipe_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) TO authenticated;
