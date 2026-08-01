-- Column-level lockdown of qrcode_token (table-level grant overrides column revokes)
REVOKE SELECT ON public.locais_validacao FROM authenticated, anon;
GRANT SELECT (id, nome, latitude, longitude, raio_geofence_metros, criado_por, created_at)
  ON public.locais_validacao TO authenticated;

-- Owners / meta owners / challenge creators may read the token to render the QR
CREATE OR REPLACE FUNCTION public.get_local_qrcode_token(_local_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT l.qrcode_token::text
  FROM public.locais_validacao l
  WHERE l.id = _local_id
    AND (
      l.criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM public.metas m WHERE m.local_id = l.id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.desafios_equipe d WHERE d.local_id = l.id AND d.criador_id = auth.uid())
    )
$function$;

REVOKE EXECUTE ON FUNCTION public.get_local_qrcode_token(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_local_qrcode_token(uuid) TO authenticated;

-- Participants verify a scanned token without ever reading it
CREATE OR REPLACE FUNCTION public.validar_qrcode_local(_local_id uuid, _token text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.locais_validacao l
    WHERE l.id = _local_id AND l.qrcode_token::text = _token
  )
$function$;

REVOKE EXECUTE ON FUNCTION public.validar_qrcode_local(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.validar_qrcode_local(uuid, text) TO authenticated;