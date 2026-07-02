CREATE OR REPLACE FUNCTION public.get_public_profile_stats(_user_id uuid)
RETURNS TABLE(streak_dias integer, reputacao_pts integer, ranking_geral integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.streak_dias,
    p.reputacao_pts,
    (SELECT 1 + COUNT(*)::int FROM public.profiles p2 WHERE p2.reputacao_pts > p.reputacao_pts) AS ranking_geral
  FROM public.profiles p
  WHERE p.id = _user_id
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_stats(uuid) TO authenticated;