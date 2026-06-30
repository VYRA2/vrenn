-- GRANTs nas tabelas existentes (causa real do permission denied)
GRANT SELECT ON public.metas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO authenticated;
GRANT ALL ON public.metas TO service_role;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.checkins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;

GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

GRANT SELECT ON public.apoios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apoios TO authenticated;
GRANT ALL ON public.apoios TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arbitros TO authenticated;
GRANT ALL ON public.arbitros TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_validacoes TO authenticated;
GRANT ALL ON public.checkin_validacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duelos TO authenticated;
GRANT ALL ON public.duelos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_searches TO authenticated;
GRANT ALL ON public.user_searches TO service_role;

REVOKE SELECT (motivacao) ON public.metas FROM anon, authenticated;

-- Criar TABELAS primeiro (sem policies que se referenciam)
CREATE TABLE IF NOT EXISTS public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  avatar_url text,
  categoria text NOT NULL DEFAULT 'foco',
  publica boolean NOT NULL DEFAULT true,
  regras text,
  criador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipe_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'membro',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(equipe_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.desafios_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'saude',
  duracao_dias int NOT NULL DEFAULT 30,
  data_inicio date NOT NULL DEFAULT current_date,
  data_fim date,
  valor_entrada numeric(12,2) NOT NULL DEFAULT 0,
  premiacao text,
  regras jsonb NOT NULL DEFAULT '{"foco_total":true,"comprovacao":true,"etica":true,"conclusao":true,"personalizadas":[],"consequencias":""}'::jsonb,
  status text NOT NULL DEFAULT 'ativo',
  criador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTs
GRANT SELECT ON public.equipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes TO authenticated;
GRANT ALL ON public.equipes TO service_role;
GRANT SELECT ON public.equipe_membros TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_membros TO authenticated;
GRANT ALL ON public.equipe_membros TO service_role;
GRANT SELECT ON public.desafios_equipe TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.desafios_equipe TO authenticated;
GRANT ALL ON public.desafios_equipe TO service_role;

-- Security definer pra evitar recursão entre equipes e equipe_membros
CREATE OR REPLACE FUNCTION public.is_equipe_member(_equipe_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.equipe_membros WHERE equipe_id = _equipe_id AND user_id = _user_id)
$$;

-- RLS
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafios_equipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipes visiveis" ON public.equipes FOR SELECT
  USING (publica = true OR criador_id = auth.uid() OR public.is_equipe_member(id, auth.uid()));
CREATE POLICY "Criar equipe propria" ON public.equipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = criador_id);
CREATE POLICY "Atualizar equipe propria" ON public.equipes FOR UPDATE TO authenticated USING (auth.uid() = criador_id);
CREATE POLICY "Excluir equipe propria" ON public.equipes FOR DELETE TO authenticated USING (auth.uid() = criador_id);

CREATE POLICY "Membros visiveis" ON public.equipe_membros FOR SELECT USING (true);
CREATE POLICY "Entrar como si proprio" ON public.equipe_membros FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Sair da equipe" ON public.equipe_membros FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.equipes e WHERE e.id = equipe_id AND e.criador_id = auth.uid()));

CREATE POLICY "Desafios visiveis" ON public.desafios_equipe FOR SELECT USING (true);
CREATE POLICY "Criar desafio se membro" ON public.desafios_equipe FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criador_id AND public.is_equipe_member(equipe_id, auth.uid()));
CREATE POLICY "Atualizar desafio proprio" ON public.desafios_equipe FOR UPDATE TO authenticated USING (auth.uid() = criador_id);
CREATE POLICY "Excluir desafio proprio" ON public.desafios_equipe FOR DELETE TO authenticated USING (auth.uid() = criador_id);

-- Trigger: criador entra como admin automaticamente
CREATE OR REPLACE FUNCTION public.equipe_add_criador() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.equipe_membros (equipe_id, user_id, papel) VALUES (NEW.id, NEW.criador_id, 'admin') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_equipe_add_criador ON public.equipes;
CREATE TRIGGER trg_equipe_add_criador AFTER INSERT ON public.equipes FOR EACH ROW EXECUTE FUNCTION public.equipe_add_criador();
