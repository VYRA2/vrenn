REVOKE SELECT (motivacao, valor_destino) ON public.metas FROM authenticated;
REVOKE SELECT (motivacao, valor_destino) ON public.metas FROM anon;

REVOKE ALL ON FUNCTION public.get_meta_motivacao(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_meta_valor_destino(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_valor_destino(uuid) TO authenticated;