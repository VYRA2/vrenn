-- Fix: coluna 'nivel' não estava no GRANT SELECT de profiles.
-- A query do perfil.tsx incluía 'nivel' na seleção, causando erro 42501
-- (permission denied for column) que tornava data = null e apagava o perfil inteiro.

GRANT SELECT (nivel, reputacao_pts, streak_dias, creditos) ON public.profiles TO authenticated;
GRANT SELECT (nivel, reputacao_pts, streak_dias, creditos) ON public.profiles TO anon;
