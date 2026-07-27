
-- profiles: hide cpf and asaas_customer_id from anon/authenticated
REVOKE SELECT (cpf, asaas_customer_id) ON public.profiles FROM anon, authenticated, PUBLIC;

-- locais_validacao: hide qrcode_token
REVOKE SELECT (qrcode_token) ON public.locais_validacao FROM anon, authenticated, PUBLIC;

-- metas: hide private fields from public/anon reads
REVOKE SELECT (motivacao, valor_destino, valor_custodia, local_id) ON public.metas FROM anon, authenticated, PUBLIC;

-- temporada_participantes: hide financial columns from broad leaderboard reads
REVOKE SELECT (taxa_paga, valor_custodia, motivo_eliminacao) ON public.temporada_participantes FROM anon, authenticated, PUBLIC;
