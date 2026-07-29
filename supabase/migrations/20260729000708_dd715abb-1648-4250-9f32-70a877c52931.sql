CREATE OR REPLACE FUNCTION public.arbitros_prevent_meta_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.meta_id IS DISTINCT FROM OLD.meta_id THEN
    RAISE EXCEPTION 'meta_id cannot be changed on arbitros row';
  END IF;
  IF NEW.arbitro_id IS DISTINCT FROM OLD.arbitro_id THEN
    RAISE EXCEPTION 'arbitro_id cannot be changed on arbitros row';
  END IF;
  IF NEW.convidado_por IS DISTINCT FROM OLD.convidado_por THEN
    RAISE EXCEPTION 'convidado_por cannot be changed on arbitros row';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arbitros_prevent_reassignment ON public.arbitros;
CREATE TRIGGER arbitros_prevent_reassignment
BEFORE UPDATE ON public.arbitros
FOR EACH ROW
EXECUTE FUNCTION public.arbitros_prevent_meta_reassignment();