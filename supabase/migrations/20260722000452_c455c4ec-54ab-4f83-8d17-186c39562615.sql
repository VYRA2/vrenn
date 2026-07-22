
-- 1. Add is_seed marker to all tables that will receive fake data
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.duelos ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.equipes ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.desafios_equipe ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.equipe_membros ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;

-- 2. Partial indexes for fast cleanup
CREATE INDEX IF NOT EXISTS idx_profiles_is_seed ON public.profiles (id) WHERE is_seed;
CREATE INDEX IF NOT EXISTS idx_metas_is_seed ON public.metas (id) WHERE is_seed;
CREATE INDEX IF NOT EXISTS idx_duelos_is_seed ON public.duelos (id) WHERE is_seed;
CREATE INDEX IF NOT EXISTS idx_equipes_is_seed ON public.equipes (id) WHERE is_seed;
CREATE INDEX IF NOT EXISTS idx_posts_is_seed ON public.posts (id) WHERE is_seed;
CREATE INDEX IF NOT EXISTS idx_checkins_is_seed ON public.checkins (id) WHERE is_seed;
