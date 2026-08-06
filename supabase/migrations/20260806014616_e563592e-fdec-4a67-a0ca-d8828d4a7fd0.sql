CREATE OR REPLACE FUNCTION public.encerrar_temporada_manual(p_temporada_id uuid, p_admin_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('erro', 'Sem permissão');
  END IF;

  -- p_admin_id é ignorado para autorização; só o chamador autenticado importa
  IF p_admin_id IS NOT NULL AND p_admin_id <> v_uid THEN
    RETURN jsonb_build_object('erro', 'Sem permissão');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM temporadas WHERE id = p_temporada_id AND criado_por = v_uid
  ) THEN
    RETURN jsonb_build_object('erro', 'Sem permissão');
  END IF;

  RETURN encerrar_temporada(p_temporada_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.encerrar_temporada_manual(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_temporada_manual(uuid, uuid) TO authenticated;