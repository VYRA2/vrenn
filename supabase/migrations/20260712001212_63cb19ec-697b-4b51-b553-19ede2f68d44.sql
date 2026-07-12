
-- Fix mutable search_path on notify_* functions
ALTER FUNCTION public.notify_duelo_challenge() SET search_path = public;
ALTER FUNCTION public.notify_post_like() SET search_path = public;
ALTER FUNCTION public.notify_new_follow() SET search_path = public;
ALTER FUNCTION public.notify_post_comment() SET search_path = public;

-- Hide sensitive metas columns from Data API. Owners read via SECURITY DEFINER RPCs.
REVOKE SELECT (motivacao, valor_destino) ON public.metas FROM anon, authenticated;

-- Hide sensitive profile columns (CPF, payment processor id) from Data API.
REVOKE SELECT (cpf, asaas_customer_id) ON public.profiles FROM anon, authenticated;

-- Owner-only RPC to read their own CPF
CREATE OR REPLACE FUNCTION public.get_my_cpf()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cpf FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_cpf() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_cpf() TO authenticated;

-- Hide qrcode validation token from clients. Validation trigger runs SECURITY DEFINER and still reads it.
REVOKE SELECT (qrcode_token) ON public.locais_validacao FROM anon, authenticated;
