-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Índices de performance para suportar 2k–5k usuários ativos
-- ═══════════════════════════════════════════════════════════════════

-- ── FEED ────────────────────────────────────────────────────────────
-- Feed busca posts por user_id filtrado por follows — índice composto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_user_created
  ON public.posts (user_id, created_at DESC);

-- Likes por post (contagem e verificação "já curtiu")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_likes_post_user
  ON public.post_likes (post_id, user_id);

-- Comentários por post (contagem)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_post
  ON public.post_comments (post_id, created_at DESC);

-- Saves por post e usuário
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_saves_post_user
  ON public.post_saves (post_id, user_id);

-- ── FOLLOWS ─────────────────────────────────────────────────────────
-- Feed busca quem o usuário segue — a query mais frequente do app
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_status
  ON public.follows (follower_id, status);

-- Notificações de follow — quem segue quem
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following_status
  ON public.follows (following_id, status);

-- ── CHECKINS ────────────────────────────────────────────────────────
-- Cron de eliminação e verificação de streak: busca por user_id + data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkins_user_created
  ON public.checkins (user_id, created_at DESC);

-- Verificar check-in de hoje por meta
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkins_meta_user_created
  ON public.checkins (meta_id, user_id, created_at DESC)
  WHERE meta_id IS NOT NULL;

-- Verificar check-in de hoje por duelo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkins_duelo_user_created
  ON public.checkins (duelo_id, user_id, created_at DESC)
  WHERE duelo_id IS NOT NULL;

-- ── NOTIFICAÇÕES ────────────────────────────────────────────────────
-- Query mais frequente: notificações não lidas do usuário
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notificacoes_user_lida_created
  ON public.notificacoes (user_id, lida, created_at DESC);

-- ── METAS ───────────────────────────────────────────────────────────
-- Listar metas do usuário por status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metas_user_status
  ON public.metas (user_id, status, created_at DESC);

-- Cron de eliminação: metas em andamento com frequência diária
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metas_status_frequencia
  ON public.metas (status, frequencia_tipo)
  WHERE status = 'em_andamento';

-- ── DUELOS ──────────────────────────────────────────────────────────
-- Duelos ativos por participante
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_duelos_challenger_status
  ON public.duelos (challenger_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_duelos_opponent_status
  ON public.duelos (opponent_id, status);

-- ── EQUIPES ─────────────────────────────────────────────────────────
-- Equipes do usuário (query mais frequente de equipes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipe_membros_user
  ON public.equipe_membros (user_id, equipe_id);

-- Membros de uma equipe (para exibir lista)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipe_membros_equipe
  ON public.equipe_membros (equipe_id, papel);

-- ── MENSAGENS / DM ──────────────────────────────────────────────────
-- Mensagens por conversa em ordem cronológica (chat realtime)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mensagens_conversa_created
  ON public.mensagens (conversa_id, created_at DESC);

-- Conversas do usuário (lista de DMs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversas_user1
  ON public.conversas (user1_id, ultima_mensagem_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversas_user2
  ON public.conversas (user2_id, ultima_mensagem_at DESC);

-- ── REPUTAÇÃO / RANKING ─────────────────────────────────────────────
-- Ranking por período: soma de pontos por user_id + data (query mais pesada)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reputacao_log_user_created
  ON public.reputacao_log (user_id, created_at DESC);

-- Ranking geral: ordenar por pontos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_reputacao
  ON public.profiles (reputacao_pts DESC)
  WHERE reputacao_pts > 0;

-- ── CONQUISTAS ──────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conquistas_user
  ON public.conquistas_usuarios (user_id, desbloqueada_em DESC);

-- ── JUSTIFICATIVAS ──────────────────────────────────────────────────
-- Cron e queries de aprovação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_justificativas_duelo_user_data
  ON public.justificativas_falta (duelo_id, user_id, data_referencia)
  WHERE duelo_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_justificativas_desafio_user_data
  ON public.justificativas_falta (desafio_id, user_id, data_referencia)
  WHERE desafio_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_justificativas_status
  ON public.justificativas_falta (status)
  WHERE status = 'pendente';

-- ── OTIMIZAÇÃO DO FEED: materializar contagens ───────────────────────
-- Adiciona contadores desnormalizados nos posts para evitar COUNT() em tempo real
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

-- Trigger para incrementar/decrementar likes_count
CREATE OR REPLACE FUNCTION public.trg_post_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_likes_count();

-- Trigger para incrementar/decrementar comments_count
CREATE OR REPLACE FUNCTION public.trg_post_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_post_comments_count ON public.post_comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_comments_count();

-- Sincronizar contadores existentes (rodar uma vez)
UPDATE public.posts p SET
  likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id),
  comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id);

