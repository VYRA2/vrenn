-- ═══════════════════════════════════════════════════════════════
-- VRENN — Sistema de Conquistas
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabela de conquistas desbloqueadas
CREATE TABLE IF NOT EXISTS public.conquistas_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL,
  desbloqueada_em timestamptz DEFAULT now(),
  UNIQUE (user_id, slug)
);
ALTER TABLE public.conquistas_usuarios ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.conquistas_usuarios TO authenticated;
GRANT ALL ON public.conquistas_usuarios TO service_role;

CREATE POLICY "conquistas_select" ON public.conquistas_usuarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "conquistas_insert" ON public.conquistas_usuarios
  FOR INSERT TO service_role WITH CHECK (true);

-- 2. Função para desbloquear conquista (idempotente — ignora se já existe)
CREATE OR REPLACE FUNCTION public.desbloquear_conquista(p_user_id uuid, p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO conquistas_usuarios (user_id, slug)
  VALUES (p_user_id, p_slug)
  ON CONFLICT (user_id, slug) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.desbloquear_conquista(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desbloquear_conquista(uuid, text) TO service_role, authenticated;

-- 3. Trigger: check-in → Faísca, Comprometido, Máquina, Lendário + streak badges
CREATE OR REPLACE FUNCTION public.trg_conquistas_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_checkins integer;
  streak integer;
BEGIN
  SELECT COUNT(*) INTO total_checkins FROM checkins WHERE user_id = NEW.user_id;
  SELECT streak_dias INTO streak FROM profiles WHERE id = NEW.user_id;

  -- Primeiro check-in
  IF total_checkins = 1 THEN
    PERFORM desbloquear_conquista(NEW.user_id, 'primeira_fagulha');
  END IF;
  IF total_checkins >= 10 THEN
    PERFORM desbloquear_conquista(NEW.user_id, 'comprometido');
  END IF;
  IF total_checkins >= 50 THEN
    PERFORM desbloquear_conquista(NEW.user_id, 'maquina');
  END IF;
  IF total_checkins >= 200 THEN
    PERFORM desbloquear_conquista(NEW.user_id, 'lendario_checkin');
  END IF;

  -- Streak
  IF streak >= 7 THEN
    PERFORM desbloquear_conquista(NEW.user_id, 'chama_acesa');
  END IF;
  IF streak >= 30 THEN
    PERFORM desbloquear_conquista(NEW.user_id, 'rotina_de_ferro');
  END IF;
  IF streak >= 100 THEN
    PERFORM desbloquear_conquista(NEW.user_id, 'inabalavel');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conquistas_checkin ON public.checkins;
CREATE TRIGGER trg_conquistas_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_conquistas_checkin();

-- 4. Trigger: meta concluída → Primeira Missão, Caçador, Conquistador
CREATE OR REPLACE FUNCTION public.trg_conquistas_meta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_metas integer;
BEGIN
  IF OLD.status != 'concluida' AND NEW.status = 'concluida' THEN
    SELECT COUNT(*) INTO total_metas FROM metas WHERE user_id = NEW.user_id AND status = 'concluida';
    IF total_metas >= 1 THEN PERFORM desbloquear_conquista(NEW.user_id, 'primeira_missao'); END IF;
    IF total_metas >= 5 THEN PERFORM desbloquear_conquista(NEW.user_id, 'cacador_de_metas'); END IF;
    IF total_metas >= 20 THEN PERFORM desbloquear_conquista(NEW.user_id, 'conquistador'); END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conquistas_meta ON public.metas;
CREATE TRIGGER trg_conquistas_meta
  AFTER UPDATE OF status ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.trg_conquistas_meta();

-- 5. Trigger: duelo vencido → Primeira Vitória, Dominante, Imbatível
CREATE OR REPLACE FUNCTION public.trg_conquistas_duelo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_vitorias integer;
BEGIN
  IF OLD.winner_id IS NULL AND NEW.winner_id IS NOT NULL THEN
    SELECT COUNT(*) INTO total_vitorias FROM duelos WHERE winner_id = NEW.winner_id;
    IF total_vitorias >= 1 THEN PERFORM desbloquear_conquista(NEW.winner_id, 'primeira_vitoria'); END IF;
    IF total_vitorias >= 5 THEN PERFORM desbloquear_conquista(NEW.winner_id, 'dominante'); END IF;
    IF total_vitorias >= 10 THEN PERFORM desbloquear_conquista(NEW.winner_id, 'imbativel'); END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conquistas_duelo ON public.duelos;
CREATE TRIGGER trg_conquistas_duelo
  AFTER UPDATE OF winner_id ON public.duelos
  FOR EACH ROW EXECUTE FUNCTION public.trg_conquistas_duelo();

-- 6. Trigger: entrar em equipe → Espírito de Equipe
CREATE OR REPLACE FUNCTION public.trg_conquistas_equipe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM desbloquear_conquista(NEW.user_id, 'espirito_de_equipe');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conquistas_equipe ON public.equipe_membros;
CREATE TRIGGER trg_conquistas_equipe
  AFTER INSERT ON public.equipe_membros
  FOR EACH ROW EXECUTE FUNCTION public.trg_conquistas_equipe();

-- 7. Trigger: aceitar duelo → Desafiante
CREATE OR REPLACE FUNCTION public.trg_conquistas_aceitar_duelo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status != 'ativo' AND NEW.status = 'ativo' THEN
    PERFORM desbloquear_conquista(NEW.challenger_id, 'desafiante');
    PERFORM desbloquear_conquista(NEW.opponent_id, 'desafiante');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conquistas_aceitar_duelo ON public.duelos;
CREATE TRIGGER trg_conquistas_aceitar_duelo
  AFTER UPDATE OF status ON public.duelos
  FOR EACH ROW EXECUTE FUNCTION public.trg_conquistas_aceitar_duelo();

-- 8. Trigger: nível subiu → conquistas de reputação
CREATE OR REPLACE FUNCTION public.trg_conquistas_nivel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nivel >= 2 AND OLD.nivel < 2 THEN PERFORM desbloquear_conquista(NEW.id, 'prata_pura'); END IF;
  IF NEW.nivel >= 3 AND OLD.nivel < 3 THEN PERFORM desbloquear_conquista(NEW.id, 'ouro_solido'); END IF;
  IF NEW.nivel >= 4 AND OLD.nivel < 4 THEN PERFORM desbloquear_conquista(NEW.id, 'diamante'); END IF;
  IF NEW.nivel >= 5 AND OLD.nivel < 5 THEN PERFORM desbloquear_conquista(NEW.id, 'lenda'); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conquistas_nivel ON public.profiles;
CREATE TRIGGER trg_conquistas_nivel
  AFTER UPDATE OF nivel ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_conquistas_nivel();

-- 9. Trigger: follows + curtidas → conquistas sociais
-- (roda quando alguém recebe um follow)
CREATE OR REPLACE FUNCTION public.trg_conquistas_social()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_seguidores integer;
  total_curtidas integer;
BEGIN
  -- Conta seguidores do usuário que recebeu o follow
  SELECT COUNT(*) INTO total_seguidores
  FROM follows WHERE following_id = NEW.following_id AND status = 'aceito';

  -- Conta curtidas totais nos posts dele
  SELECT COUNT(*) INTO total_curtidas
  FROM post_likes pl
  JOIN posts p ON p.id = pl.post_id
  WHERE p.user_id = NEW.following_id;

  IF total_seguidores >= 1000 AND total_curtidas >= 5000 THEN
    PERFORM desbloquear_conquista(NEW.following_id, 'influenciador');
  END IF;
  IF total_seguidores >= 10000 AND total_curtidas >= 20000 THEN
    PERFORM desbloquear_conquista(NEW.following_id, 'referencia');
  END IF;
  IF total_seguidores >= 50000 AND total_curtidas >= 70000 THEN
    PERFORM desbloquear_conquista(NEW.following_id, 'icone');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conquistas_social ON public.follows;
CREATE TRIGGER trg_conquistas_social
  AFTER INSERT OR UPDATE OF status ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_conquistas_social();

