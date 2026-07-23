-- ═══════════════════════════════════════════════════════════════════
-- VRENN — Sistema de árbitro de duelo + resolução automática
-- ═══════════════════════════════════════════════════════════════════

-- 1. Adicionar arbitro_id na tabela duelos
ALTER TABLE public.duelos
  ADD COLUMN IF NOT EXISTS arbitro_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arbitro_status text DEFAULT NULL
    CHECK (arbitro_status IN ('pendente','aceito','recusado'));

COMMENT ON COLUMN public.duelos.arbitro_id IS
  'Árbitro do duelo — só usado quando tipo_validacao = foto_arbitro';
COMMENT ON COLUMN public.duelos.arbitro_status IS
  'Status do convite do árbitro: pendente / aceito / recusado';

-- 2. Função: convidar árbitro para duelo
CREATE OR REPLACE FUNCTION public.convidar_arbitro_duelo(
  _duelo_id   uuid,
  _arbitro_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duelo public.duelos;
BEGIN
  SELECT * INTO _duelo FROM public.duelos WHERE id = _duelo_id;
  IF _duelo.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _duelo.challenger_id != auth.uid() THEN RAISE EXCEPTION 'apenas o criador pode convidar árbitro'; END IF;
  IF _duelo.tipo_validacao != 'foto_arbitro' THEN RAISE EXCEPTION 'este duelo não usa árbitro'; END IF;
  IF _arbitro_id = _duelo.challenger_id OR _arbitro_id = _duelo.opponent_id THEN
    RAISE EXCEPTION 'árbitro não pode ser participante do duelo';
  END IF;

  UPDATE public.duelos
    SET arbitro_id = _arbitro_id, arbitro_status = 'pendente'
  WHERE id = _duelo_id;

  PERFORM public.notify(
    _arbitro_id,
    'convite_arbitro',
    'Você foi convidado para ser árbitro de um duelo no VRENN. Aceite para acompanhar e declarar o resultado.',
    _duelo_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.convidar_arbitro_duelo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convidar_arbitro_duelo(uuid, uuid) TO authenticated;

-- 3. Função: árbitro responde convite
CREATE OR REPLACE FUNCTION public.responder_convite_arbitro_duelo(
  _duelo_id uuid,
  _aceitar  boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duelo public.duelos;
BEGIN
  SELECT * INTO _duelo FROM public.duelos WHERE id = _duelo_id;
  IF _duelo.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _duelo.arbitro_id != auth.uid() THEN RAISE EXCEPTION 'você não é o árbitro deste duelo'; END IF;

  UPDATE public.duelos
    SET arbitro_status = CASE WHEN _aceitar THEN 'aceito' ELSE 'recusado' END
  WHERE id = _duelo_id;

  -- Notificar challenger
  PERFORM public.notify(
    _duelo.challenger_id,
    'arbitro_aceitou',
    CASE WHEN _aceitar
      THEN 'Seu árbitro aceitou o convite! O duelo agora tem um árbitro oficial.'
      ELSE 'Seu árbitro recusou o convite. Convide outro árbitro para o duelo.'
    END,
    _duelo_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.responder_convite_arbitro_duelo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_convite_arbitro_duelo(uuid, boolean) TO authenticated;

-- 4. Função: árbitro declara resultado do duelo
CREATE OR REPLACE FUNCTION public.arbitro_declarar_resultado_duelo(
  _duelo_id  uuid,
  _winner_id uuid,   -- NULL se empate
  _empate    boolean DEFAULT false,
  _sucesso   boolean DEFAULT false  -- true = empate com ambos completando
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duelo public.duelos;
BEGIN
  SELECT * INTO _duelo FROM public.duelos WHERE id = _duelo_id;
  IF _duelo.id IS NULL THEN RAISE EXCEPTION 'duelo não encontrado'; END IF;
  IF _duelo.status = 'concluido' THEN RAISE EXCEPTION 'duelo já foi encerrado'; END IF;

  -- Verificar se é o árbitro aceito OU o pg_cron (service_role)
  IF auth.uid() IS NOT NULL AND _duelo.arbitro_id != auth.uid() THEN
    RAISE EXCEPTION 'apenas o árbitro aceito pode declarar o resultado';
  END IF;
  IF NOT _empate AND _duelo.arbitro_status != 'aceito' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'árbitro ainda não aceitou o convite';
  END IF;

  -- Chamar resolução financeira
  PERFORM public.resolve_duelo_custodia(
    _duelo_id  := _duelo_id,
    _winner_id := _winner_id,
    _empate    := _empate,
    _sucesso   := _sucesso
  );

  -- Notificar ambos os participantes
  PERFORM public.notify(
    _duelo.challenger_id,
    'desafio_duelo',
    CASE
      WHEN _empate AND _sucesso     THEN 'Empate! Ambos completaram o objetivo. Custódias devolvidas. ✨'
      WHEN _empate AND NOT _sucesso THEN 'Duelo encerrado sem sucesso para nenhum dos dois.'
      WHEN _winner_id = _duelo.challenger_id THEN 'Você venceu o duelo! Parabéns 🏆 Prêmio liberado.'
      ELSE 'Você perdeu o duelo. O rival foi declarado vencedor pelo árbitro.'
    END,
    _duelo_id
  );

  PERFORM public.notify(
    _duelo.opponent_id,
    'desafio_duelo',
    CASE
      WHEN _empate AND _sucesso     THEN 'Empate! Ambos completaram o objetivo. Custódias devolvidas. ✨'
      WHEN _empate AND NOT _sucesso THEN 'Duelo encerrado sem sucesso para nenhum dos dois.'
      WHEN _winner_id = _duelo.opponent_id THEN 'Você venceu o duelo! Parabéns 🏆 Prêmio liberado.'
      ELSE 'Você perdeu o duelo. O rival foi declarado vencedor pelo árbitro.'
    END,
    _duelo_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.arbitro_declarar_resultado_duelo(uuid, uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arbitro_declarar_resultado_duelo(uuid, uuid, boolean, boolean) TO authenticated, service_role;

-- 5. Resolução automática via pg_cron para duelos QR/geo cujo prazo venceu
CREATE OR REPLACE FUNCTION public.resolver_duelos_prazo_vencido()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duelo public.duelos;
BEGIN
  FOR _duelo IN
    SELECT * FROM public.duelos
    WHERE status = 'ativo'
      AND prazo IS NOT NULL
      AND prazo < now()
      AND tipo_validacao IN ('qrcode', 'geolocalizacao')
      -- Não tem árbitro = resolução automática por progresso
  LOOP
    DECLARE
      _winner_id uuid := NULL;
      _empate    boolean := false;
      _sucesso   boolean := false;
      _ch_prog   int := COALESCE(_duelo.progresso_challenger, 0);
      _op_prog   int := COALESCE(_duelo.progresso_opponent, 0);
    BEGIN
      IF _ch_prog >= 100 AND _op_prog >= 100 THEN
        _empate  := true;
        _sucesso := true;
      ELSIF _ch_prog < 100 AND _op_prog < 100 THEN
        _empate  := true;
        _sucesso := false;
      ELSIF _ch_prog >= 100 THEN
        _winner_id := _duelo.challenger_id;
      ELSE
        _winner_id := _duelo.opponent_id;
      END IF;

      -- Também verifica eliminação
      IF _duelo.challenger_eliminado AND NOT _duelo.opponent_eliminado THEN
        _winner_id := _duelo.opponent_id;
        _empate    := false;
      ELSIF _duelo.opponent_eliminado AND NOT _duelo.challenger_eliminado THEN
        _winner_id := _duelo.challenger_id;
        _empate    := false;
      ELSIF _duelo.challenger_eliminado AND _duelo.opponent_eliminado THEN
        _empate    := true;
        _sucesso   := false;
      END IF;

      PERFORM public.resolve_duelo_custodia(
        _duelo_id  := _duelo.id,
        _winner_id := _winner_id,
        _empate    := _empate,
        _sucesso   := _sucesso
      );

      PERFORM public.notify(
        _duelo.challenger_id, 'desafio_duelo',
        'Seu duelo foi encerrado automaticamente. Confira o resultado e as custódias.',
        _duelo.id
      );
      PERFORM public.notify(
        _duelo.opponent_id, 'desafio_duelo',
        'Seu duelo foi encerrado automaticamente. Confira o resultado e as custódias.',
        _duelo.id
      );

    EXCEPTION WHEN OTHERS THEN
      -- Não travar o loop se um duelo falhar
      RAISE WARNING 'Erro ao resolver duelo %: %', _duelo.id, SQLERRM;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.resolver_duelos_prazo_vencido() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_duelos_prazo_vencido() TO service_role;

-- 6. Agendar cron às 00:10 (após eliminações das 00:05)
SELECT cron.unschedule('vrenn-duelos-prazo-vencido') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'vrenn-duelos-prazo-vencido'
);
SELECT cron.schedule(
  'vrenn-duelos-prazo-vencido',
  '10 0 * * *',
  $$ SELECT public.resolver_duelos_prazo_vencido(); $$
);

NOTIFY pgrst, 'reload schema';
