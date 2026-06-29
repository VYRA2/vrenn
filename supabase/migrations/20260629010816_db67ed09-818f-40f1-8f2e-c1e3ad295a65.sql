
-- Fixar search_path em duelos_guard
CREATE OR REPLACE FUNCTION public.duelos_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.challenger_id THEN
    NEW.progresso_opponent := OLD.progresso_opponent;
    NEW.opponent_id := OLD.opponent_id;
  ELSIF auth.uid() = NEW.opponent_id THEN
    NEW.progresso_challenger := OLD.progresso_challenger;
    NEW.challenger_id := OLD.challenger_id;
  END IF;
  NEW.winner_id := OLD.winner_id;
  NEW.status := OLD.status;
  RETURN NEW;
END $$;

-- Remover EXECUTE público das SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_motivacao(uuid) TO authenticated;
