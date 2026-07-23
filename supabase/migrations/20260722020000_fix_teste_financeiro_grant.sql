-- Fix: expor teste_desafio_equipe_financeiro para authenticated (RPC via frontend)
-- A função é SECURITY DEFINER então roda com permissões elevadas mesmo chamada por authenticated

-- Também expor calcular_pct_distribuicao e resolver_desafio_equipe para service_role chamar via RPC admin
GRANT EXECUTE ON FUNCTION public.teste_desafio_equipe_financeiro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_pct_distribuicao(text, int, int, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_desafio_equipe(uuid) TO service_role;

-- Garantir que a função de resolução por participante está acessível ao trigger
GRANT EXECUTE ON FUNCTION public.resolve_desafio_equipe_participante() TO service_role;

NOTIFY pgrst, 'reload schema';
