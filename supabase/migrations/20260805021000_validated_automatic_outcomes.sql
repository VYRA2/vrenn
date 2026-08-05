-- VRENN — Resultados automáticos e antifraude
-- A conclusão de metas, duelos e desafios passa a depender exclusivamente
-- de evidências validadas pelo método configurado.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Estrutura de evidências e resultados
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.duelos
  ADD COLUMN IF NOT EXISTS tipo_validacao text NOT NULL DEFAULT 'foto_arbitro',
  ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES public.locais_validacao(id),
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_origem text;

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS concluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS conclusao_origem text;

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS metodo_validacao text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS qrcode_lido text,
  ADD COLUMN IF NOT EXISTS validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS validado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.checkins_desafio_equipe
  ADD COLUMN IF NOT EXISTS validado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metodo_validacao text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS qrcode_lido text,
  ADD COLUMN IF NOT EXISTS km_registrado numeric,
  ADD COLUMN IF NOT EXISTS strava_activity_id text,
  ADD COLUMN IF NOT EXISTS validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS validado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.desafio_equipe_participantes
  ADD COLUMN IF NOT EXISTS concluiu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluiu_em timestamptz,
  ADD COLUMN IF NOT EXISTS premio_recebido numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custodia_resolvida boolean NOT NULL DEFAULT false;

ALTER TABLE public.desafios_equipe
  ADD COLUMN IF NOT EXISTS modo_distribuicao text NOT NULL DEFAULT 'proporcional',
  ADD COLUMN IF NOT EXISTS colocacoes_premiadas integer,
  ADD COLUMN IF NOT EXISTS criterio_ranking text NOT NULL DEFAULT 'checkins',
  ADD COLUMN IF NOT EXISTS distribuicao_custom jsonb;

-- Métodos válidos, incluindo Strava em todas as entidades.
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_tipo_validacao_check;
ALTER TABLE public.metas ADD CONSTRAINT metas_tipo_validacao_check
  CHECK (tipo_validacao IN ('foto_arbitro','geolocalizacao','qrcode','strava','wearable'));

ALTER TABLE public.duelos DROP CONSTRAINT IF EXISTS duelos_tipo_validacao_check;
ALTER TABLE public.duelos ADD CONSTRAINT duelos_tipo_validacao_check
  CHECK (tipo_validacao IN ('foto_arbitro','geolocalizacao','qrcode','strava'));

ALTER TABLE public.desafios_equipe DROP CONSTRAINT IF EXISTS desafios_equipe_tipo_validacao_check;
ALTER TABLE public.desafios_equipe ADD CONSTRAINT desafios_equipe_tipo_validacao_check
  CHECK (tipo_validacao IN ('foto_arbitro','geolocalizacao','qrcode','strava'));

ALTER TABLE public.desafios_equipe DROP CONSTRAINT IF EXISTS desafios_equipe_modo_distribuicao_check;
ALTER TABLE public.desafios_equipe ADD CONSTRAINT desafios_equipe_modo_distribuicao_check
  CHECK (modo_distribuicao IN ('igual','proporcional','personalizado'));

ALTER TABLE public.desafios_equipe DROP CONSTRAINT IF EXISTS desafios_equipe_criterio_ranking_check;
ALTER TABLE public.desafios_equipe ADD CONSTRAINT desafios_equipe_criterio_ranking_check
  CHECK (criterio_ranking IN ('checkins','progresso','streak','primeiro_a_concluir'));

CREATE TABLE IF NOT EXISTS public.validation_evidence_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('meta','duelo','desafio_equipe')),
  entity_id uuid NOT NULL,
  checkin_id uuid,
  activity_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, external_id)
);

ALTER TABLE public.validation_evidence_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.validation_evidence_registry FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.validation_evidence_registry TO service_role;

CREATE TABLE IF NOT EXISTS public.checkin_validacoes_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins_desafio_equipe(id) ON DELETE CASCADE,
  arbitro_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('validado','questionado')),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkin_id, arbitro_id)
);

ALTER TABLE public.checkin_validacoes_equipe ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.checkin_validacoes_equipe TO authenticated;
GRANT ALL ON public.checkin_validacoes_equipe TO service_role;

DROP POLICY IF EXISTS checkin_validacoes_equipe_select ON public.checkin_validacoes_equipe;
CREATE POLICY checkin_validacoes_equipe_select ON public.checkin_validacoes_equipe
FOR SELECT TO authenticated USING (
  arbitro_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.checkins_desafio_equipe c
    JOIN public.desafios_equipe d ON d.id = c.desafio_id
    JOIN public.equipe_membros em ON em.equipe_id = d.equipe_id
    WHERE c.id = checkin_validacoes_equipe.checkin_id
      AND em.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS checkins_validated_meta_idx
  ON public.checkins(meta_id, user_id, created_at) WHERE validado = true;
CREATE INDEX IF NOT EXISTS checkins_validated_duelo_idx
  ON public.checkins(duelo_id, user_id, created_at) WHERE validado = true;
CREATE INDEX IF NOT EXISTS checkins_team_validated_idx
  ON public.checkins_desafio_equipe(desafio_id, user_id, created_at) WHERE validado = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Utilitários internos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vrenn_trusted(_setting text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(current_setting(_setting, true), '') = '1'
$$;
REVOKE ALL ON FUNCTION public.vrenn_trusted(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_trusted(text) TO service_role;

CREATE OR REPLACE FUNCTION public.vrenn_distance_meters(
  _lat1 numeric, _lng1 numeric, _lat2 numeric, _lng2 numeric
)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((_lat2 - _lat1)::double precision) / 2), 2)
      + cos(radians(_lat1::double precision))
      * cos(radians(_lat2::double precision))
      * power(sin(radians((_lng2 - _lng1)::double precision) / 2), 2)
    )
  )::numeric
$$;
REVOKE ALL ON FUNCTION public.vrenn_distance_meters(numeric,numeric,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_distance_meters(numeric,numeric,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.vrenn_required_checkins(
  _frequency text,
  _quantity integer,
  _start_date date,
  _end_date date
)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(_frequency, 'total') = 'total' THEN GREATEST(COALESCE(_quantity, 1), 1)
    WHEN _end_date IS NULL THEN NULL
    WHEN _frequency = 'diario' THEN
      GREATEST((_end_date - _start_date + 1), 1) * GREATEST(COALESCE(_quantity, 1), 1)
    WHEN _frequency = 'semanal' THEN
      CEIL(GREATEST((_end_date - _start_date + 1), 1)::numeric / 7)::integer
      * GREATEST(COALESCE(_quantity, 1), 1)
    ELSE GREATEST(COALESCE(_quantity, 1), 1)
  END
$$;
REVOKE ALL ON FUNCTION public.vrenn_required_checkins(text,integer,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vrenn_required_checkins(text,integer,date,date) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Guardas: usuários não definem prova, progresso, conclusão ou vencedor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vrenn_guard_checkin_evidence()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _method text;
  _trusted boolean := public.vrenn_trusted('vrenn.trusted_validation');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'não é permitido registrar check-in para outra pessoa';
    END IF;

    IF NEW.meta_id IS NOT NULL THEN
      SELECT tipo_validacao INTO _method FROM public.metas WHERE id = NEW.meta_id;
    ELSIF NEW.duelo_id IS NOT NULL THEN
      SELECT tipo_validacao INTO _method FROM public.duelos WHERE id = NEW.duelo_id;
    ELSE
      RAISE EXCEPTION 'check-in sem meta ou duelo';
    END IF;

    IF auth.uid() IS NOT NULL AND NOT _trusted THEN
      IF _method IS DISTINCT FROM 'foto_arbitro' THEN
        RAISE EXCEPTION 'este check-in precisa ser registrado pelo validador %', _method;
      END IF;
      IF COALESCE(NEW.validado, false)
         OR NEW.km_registrado IS NOT NULL
         OR NEW.strava_activity_id IS NOT NULL
         OR NEW.metodo_validacao IS NOT NULL THEN
        RAISE EXCEPTION 'o participante não pode validar a própria prova';
      END IF;
      NEW.validado := false;
      NEW.metodo_validacao := 'foto_arbitro';
      NEW.validado_em := NULL;
      NEW.validado_por := NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT _trusted THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.meta_id IS DISTINCT FROM OLD.meta_id
       OR NEW.duelo_id IS DISTINCT FROM OLD.duelo_id
       OR NEW.validado IS DISTINCT FROM OLD.validado
       OR NEW.metodo_validacao IS DISTINCT FROM OLD.metodo_validacao
       OR NEW.km_registrado IS DISTINCT FROM OLD.km_registrado
       OR NEW.strava_activity_id IS DISTINCT FROM OLD.strava_activity_id
       OR NEW.validado_por IS DISTINCT FROM OLD.validado_por
       OR NEW.validado_em IS DISTINCT FROM OLD.validado_em THEN
      RAISE EXCEPTION 'a evidência de validação é imutável pelo participante';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_guard_team_checkin_evidence()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _method text;
  _trusted boolean := public.vrenn_trusted('vrenn.trusted_validation');
BEGIN
  SELECT tipo_validacao INTO _method
  FROM public.desafios_equipe WHERE id = COALESCE(NEW.desafio_id, OLD.desafio_id);

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'não é permitido registrar check-in para outra pessoa';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT _trusted THEN
      IF _method IS DISTINCT FROM 'foto_arbitro' THEN
        RAISE EXCEPTION 'este check-in precisa ser registrado pelo validador %', _method;
      END IF;
      IF COALESCE(NEW.validado, false)
         OR NEW.km_registrado IS NOT NULL
         OR NEW.strava_activity_id IS NOT NULL
         OR NEW.metodo_validacao IS NOT NULL THEN
        RAISE EXCEPTION 'o participante não pode validar a própria prova';
      END IF;
      NEW.validado := false;
      NEW.metodo_validacao := 'foto_arbitro';
      NEW.validado_em := NULL;
      NEW.validado_por := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT _trusted THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.desafio_id IS DISTINCT FROM OLD.desafio_id
       OR NEW.validado IS DISTINCT FROM OLD.validado
       OR NEW.metodo_validacao IS DISTINCT FROM OLD.metodo_validacao
       OR NEW.km_registrado IS DISTINCT FROM OLD.km_registrado
       OR NEW.strava_activity_id IS DISTINCT FROM OLD.strava_activity_id
       OR NEW.validado_por IS DISTINCT FROM OLD.validado_por
       OR NEW.validado_em IS DISTINCT FROM OLD.validado_em THEN
      RAISE EXCEPTION 'a evidência de validação é imutável pelo participante';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_guard_meta_outcome()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.vrenn_trusted('vrenn.trusted_outcome') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.progresso IS DISTINCT FROM OLD.progresso
       OR NEW.km_acumulado IS DISTINCT FROM OLD.km_acumulado
       OR NEW.concluida_em IS DISTINCT FROM OLD.concluida_em
       OR NEW.conclusao_origem IS DISTINCT FROM OLD.conclusao_origem THEN
      RAISE EXCEPTION 'a conclusão da meta é automática e depende das provas validadas';
    END IF;

    IF EXISTS (SELECT 1 FROM public.checkins c WHERE c.meta_id = OLD.id)
       AND (
         NEW.tipo_validacao IS DISTINCT FROM OLD.tipo_validacao
         OR NEW.local_id IS DISTINCT FROM OLD.local_id
         OR NEW.objetivo_km IS DISTINCT FROM OLD.objetivo_km
         OR NEW.frequencia_tipo IS DISTINCT FROM OLD.frequencia_tipo
         OR NEW.frequencia_quantidade IS DISTINCT FROM OLD.frequencia_quantidade
       ) THEN
      RAISE EXCEPTION 'o critério de validação não pode mudar depois do primeiro check-in';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.duelos_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR public.vrenn_trusted('vrenn.trusted_outcome') THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.challenger_id := OLD.challenger_id;
  NEW.winner_id := OLD.winner_id;
  NEW.progresso_challenger := OLD.progresso_challenger;
  NEW.progresso_opponent := OLD.progresso_opponent;
  NEW.challenger_eliminado := OLD.challenger_eliminado;
  NEW.opponent_eliminado := OLD.opponent_eliminado;
  NEW.concluido_em := OLD.concluido_em;
  NEW.resultado_origem := OLD.resultado_origem;
  NEW.created_at := OLD.created_at;

  -- Aceite de convite privado.
  IF OLD.status = 'pendente'
     AND OLD.opponent_id = _uid
     AND NEW.opponent_id = OLD.opponent_id
     AND NEW.status IN ('em_andamento','ativo','recusado') THEN
    NEW.titulo := OLD.titulo;
    NEW.categoria := OLD.categoria;
    NEW.subcategoria := OLD.subcategoria;
    NEW.modalidade := OLD.modalidade;
    NEW.objetivo_km := OLD.objetivo_km;
    NEW.tipo_validacao := OLD.tipo_validacao;
    NEW.local_id := OLD.local_id;
    NEW.prazo := OLD.prazo;
    NEW.valor_custodia := OLD.valor_custodia;
    NEW.frequencia_tipo := OLD.frequencia_tipo;
    NEW.frequencia_quantidade := OLD.frequencia_quantidade;
    RETURN NEW;
  END IF;

  -- Aceite de duelo aberto.
  IF OLD.status = 'pendente'
     AND OLD.opponent_id IS NULL
     AND NEW.opponent_id = _uid
     AND NEW.status IN ('em_andamento','ativo') THEN
    NEW.titulo := OLD.titulo;
    NEW.categoria := OLD.categoria;
    NEW.subcategoria := OLD.subcategoria;
    NEW.modalidade := OLD.modalidade;
    NEW.objetivo_km := OLD.objetivo_km;
    NEW.tipo_validacao := OLD.tipo_validacao;
    NEW.local_id := OLD.local_id;
    NEW.prazo := OLD.prazo;
    NEW.valor_custodia := OLD.valor_custodia;
    NEW.frequencia_tipo := OLD.frequencia_tipo;
    NEW.frequencia_quantidade := OLD.frequencia_quantidade;
    RETURN NEW;
  END IF;

  IF _uid = OLD.challenger_id AND OLD.status = 'pendente' AND OLD.opponent_id IS NULL THEN
    NEW.opponent_id := OLD.opponent_id;
    NEW.status := OLD.status;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'participantes não podem alterar regras ou resultado de um duelo ativo';
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_guard_team_participant_outcome()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.vrenn_trusted('vrenn.trusted_outcome') THEN
    IF NEW.progresso IS DISTINCT FROM OLD.progresso
       OR NEW.km_acumulado IS DISTINCT FROM OLD.km_acumulado
       OR NEW.eliminado IS DISTINCT FROM OLD.eliminado
       OR NEW.eliminado_em IS DISTINCT FROM OLD.eliminado_em
       OR NEW.motivo_eliminacao IS DISTINCT FROM OLD.motivo_eliminacao
       OR NEW.concluiu IS DISTINCT FROM OLD.concluiu
       OR NEW.concluiu_em IS DISTINCT FROM OLD.concluiu_em
       OR NEW.custodia_resolvida IS DISTINCT FROM OLD.custodia_resolvida
       OR NEW.premio_recebido IS DISTINCT FROM OLD.premio_recebido THEN
      RAISE EXCEPTION 'progresso e resultado do desafio são calculados pelas provas validadas';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_guard_team_challenge_outcome()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.vrenn_trusted('vrenn.trusted_outcome') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.premio_acumulado IS DISTINCT FROM OLD.premio_acumulado THEN
      RAISE EXCEPTION 'o encerramento do desafio é automático';
    END IF;

    IF EXISTS (SELECT 1 FROM public.desafio_equipe_participantes p WHERE p.desafio_id = OLD.id)
       AND (
         NEW.tipo_validacao IS DISTINCT FROM OLD.tipo_validacao
         OR NEW.local_id IS DISTINCT FROM OLD.local_id
         OR NEW.objetivo_km IS DISTINCT FROM OLD.objetivo_km
         OR NEW.frequencia_tipo IS DISTINCT FROM OLD.frequencia_tipo
         OR NEW.frequencia_quantidade IS DISTINCT FROM OLD.frequencia_quantidade
         OR NEW.data_inicio IS DISTINCT FROM OLD.data_inicio
         OR NEW.data_fim IS DISTINCT FROM OLD.data_fim
       ) THEN
      RAISE EXCEPTION 'as regras não podem mudar depois que houver participantes';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_checkin ON public.checkins;
DROP TRIGGER IF EXISTS trg_vrenn_guard_checkin_evidence ON public.checkins;
CREATE TRIGGER trg_vrenn_guard_checkin_evidence
BEFORE INSERT OR UPDATE ON public.checkins
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_checkin_evidence();

DROP TRIGGER IF EXISTS trg_vrenn_guard_team_checkin_evidence ON public.checkins_desafio_equipe;
CREATE TRIGGER trg_vrenn_guard_team_checkin_evidence
BEFORE INSERT OR UPDATE ON public.checkins_desafio_equipe
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_team_checkin_evidence();

DROP TRIGGER IF EXISTS trg_vrenn_guard_meta_outcome ON public.metas;
CREATE TRIGGER trg_vrenn_guard_meta_outcome
BEFORE UPDATE ON public.metas
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_meta_outcome();

DROP TRIGGER IF EXISTS trg_duelos_guard ON public.duelos;
CREATE TRIGGER trg_duelos_guard
BEFORE UPDATE ON public.duelos
FOR EACH ROW EXECUTE FUNCTION public.duelos_guard();

DROP TRIGGER IF EXISTS trg_vrenn_guard_team_participant_outcome ON public.desafio_equipe_participantes;
CREATE TRIGGER trg_vrenn_guard_team_participant_outcome
BEFORE UPDATE ON public.desafio_equipe_participantes
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_team_participant_outcome();

DROP TRIGGER IF EXISTS trg_vrenn_guard_team_challenge_outcome ON public.desafios_equipe;
CREATE TRIGGER trg_vrenn_guard_team_challenge_outcome
BEFORE UPDATE ON public.desafios_equipe
FOR EACH ROW EXECUTE FUNCTION public.vrenn_guard_team_challenge_outcome();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Avaliadores autoritativos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vrenn_evaluate_meta(_meta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _m public.metas;
  _count integer;
  _km numeric;
  _target numeric;
  _metric numeric;
  _progress integer;
  _achieved boolean := false;
  _origin text;
BEGIN
  SELECT * INTO _m FROM public.metas WHERE id = _meta_id FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'meta não encontrada'; END IF;
  IF _m.status <> 'em_andamento' THEN
    RETURN jsonb_build_object('status', _m.status, 'concluida', _m.status = 'concluida');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(km_registrado),0)
  INTO _count, _km
  FROM public.checkins
  WHERE meta_id = _meta_id AND user_id = _m.user_id AND validado = true;

  IF COALESCE(_m.objetivo_km,0) > 0 THEN
    _target := _m.objetivo_km;
    _metric := _km;
    _origin := 'objetivo_km_validado';
    _achieved := _metric >= _target;
  ELSE
    _target := public.vrenn_required_checkins(
      _m.frequencia_tipo,
      _m.frequencia_quantidade,
      _m.created_at::date,
      _m.prazo::date
    );
    _metric := _count;
    _origin := 'checkins_validados';
    IF _m.frequencia_tipo = 'total' THEN
      _achieved := _metric >= COALESCE(_target,1);
    ELSIF _m.prazo IS NOT NULL AND now() >= _m.prazo THEN
      _achieved := _metric >= COALESCE(_target,1);
    END IF;
  END IF;

  _progress := CASE
    WHEN COALESCE(_target,0) <= 0 THEN LEAST(99, _count)
    ELSE LEAST(100, FLOOR((_metric / _target) * 100)::integer)
  END;

  PERFORM set_config('vrenn.trusted_outcome','1',true);
  UPDATE public.metas
  SET progresso = CASE WHEN _achieved THEN 100 ELSE _progress END,
      km_acumulado = _km,
      status = CASE WHEN _achieved THEN 'concluida' ELSE status END,
      concluida_em = CASE WHEN _achieved THEN COALESCE(concluida_em,now()) ELSE concluida_em END,
      conclusao_origem = CASE WHEN _achieved THEN _origin ELSE conclusao_origem END
  WHERE id = _meta_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN _achieved THEN 'concluida' ELSE _m.status END,
    'concluida', _achieved,
    'checkins_validados', _count,
    'km_validados', _km,
    'meta', _target,
    'progresso', CASE WHEN _achieved THEN 100 ELSE _progress END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_finalize_duel(
  _duelo_id uuid,
  _winner_id uuid,
  _tie_success boolean,
  _origin text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _d public.duelos;
BEGIN
  SELECT * INTO _d FROM public.duelos WHERE id = _duelo_id FOR UPDATE;
  IF _d.id IS NULL OR _d.status = 'concluido' THEN RETURN; END IF;
  IF _winner_id IS NOT NULL AND _winner_id NOT IN (_d.challenger_id,_d.opponent_id) THEN
    RAISE EXCEPTION 'vencedor inválido';
  END IF;

  PERFORM set_config('vrenn.trusted_outcome','1',true);
  UPDATE public.duelos
  SET status = 'concluido',
      winner_id = _winner_id,
      concluido_em = now(),
      resultado_origem = _origin,
      progresso_challenger = CASE
        WHEN _tie_success OR _winner_id = challenger_id THEN 100 ELSE progresso_challenger END,
      progresso_opponent = CASE
        WHEN _tie_success OR _winner_id = opponent_id THEN 100 ELSE progresso_opponent END
  WHERE id = _duelo_id;

  INSERT INTO public.notificacoes(user_id,tipo,mensagem,link_id,lida)
  VALUES
    (_d.challenger_id,'desafio_duelo',
      CASE WHEN _winner_id = _d.challenger_id THEN 'Você venceu o duelo com uma prova validada! 🏆'
           WHEN _winner_id IS NULL AND _tie_success THEN 'Ambos cumpriram o duelo com provas validadas.'
           WHEN _winner_id IS NULL THEN 'O duelo terminou sem que o objetivo fosse validado.'
           ELSE 'O resultado do duelo foi definido pelas provas validadas.' END,
      _duelo_id,false),
    (_d.opponent_id,'desafio_duelo',
      CASE WHEN _winner_id = _d.opponent_id THEN 'Você venceu o duelo com uma prova validada! 🏆'
           WHEN _winner_id IS NULL AND _tie_success THEN 'Ambos cumpriram o duelo com provas validadas.'
           WHEN _winner_id IS NULL THEN 'O duelo terminou sem que o objetivo fosse validado.'
           ELSE 'O resultado do duelo foi definido pelas provas validadas.' END,
      _duelo_id,false);
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_evaluate_duel(_duelo_id uuid, _force_deadline boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _d public.duelos;
  _ch_count integer;
  _op_count integer;
  _ch_km numeric;
  _op_km numeric;
  _target numeric;
  _ch_metric numeric;
  _op_metric numeric;
  _ch_progress integer;
  _op_progress integer;
  _deadline boolean;
  _winner uuid;
  _tie_success boolean := false;
BEGIN
  SELECT * INTO _d FROM public.duelos WHERE id = _duelo_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _d.status NOT IN ('ativo','em_andamento') THEN
    RETURN jsonb_build_object('status',_d.status,'winner_id',_d.winner_id);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE user_id = _d.challenger_id),
    COUNT(*) FILTER (WHERE user_id = _d.opponent_id),
    COALESCE(SUM(km_registrado) FILTER (WHERE user_id = _d.challenger_id),0),
    COALESCE(SUM(km_registrado) FILTER (WHERE user_id = _d.opponent_id),0)
  INTO _ch_count,_op_count,_ch_km,_op_km
  FROM public.checkins
  WHERE duelo_id = _duelo_id AND validado = true;

  IF COALESCE(_d.objetivo_km,0) > 0 THEN
    _target := _d.objetivo_km;
    _ch_metric := _ch_km;
    _op_metric := _op_km;
  ELSE
    _target := public.vrenn_required_checkins(
      _d.frequencia_tipo,
      _d.frequencia_quantidade,
      _d.created_at::date,
      _d.prazo::date
    );
    _target := COALESCE(_target, GREATEST(COALESCE(_d.frequencia_quantidade,1),1));
    _ch_metric := _ch_count;
    _op_metric := _op_count;
  END IF;

  _ch_progress := LEAST(100,FLOOR((_ch_metric / GREATEST(_target,1)) * 100)::integer);
  _op_progress := LEAST(100,FLOOR((_op_metric / GREATEST(_target,1)) * 100)::integer);
  PERFORM set_config('vrenn.trusted_outcome','1',true);
  UPDATE public.duelos
  SET progresso_challenger = _ch_progress,
      progresso_opponent = _op_progress
  WHERE id = _duelo_id;

  IF _d.tipo_validacao = 'foto_arbitro' THEN
    RETURN jsonb_build_object('status',_d.status,'arbitragem_pendente',true,
      'progresso_challenger',_ch_progress,'progresso_opponent',_op_progress);
  END IF;

  _deadline := _force_deadline OR (_d.prazo IS NOT NULL AND now() >= _d.prazo);

  IF COALESCE(_d.challenger_eliminado,false) AND NOT COALESCE(_d.opponent_eliminado,false) THEN
    _winner := _d.opponent_id;
  ELSIF COALESCE(_d.opponent_eliminado,false) AND NOT COALESCE(_d.challenger_eliminado,false) THEN
    _winner := _d.challenger_id;
  ELSIF COALESCE(_d.challenger_eliminado,false) AND COALESCE(_d.opponent_eliminado,false) THEN
    _winner := NULL;
  ELSIF _ch_metric >= _target AND _op_metric >= _target THEN
    _tie_success := true;
    _winner := NULL;
  ELSIF _ch_metric >= _target THEN
    _winner := _d.challenger_id;
  ELSIF _op_metric >= _target THEN
    _winner := _d.opponent_id;
  ELSIF NOT _deadline THEN
    RETURN jsonb_build_object('status',_d.status,'progresso_challenger',_ch_progress,
      'progresso_opponent',_op_progress,'meta',_target);
  ELSE
    _winner := NULL;
  END IF;

  PERFORM public.vrenn_finalize_duel(
    _duelo_id,
    _winner,
    _tie_success,
    CASE WHEN _deadline THEN 'validacao_automatica_prazo' ELSE 'validacao_automatica_objetivo' END
  );

  RETURN jsonb_build_object('status','concluido','winner_id',_winner,'empate_sucesso',_tie_success,
    'progresso_challenger',_ch_progress,'progresso_opponent',_op_progress);
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_settle_team_participant(_desafio_id uuid, _user_id uuid, _success boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.desafio_equipe_participantes;
  _d public.desafios_equipe;
  _value numeric;
  _fee numeric;
  _pool numeric;
  _fund numeric;
BEGIN
  SELECT * INTO _p FROM public.desafio_equipe_participantes
  WHERE desafio_id = _desafio_id AND user_id = _user_id FOR UPDATE;
  IF _p.id IS NULL OR _p.custodia_resolvida THEN RETURN; END IF;
  SELECT * INTO _d FROM public.desafios_equipe WHERE id = _desafio_id FOR UPDATE;
  _value := COALESCE(_d.valor_entrada,0);

  PERFORM set_config('vrenn.trusted_outcome','1',true);

  IF _value > 0 AND _success THEN
    _fee := ROUND(_value * 0.03,2);
    UPDATE public.wallets
    SET balance = balance + (_value - _fee),
        locked_balance = GREATEST(0,locked_balance - _value), updated_at = now()
    WHERE user_id = _user_id;
    INSERT INTO public.transactions(user_id,type,amount,status,description)
    VALUES
      (_user_id,'unlock',_value - _fee,'confirmed','Desafio de equipe concluído — custódia devolvida'),
      (_user_id,'fee',_fee,'confirmed','Taxa VRENN do desafio de equipe');
  ELSIF _value > 0 THEN
    _pool := ROUND(_value * 0.75,2);
    _fund := ROUND(_value * 0.125,2);
    _fee := _value - _pool - _fund;
    UPDATE public.wallets
    SET locked_balance = GREATEST(0,locked_balance - _value), updated_at = now()
    WHERE user_id = _user_id;
    UPDATE public.desafios_equipe SET premio_acumulado = premio_acumulado + _pool WHERE id = _desafio_id;
    UPDATE public.fundo_temporada SET valor_acumulado = valor_acumulado + _fund, updated_at = now();
    IF NOT FOUND THEN
      INSERT INTO public.fundo_temporada(valor_acumulado) VALUES (_fund);
    END IF;
    INSERT INTO public.transactions(user_id,type,amount,status,description)
    VALUES
      (_user_id,'lock',_value,'confirmed','Custódia absorvida — desafio não concluído'),
      (_user_id,'fee',_fee,'confirmed','Taxa VRENN do desafio não concluído');
  END IF;

  UPDATE public.desafio_equipe_participantes
  SET custodia_resolvida = true
  WHERE id = _p.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_evaluate_team_participant(
  _desafio_id uuid,
  _user_id uuid,
  _force_deadline boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _d public.desafios_equipe;
  _p public.desafio_equipe_participantes;
  _count integer;
  _km numeric;
  _target numeric;
  _metric numeric;
  _progress integer;
  _achieved boolean := false;
  _deadline boolean;
BEGIN
  SELECT * INTO _d FROM public.desafios_equipe WHERE id = _desafio_id;
  SELECT * INTO _p FROM public.desafio_equipe_participantes
  WHERE desafio_id = _desafio_id AND user_id = _user_id FOR UPDATE;
  IF _d.id IS NULL OR _p.id IS NULL THEN RAISE EXCEPTION 'participação não encontrada'; END IF;
  IF _p.concluiu OR COALESCE(_p.eliminado,false) THEN
    RETURN jsonb_build_object('concluiu',_p.concluiu,'eliminado',_p.eliminado);
  END IF;

  SELECT COUNT(*), COALESCE(SUM(km_registrado),0)
  INTO _count,_km
  FROM public.checkins_desafio_equipe
  WHERE desafio_id = _desafio_id AND user_id = _user_id AND validado = true;

  IF COALESCE(_d.objetivo_km,0) > 0 THEN
    _target := _d.objetivo_km;
    _metric := _km;
  ELSE
    _target := public.vrenn_required_checkins(
      _d.frequencia_tipo,
      _d.frequencia_quantidade,
      _d.data_inicio,
      _d.data_fim
    );
    _target := COALESCE(_target,GREATEST(COALESCE(_d.frequencia_quantidade,1),1));
    _metric := _count;
  END IF;

  _deadline := _force_deadline OR (_d.data_fim IS NOT NULL AND current_date > _d.data_fim);
  IF _d.frequencia_tipo = 'total' OR COALESCE(_d.objetivo_km,0) > 0 THEN
    _achieved := _metric >= _target;
  ELSIF _deadline THEN
    _achieved := _metric >= _target;
  END IF;

  _progress := LEAST(100,FLOOR((_metric / GREATEST(_target,1)) * 100)::integer);
  PERFORM set_config('vrenn.trusted_outcome','1',true);
  UPDATE public.desafio_equipe_participantes
  SET progresso = _count,
      km_acumulado = _km,
      concluiu = _achieved,
      concluiu_em = CASE WHEN _achieved THEN COALESCE(concluiu_em,now()) ELSE concluiu_em END,
      status = CASE WHEN _achieved THEN 'concluida' ELSE status END,
      updated_at = now()
  WHERE id = _p.id;

  IF _achieved THEN
    PERFORM public.vrenn_settle_team_participant(_desafio_id,_user_id,true);
  END IF;

  RETURN jsonb_build_object('concluiu',_achieved,'checkins_validados',_count,
    'km_validados',_km,'meta',_target,'progresso_percentual',_progress);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Registro seguro de QR, geolocalização, Strava e árbitro
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_checkin_validado(
  _entidade text,
  _entidade_id uuid,
  _metodo text,
  _qrcode_token text DEFAULT NULL,
  _latitude numeric DEFAULT NULL,
  _longitude numeric DEFAULT NULL,
  _mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _configured text;
  _local_id uuid;
  _status text;
  _local public.locais_validacao;
  _checkin_id uuid;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'não autorizado'; END IF;
  IF _metodo NOT IN ('qrcode','geolocalizacao') THEN RAISE EXCEPTION 'método inválido'; END IF;

  IF _entidade = 'meta' THEN
    SELECT tipo_validacao,local_id,status INTO _configured,_local_id,_status
    FROM public.metas WHERE id = _entidade_id AND user_id = _uid;
    IF _status IS DISTINCT FROM 'em_andamento' THEN RAISE EXCEPTION 'meta não está ativa'; END IF;
  ELSIF _entidade = 'duelo' THEN
    SELECT tipo_validacao,local_id,status INTO _configured,_local_id,_status
    FROM public.duelos
    WHERE id = _entidade_id AND _uid IN (challenger_id,opponent_id)
      AND NOT (CASE WHEN _uid=challenger_id THEN COALESCE(challenger_eliminado,false)
                    ELSE COALESCE(opponent_eliminado,false) END);
    IF _status NOT IN ('ativo','em_andamento') THEN RAISE EXCEPTION 'duelo não está ativo'; END IF;
  ELSIF _entidade = 'desafio_equipe' THEN
    SELECT d.tipo_validacao,d.local_id,d.status INTO _configured,_local_id,_status
    FROM public.desafios_equipe d
    JOIN public.desafio_equipe_participantes p ON p.desafio_id=d.id
    WHERE d.id=_entidade_id AND p.user_id=_uid AND NOT COALESCE(p.eliminado,false);
    IF _status IS DISTINCT FROM 'ativo' THEN RAISE EXCEPTION 'desafio não está ativo'; END IF;
  ELSE
    RAISE EXCEPTION 'entidade inválida';
  END IF;

  IF _configured IS NULL THEN RAISE EXCEPTION 'entidade não encontrada'; END IF;
  IF _configured IS DISTINCT FROM _metodo THEN
    RAISE EXCEPTION 'esta atividade exige validação por %',_configured;
  END IF;
  IF _local_id IS NULL THEN RAISE EXCEPTION 'local de validação não configurado'; END IF;
  SELECT * INTO _local FROM public.locais_validacao WHERE id=_local_id;

  IF _metodo='qrcode' THEN
    IF _qrcode_token IS NULL OR _qrcode_token IS DISTINCT FROM _local.qrcode_token::text THEN
      RAISE EXCEPTION 'QR Code inválido';
    END IF;
  ELSE
    IF _latitude IS NULL OR _longitude IS NULL THEN RAISE EXCEPTION 'localização obrigatória'; END IF;
    IF public.vrenn_distance_meters(_latitude,_longitude,_local.latitude,_local.longitude)
       > _local.raio_geofence_metros THEN
      RAISE EXCEPTION 'você está fora do raio permitido';
    END IF;
  END IF;

  PERFORM set_config('vrenn.trusted_validation','1',true);

  IF _entidade='desafio_equipe' THEN
    INSERT INTO public.checkins_desafio_equipe(
      desafio_id,user_id,mensagem,validado,metodo_validacao,latitude,longitude,qrcode_lido,validado_em
    ) VALUES (
      _entidade_id,_uid,_mensagem,true,_metodo,_latitude,_longitude,
      CASE WHEN _metodo='qrcode' THEN _qrcode_token ELSE NULL END,now()
    ) RETURNING id INTO _checkin_id;
    _result := public.vrenn_evaluate_team_participant(_entidade_id,_uid,false);
  ELSE
    INSERT INTO public.checkins(
      meta_id,duelo_id,user_id,mensagem,validado,metodo_validacao,latitude,longitude,qrcode_lido,validado_em,dia
    ) VALUES (
      CASE WHEN _entidade='meta' THEN _entidade_id ELSE NULL END,
      CASE WHEN _entidade='duelo' THEN _entidade_id ELSE NULL END,
      _uid,_mensagem,true,_metodo,_latitude,_longitude,
      CASE WHEN _metodo='qrcode' THEN _qrcode_token ELSE NULL END,now(),current_date
    ) RETURNING id INTO _checkin_id;
    _result := CASE WHEN _entidade='meta'
      THEN public.vrenn_evaluate_meta(_entidade_id)
      ELSE public.vrenn_evaluate_duel(_entidade_id,false) END;
  END IF;

  RETURN jsonb_build_object('checkin_id',_checkin_id,'resultado',_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_checkin_strava(
  _user_id uuid,
  _entidade text,
  _entidade_id uuid,
  _activity_id text,
  _activity_started_at timestamptz,
  _km numeric,
  _mensagem text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _configured text;
  _status text;
  _start timestamptz;
  _deadline timestamptz;
  _checkin_id uuid;
  _result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF _km IS NULL OR _km <= 0 THEN RAISE EXCEPTION 'distância Strava inválida'; END IF;

  IF _entidade='meta' THEN
    SELECT tipo_validacao,status,created_at,prazo INTO _configured,_status,_start,_deadline
    FROM public.metas WHERE id=_entidade_id AND user_id=_user_id;
    IF _status IS DISTINCT FROM 'em_andamento' THEN RAISE EXCEPTION 'meta não está ativa'; END IF;
  ELSIF _entidade='duelo' THEN
    SELECT tipo_validacao,status,created_at,prazo INTO _configured,_status,_start,_deadline
    FROM public.duelos WHERE id=_entidade_id AND _user_id IN (challenger_id,opponent_id);
    IF _status NOT IN ('ativo','em_andamento') THEN RAISE EXCEPTION 'duelo não está ativo'; END IF;
  ELSIF _entidade='desafio_equipe' THEN
    SELECT d.tipo_validacao,d.status,d.data_inicio::timestamptz,
           (d.data_fim::date + 1)::timestamptz
    INTO _configured,_status,_start,_deadline
    FROM public.desafios_equipe d
    JOIN public.desafio_equipe_participantes p ON p.desafio_id=d.id
    WHERE d.id=_entidade_id AND p.user_id=_user_id AND NOT COALESCE(p.eliminado,false);
    IF _status IS DISTINCT FROM 'ativo' THEN RAISE EXCEPTION 'desafio não está ativo'; END IF;
  ELSE
    RAISE EXCEPTION 'entidade inválida';
  END IF;

  IF _configured IS DISTINCT FROM 'strava' THEN RAISE EXCEPTION 'esta atividade não usa Strava'; END IF;
  IF _activity_started_at < _start THEN RAISE EXCEPTION 'atividade anterior ao início do compromisso'; END IF;
  IF _deadline IS NOT NULL AND _activity_started_at > _deadline THEN RAISE EXCEPTION 'atividade após o prazo'; END IF;

  INSERT INTO public.validation_evidence_registry(
    user_id,provider,external_id,entity_type,entity_id,activity_started_at
  ) VALUES (_user_id,'strava',_activity_id,_entidade,_entidade_id,_activity_started_at);

  PERFORM set_config('vrenn.trusted_validation','1',true);
  IF _entidade='desafio_equipe' THEN
    INSERT INTO public.checkins_desafio_equipe(
      desafio_id,user_id,mensagem,validado,metodo_validacao,km_registrado,
      strava_activity_id,validado_em
    ) VALUES (_entidade_id,_user_id,_mensagem,true,'strava',_km,_activity_id,now())
    RETURNING id INTO _checkin_id;
    _result := public.vrenn_evaluate_team_participant(_entidade_id,_user_id,false);
  ELSE
    INSERT INTO public.checkins(
      meta_id,duelo_id,user_id,mensagem,validado,metodo_validacao,km_registrado,
      strava_activity_id,wearable_activity_id,validado_em,dia
    ) VALUES (
      CASE WHEN _entidade='meta' THEN _entidade_id ELSE NULL END,
      CASE WHEN _entidade='duelo' THEN _entidade_id ELSE NULL END,
      _user_id,_mensagem,true,'strava',_km,_activity_id,_activity_id,now(),current_date
    ) RETURNING id INTO _checkin_id;
    _result := CASE WHEN _entidade='meta'
      THEN public.vrenn_evaluate_meta(_entidade_id)
      ELSE public.vrenn_evaluate_duel(_entidade_id,false) END;
  END IF;

  UPDATE public.validation_evidence_registry SET checkin_id=_checkin_id
  WHERE user_id=_user_id AND provider='strava' AND external_id=_activity_id;

  RETURN jsonb_build_object('checkin_id',_checkin_id,'resultado',_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_checkin_arbitro(
  _tipo_checkin text,
  _checkin_id uuid,
  _aprovar boolean,
  _comentario text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _c public.checkins;
  _ct public.checkins_desafio_equipe;
  _allowed boolean := false;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'não autorizado'; END IF;

  IF _tipo_checkin='geral' THEN
    SELECT * INTO _c FROM public.checkins WHERE id=_checkin_id FOR UPDATE;
    IF _c.id IS NULL THEN RAISE EXCEPTION 'check-in não encontrado'; END IF;
    IF _c.user_id=_uid THEN RAISE EXCEPTION 'ninguém pode validar a própria prova'; END IF;

    IF _c.meta_id IS NOT NULL THEN
      _allowed := EXISTS (
        SELECT 1 FROM public.arbitros a
        JOIN public.metas m ON m.id=a.meta_id
        WHERE a.meta_id=_c.meta_id AND a.arbitro_id=_uid AND a.status='aceito'
          AND m.tipo_validacao='foto_arbitro'
      );
    ELSIF _c.duelo_id IS NOT NULL THEN
      _allowed := EXISTS (
        SELECT 1 FROM public.duelos d
        WHERE d.id=_c.duelo_id AND d.arbitro_id=_uid AND d.arbitro_status='aceito'
          AND d.tipo_validacao='foto_arbitro'
      );
    END IF;
    IF NOT _allowed THEN RAISE EXCEPTION 'você não é o árbitro autorizado'; END IF;

    INSERT INTO public.checkin_validacoes(checkin_id,arbitro_id,status,comentario)
    VALUES (_checkin_id,_uid,CASE WHEN _aprovar THEN 'validado' ELSE 'questionado' END,_comentario)
    ON CONFLICT (checkin_id,arbitro_id) DO UPDATE
      SET status=EXCLUDED.status,comentario=EXCLUDED.comentario;

    PERFORM set_config('vrenn.trusted_validation','1',true);
    UPDATE public.checkins
    SET validado=_aprovar,
        validado_em=CASE WHEN _aprovar THEN now() ELSE NULL END,
        validado_por=CASE WHEN _aprovar THEN _uid ELSE NULL END,
        metodo_validacao='foto_arbitro'
    WHERE id=_checkin_id;

    _result := CASE WHEN _c.meta_id IS NOT NULL
      THEN public.vrenn_evaluate_meta(_c.meta_id)
      ELSE public.vrenn_evaluate_duel(_c.duelo_id,false) END;
  ELSIF _tipo_checkin='desafio_equipe' THEN
    SELECT * INTO _ct FROM public.checkins_desafio_equipe WHERE id=_checkin_id FOR UPDATE;
    IF _ct.id IS NULL THEN RAISE EXCEPTION 'check-in não encontrado'; END IF;
    IF _ct.user_id=_uid THEN RAISE EXCEPTION 'ninguém pode validar a própria prova'; END IF;

    _allowed := EXISTS (
      SELECT 1 FROM public.desafios_equipe d
      JOIN public.equipes e ON e.id=d.equipe_id
      LEFT JOIN public.equipe_membros em ON em.equipe_id=e.id AND em.user_id=_uid
      WHERE d.id=_ct.desafio_id AND d.tipo_validacao='foto_arbitro'
        AND (_uid=e.criador_id OR em.papel IN ('admin','co_admin'))
    );
    IF NOT _allowed THEN RAISE EXCEPTION 'você não é um árbitro autorizado da equipe'; END IF;

    INSERT INTO public.checkin_validacoes_equipe(checkin_id,arbitro_id,status,comentario,updated_at)
    VALUES (_checkin_id,_uid,CASE WHEN _aprovar THEN 'validado' ELSE 'questionado' END,_comentario,now())
    ON CONFLICT (checkin_id,arbitro_id) DO UPDATE
      SET status=EXCLUDED.status,comentario=EXCLUDED.comentario,updated_at=now();

    PERFORM set_config('vrenn.trusted_validation','1',true);
    UPDATE public.checkins_desafio_equipe
    SET validado=_aprovar,
        validado_em=CASE WHEN _aprovar THEN now() ELSE NULL END,
        validado_por=CASE WHEN _aprovar THEN _uid ELSE NULL END,
        metodo_validacao='foto_arbitro'
    WHERE id=_checkin_id;
    _result := public.vrenn_evaluate_team_participant(_ct.desafio_id,_ct.user_id,false);
  ELSE
    RAISE EXCEPTION 'tipo de check-in inválido';
  END IF;

  RETURN jsonb_build_object('aprovado',_aprovar,'resultado',_result);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Gatilhos de avaliação e reputação somente após validação
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vrenn_after_validated_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.validado=true AND (TG_OP='INSERT' OR OLD.validado IS DISTINCT FROM true) THEN
    IF NEW.meta_id IS NOT NULL THEN
      PERFORM public.vrenn_evaluate_meta(NEW.meta_id);
    ELSIF NEW.duelo_id IS NOT NULL THEN
      PERFORM public.vrenn_evaluate_duel(NEW.duelo_id,false);
    END IF;
    PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_validado',COALESCE(NEW.meta_id,NEW.duelo_id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_after_validated_team_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.validado=true AND (TG_OP='INSERT' OR OLD.validado IS DISTINCT FROM true) THEN
    PERFORM public.vrenn_evaluate_team_participant(NEW.desafio_id,NEW.user_id,false);
    PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_desafio_validado',NEW.desafio_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_progresso_checkin_insert ON public.checkins;
DROP TRIGGER IF EXISTS trg_progresso_checkin_update ON public.checkins;
DROP TRIGGER IF EXISTS trg_verificar_km_meta ON public.checkins;
DROP TRIGGER IF EXISTS trg_verificar_km_duelo ON public.checkins;
DROP TRIGGER IF EXISTS trg_checkin_reputacao ON public.checkins;
DROP TRIGGER IF EXISTS trg_conquistas_checkin ON public.checkins;
DROP TRIGGER IF EXISTS trg_vrenn_after_validated_checkin ON public.checkins;
CREATE TRIGGER trg_vrenn_after_validated_checkin
AFTER INSERT OR UPDATE OF validado ON public.checkins
FOR EACH ROW EXECUTE FUNCTION public.vrenn_after_validated_checkin();

DROP TRIGGER IF EXISTS trg_checkin_desafio_progresso ON public.checkins_desafio_equipe;
DROP TRIGGER IF EXISTS trg_vrenn_after_validated_team_checkin ON public.checkins_desafio_equipe;
CREATE TRIGGER trg_vrenn_after_validated_team_checkin
AFTER INSERT OR UPDATE OF validado ON public.checkins_desafio_equipe
FOR EACH ROW EXECUTE FUNCTION public.vrenn_after_validated_team_checkin();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Resolução de árbitro, custódia de duelo e encerramentos por prazo
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_duelo_custodia()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _loser uuid;
  _fee numeric;
  _fund numeric;
  _prize numeric;
BEGIN
  IF OLD.status IN ('ativo','em_andamento') AND NEW.status='concluido'
     AND COALESCE(NEW.valor_custodia,0)>0 THEN
    IF NEW.winner_id IS NOT NULL THEN
      _loser := CASE WHEN NEW.winner_id=NEW.challenger_id THEN NEW.opponent_id ELSE NEW.challenger_id END;
      _fee := ROUND(NEW.valor_custodia * 0.06,2);
      _fund := ROUND(NEW.valor_custodia * 0.06,2);
      _prize := NEW.valor_custodia - _fee - _fund;
      UPDATE public.wallets
      SET balance=balance+NEW.valor_custodia+_prize,
          locked_balance=GREATEST(0,locked_balance-NEW.valor_custodia),updated_at=now()
      WHERE user_id=NEW.winner_id;
      UPDATE public.wallets
      SET locked_balance=GREATEST(0,locked_balance-NEW.valor_custodia),updated_at=now()
      WHERE user_id=_loser;
      UPDATE public.fundo_temporada SET valor_acumulado=valor_acumulado+_fund,updated_at=now();
      IF NOT FOUND THEN INSERT INTO public.fundo_temporada(valor_acumulado) VALUES (_fund); END IF;
      INSERT INTO public.transactions(user_id,type,amount,status,description) VALUES
        (NEW.winner_id,'unlock',NEW.valor_custodia,'confirmed','Devolução da própria custódia — duelo'),
        (NEW.winner_id,'prize',_prize,'confirmed','Prêmio de duelo validado'),
        (_loser,'fee',_fee,'confirmed','Taxa do duelo perdido');
    ELSIF NEW.progresso_challenger>=100 AND NEW.progresso_opponent>=100 THEN
      UPDATE public.wallets
      SET balance=balance+NEW.valor_custodia,
          locked_balance=GREATEST(0,locked_balance-NEW.valor_custodia),updated_at=now()
      WHERE user_id IN (NEW.challenger_id,NEW.opponent_id);
      INSERT INTO public.transactions(user_id,type,amount,status,description) VALUES
        (NEW.challenger_id,'unlock',NEW.valor_custodia,'confirmed','Empate: ambos cumpriram o duelo'),
        (NEW.opponent_id,'unlock',NEW.valor_custodia,'confirmed','Empate: ambos cumpriram o duelo');
    ELSE
      _fund := ROUND(NEW.valor_custodia*0.75,2);
      _fee := NEW.valor_custodia-_fund;
      UPDATE public.wallets
      SET locked_balance=GREATEST(0,locked_balance-NEW.valor_custodia),updated_at=now()
      WHERE user_id IN (NEW.challenger_id,NEW.opponent_id);
      UPDATE public.fundo_temporada SET valor_acumulado=valor_acumulado+(_fund*2),updated_at=now();
      IF NOT FOUND THEN INSERT INTO public.fundo_temporada(valor_acumulado) VALUES (_fund*2); END IF;
      INSERT INTO public.transactions(user_id,type,amount,status,description) VALUES
        (NEW.challenger_id,'fee',_fee,'confirmed','Duelo não concluído'),
        (NEW.opponent_id,'fee',_fee,'confirmed','Duelo não concluído');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.arbitro_declarar_resultado_duelo(
  _duelo_id uuid,
  _winner_id uuid,
  _empate boolean DEFAULT false,
  _sucesso boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _d public.duelos;
BEGIN
  SELECT * INTO _d FROM public.duelos WHERE id=_duelo_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _d.status='concluido' THEN RAISE EXCEPTION 'duelo já encerrado'; END IF;

  IF _d.tipo_validacao <> 'foto_arbitro' THEN
    PERFORM public.vrenn_evaluate_duel(_duelo_id, _d.prazo IS NOT NULL AND now()>=_d.prazo);
    IF (SELECT status FROM public.duelos WHERE id=_duelo_id) <> 'concluido' THEN
      RAISE EXCEPTION 'este duelo é resolvido automaticamente pelas provas validadas';
    END IF;
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL
     AND (auth.uid() IS DISTINCT FROM _d.arbitro_id OR _d.arbitro_status IS DISTINCT FROM 'aceito') THEN
    RAISE EXCEPTION 'apenas o árbitro aceito pode declarar o resultado';
  END IF;
  IF NOT _empate AND _winner_id NOT IN (_d.challenger_id,_d.opponent_id) THEN
    RAISE EXCEPTION 'vencedor inválido';
  END IF;

  PERFORM public.vrenn_finalize_duel(
    _duelo_id,
    CASE WHEN _empate THEN NULL ELSE _winner_id END,
    _empate AND _sucesso,
    'arbitro_aceito'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_duelos_prazo_vencido()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _d record;
BEGIN
  FOR _d IN
    SELECT id,tipo_validacao,arbitro_id
    FROM public.duelos
    WHERE status IN ('ativo','em_andamento') AND prazo IS NOT NULL AND prazo<now()
  LOOP
    IF _d.tipo_validacao <> 'foto_arbitro' THEN
      PERFORM public.vrenn_evaluate_duel(_d.id,true);
    ELSE
      INSERT INTO public.notificacoes(user_id,tipo,mensagem,link_id,lida)
      SELECT _d.arbitro_id,'arbitragem_pendente','O prazo do duelo terminou. Declare o resultado com base nas provas.',_d.id,false
      WHERE _d.arbitro_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_desafio_equipe(_desafio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _d public.desafios_equipe;
  _r record;
  _pool numeric;
  _winners integer;
  _limit integer;
  _pos integer:=0;
  _weight numeric;
  _weight_sum numeric:=0;
  _award numeric;
  _custom_pct numeric;
BEGIN
  SELECT * INTO _d FROM public.desafios_equipe WHERE id=_desafio_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'desafio não encontrado'; END IF;
  IF _d.status='concluido' THEN RETURN jsonb_build_object('status','concluido'); END IF;
  IF _d.data_fim IS NOT NULL AND current_date<=_d.data_fim AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'o desafio ainda não terminou';
  END IF;

  FOR _r IN SELECT user_id FROM public.desafio_equipe_participantes WHERE desafio_id=_desafio_id LOOP
    PERFORM public.vrenn_evaluate_team_participant(_desafio_id,_r.user_id,true);
  END LOOP;

  PERFORM set_config('vrenn.trusted_outcome','1',true);
  FOR _r IN
    SELECT * FROM public.desafio_equipe_participantes
    WHERE desafio_id=_desafio_id AND NOT concluiu AND NOT COALESCE(eliminado,false)
    FOR UPDATE
  LOOP
    UPDATE public.desafio_equipe_participantes
    SET eliminado=true,eliminado_em=now(),motivo_eliminacao='ausencia',status='falhada',updated_at=now()
    WHERE id=_r.id;
    PERFORM public.vrenn_settle_team_participant(_desafio_id,_r.user_id,false);
  END LOOP;

  SELECT COUNT(*) INTO _winners
  FROM public.desafio_equipe_participantes
  WHERE desafio_id=_desafio_id AND concluiu=true AND NOT COALESCE(eliminado,false);
  SELECT premio_acumulado INTO _pool FROM public.desafios_equipe WHERE id=_desafio_id FOR UPDATE;
  _pool:=COALESCE(_pool,0);

  IF _winners=0 THEN
    UPDATE public.fundo_temporada SET valor_acumulado=valor_acumulado+_pool,updated_at=now();
    IF NOT FOUND AND _pool>0 THEN INSERT INTO public.fundo_temporada(valor_acumulado) VALUES (_pool); END IF;
  ELSIF _pool>0 THEN
    _limit:=LEAST(COALESCE(_d.colocacoes_premiadas,_winners),_winners);
    IF _d.modo_distribuicao='igual' THEN
      _weight_sum:=_limit;
    ELSIF _d.modo_distribuicao='personalizado' THEN
      SELECT COALESCE(SUM(CASE WHEN (x->>'pct')::numeric>1 THEN (x->>'pct')::numeric/100 ELSE (x->>'pct')::numeric END),0)
      INTO _weight_sum FROM jsonb_array_elements(COALESCE(_d.distribuicao_custom,'[]'::jsonb)) x
      WHERE (x->>'posicao')::integer<=_limit;
      IF _weight_sum<=0 THEN _weight_sum:=_limit; END IF;
    ELSE
      SELECT SUM(w) INTO _weight_sum FROM unnest(ARRAY[35,25,18,12,10,7,5,4,3,2]::numeric[]) WITH ORDINALITY u(w,i)
      WHERE i<=_limit;
    END IF;

    FOR _r IN
      SELECT p.*,
        row_number() OVER (ORDER BY
          CASE WHEN _d.criterio_ranking='primeiro_a_concluir' THEN 0 ELSE p.progresso END DESC,
          p.concluiu_em ASC NULLS LAST
        ) pos
      FROM public.desafio_equipe_participantes p
      WHERE p.desafio_id=_desafio_id AND p.concluiu=true AND NOT COALESCE(p.eliminado,false)
      ORDER BY pos LIMIT _limit
    LOOP
      _pos:=_r.pos;
      IF _d.modo_distribuicao='igual' THEN
        _weight:=1;
      ELSIF _d.modo_distribuicao='personalizado' THEN
        SELECT CASE WHEN (x->>'pct')::numeric>1 THEN (x->>'pct')::numeric/100 ELSE (x->>'pct')::numeric END
        INTO _custom_pct FROM jsonb_array_elements(COALESCE(_d.distribuicao_custom,'[]'::jsonb)) x
        WHERE (x->>'posicao')::integer=_pos LIMIT 1;
        _weight:=COALESCE(_custom_pct,1);
      ELSE
        _weight:=(ARRAY[35,25,18,12,10,7,5,4,3,2]::numeric[])[LEAST(_pos,10)];
      END IF;
      _award:=ROUND(_pool*(_weight/_weight_sum),2);
      UPDATE public.wallets SET balance=balance+_award,updated_at=now() WHERE user_id=_r.user_id;
      UPDATE public.desafio_equipe_participantes SET premio_recebido=_award WHERE id=_r.id;
      INSERT INTO public.transactions(user_id,type,amount,status,description)
      VALUES (_r.user_id,'prize',_award,'confirmed',format('Prêmio do desafio de equipe — %sº lugar',_pos));
    END LOOP;
  END IF;

  UPDATE public.desafios_equipe SET status='concluido',premio_acumulado=0 WHERE id=_desafio_id;
  RETURN jsonb_build_object('status','concluido','concluintes',_winners,'pool',_pool);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_desafios_equipe_prazo_vencido()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _d record;
BEGIN
  FOR _d IN SELECT id FROM public.desafios_equipe
    WHERE status='ativo' AND data_fim IS NOT NULL AND data_fim<current_date
  LOOP
    PERFORM public.resolver_desafio_equipe(_d.id);
  END LOOP;
END;
$$;

-- Eliminações agora contam somente evidências validadas da entidade correta.
CREATE OR REPLACE FUNCTION public.processar_eliminacoes_diarias()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _yesterday date:=current_date-1;
  _week_start date:=date_trunc('week',current_date-1)::date;
  _r record;
BEGIN
  PERFORM set_config('vrenn.trusted_outcome','1',true);

  UPDATE public.metas m SET status='falhada'
  WHERE m.status='em_andamento' AND m.frequencia_tipo='diario'
    AND m.created_at::date<=_yesterday
    AND (m.prazo IS NULL OR m.prazo::date>=_yesterday)
    AND (SELECT COUNT(*) FROM public.checkins c
         WHERE c.meta_id=m.id AND c.user_id=m.user_id AND c.validado=true AND c.created_at::date=_yesterday)
        < GREATEST(COALESCE(m.frequencia_quantidade,1),1)
    AND NOT EXISTS (SELECT 1 FROM public.justificativas_falta j
      WHERE j.meta_id=m.id AND j.user_id=m.user_id AND j.data_referencia=_yesterday AND j.status='aprovado');

  IF extract(dow FROM current_date)=1 THEN
    UPDATE public.metas m SET status='falhada'
    WHERE m.status='em_andamento' AND m.frequencia_tipo='semanal'
      AND (SELECT COUNT(*) FROM public.checkins c
           WHERE c.meta_id=m.id AND c.user_id=m.user_id AND c.validado=true
             AND c.created_at::date BETWEEN _week_start AND _yesterday)
          < GREATEST(COALESCE(m.frequencia_quantidade,1),1);
  END IF;

  UPDATE public.duelos d SET challenger_eliminado=true,challenger_eliminado_em=now()
  WHERE d.status IN ('ativo','em_andamento') AND d.frequencia_tipo='diario'
    AND NOT COALESCE(d.challenger_eliminado,false)
    AND (SELECT COUNT(*) FROM public.checkins c
         WHERE c.duelo_id=d.id AND c.user_id=d.challenger_id AND c.validado=true
           AND c.created_at::date=_yesterday)
        < GREATEST(COALESCE(d.frequencia_quantidade,1),1)
    AND NOT EXISTS (SELECT 1 FROM public.justificativas_falta j
      WHERE j.duelo_id=d.id AND j.user_id=d.challenger_id AND j.data_referencia=_yesterday AND j.status='aprovado');

  UPDATE public.duelos d SET opponent_eliminado=true,opponent_eliminado_em=now()
  WHERE d.status IN ('ativo','em_andamento') AND d.frequencia_tipo='diario'
    AND d.opponent_id IS NOT NULL AND NOT COALESCE(d.opponent_eliminado,false)
    AND (SELECT COUNT(*) FROM public.checkins c
         WHERE c.duelo_id=d.id AND c.user_id=d.opponent_id AND c.validado=true
           AND c.created_at::date=_yesterday)
        < GREATEST(COALESCE(d.frequencia_quantidade,1),1)
    AND NOT EXISTS (SELECT 1 FROM public.justificativas_falta j
      WHERE j.duelo_id=d.id AND j.user_id=d.opponent_id AND j.data_referencia=_yesterday AND j.status='aprovado');

  FOR _r IN
    SELECT p.id,p.desafio_id,p.user_id
    FROM public.desafio_equipe_participantes p
    JOIN public.desafios_equipe d ON d.id=p.desafio_id
    WHERE d.status='ativo' AND d.frequencia_tipo='diario'
      AND NOT COALESCE(p.eliminado,false) AND NOT p.concluiu
      AND d.data_inicio<=_yesterday AND (d.data_fim IS NULL OR d.data_fim>=_yesterday)
      AND (SELECT COUNT(*) FROM public.checkins_desafio_equipe c
           WHERE c.desafio_id=d.id AND c.user_id=p.user_id AND c.validado=true
             AND c.created_at::date=_yesterday)
          < GREATEST(COALESCE(d.frequencia_quantidade,1),1)
      AND NOT EXISTS (SELECT 1 FROM public.justificativas_falta j
        WHERE j.desafio_id=d.id AND j.user_id=p.user_id AND j.data_referencia=_yesterday AND j.status='aprovado')
  LOOP
    UPDATE public.desafio_equipe_participantes
    SET eliminado=true,eliminado_em=now(),motivo_eliminacao='ausencia',status='falhada',updated_at=now()
    WHERE id=_r.id;
    PERFORM public.vrenn_settle_team_participant(_r.desafio_id,_r.user_id,false);
  END LOOP;
END;
$$;

-- Cron idempotente.
SELECT cron.unschedule('vrenn-duelos-prazo-vencido')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='vrenn-duelos-prazo-vencido');
SELECT cron.schedule('vrenn-duelos-prazo-vencido','10 0 * * *',
  $$ SELECT public.resolver_duelos_prazo_vencido(); $$);

SELECT cron.unschedule('vrenn-desafios-equipe-prazo-vencido')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='vrenn-desafios-equipe-prazo-vencido');
SELECT cron.schedule('vrenn-desafios-equipe-prazo-vencido','15 0 * * *',
  $$ SELECT public.resolver_desafios_equipe_prazo_vencido(); $$);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Permissões
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.vrenn_evaluate_meta(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vrenn_finalize_duel(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vrenn_evaluate_duel(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vrenn_settle_team_participant(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.vrenn_evaluate_team_participant(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.registrar_checkin_strava(uuid,text,uuid,text,timestamptz,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolver_duelos_prazo_vencido() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolver_desafio_equipe(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolver_desafios_equipe_prazo_vencido() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.processar_eliminacoes_diarias() FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_checkin_validado(text,uuid,text,text,numeric,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_checkin_arbitro(text,uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arbitro_declarar_resultado_duelo(uuid,uuid,boolean,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.registrar_checkin_strava(uuid,text,uuid,text,timestamptz,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vrenn_evaluate_meta(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vrenn_evaluate_duel(uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.vrenn_evaluate_team_participant(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_duelos_prazo_vencido() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_desafio_equipe(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_desafios_equipe_prazo_vencido() TO service_role;
GRANT EXECUTE ON FUNCTION public.processar_eliminacoes_diarias() TO service_role;

NOTIFY pgrst,'reload schema';


-- Ajuste final: evita referência a OLD durante INSERT.
CREATE OR REPLACE FUNCTION public.vrenn_after_validated_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.validado=true THEN
      IF NEW.meta_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_meta(NEW.meta_id);
      ELSIF NEW.duelo_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_duel(NEW.duelo_id,false); END IF;
      PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_validado',COALESCE(NEW.meta_id,NEW.duelo_id));
    END IF;
  ELSIF NEW.validado=true AND OLD.validado IS DISTINCT FROM true THEN
    IF NEW.meta_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_meta(NEW.meta_id);
    ELSIF NEW.duelo_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_duel(NEW.duelo_id,false); END IF;
    PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_validado',COALESCE(NEW.meta_id,NEW.duelo_id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_after_validated_team_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.validado=true THEN
      PERFORM public.vrenn_evaluate_team_participant(NEW.desafio_id,NEW.user_id,false);
      PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_desafio_validado',NEW.desafio_id);
    END IF;
  ELSIF NEW.validado=true AND OLD.validado IS DISTINCT FROM true THEN
    PERFORM public.vrenn_evaluate_team_participant(NEW.desafio_id,NEW.user_id,false);
    PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_desafio_validado',NEW.desafio_id);
  END IF;
  RETURN NEW;
END;
$$;
