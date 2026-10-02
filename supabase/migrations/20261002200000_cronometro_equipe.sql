BEGIN;

-- Encerra um lancamento de tempo e recalcula as horas do card.
CREATE OR REPLACE FUNCTION public._time_entry_close(p_id uuid, p_end timestamptz, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_card uuid;
BEGIN
  UPDATE time_entries
     SET is_running = false,
         ended_at = p_end,
         duration_seconds = greatest(0, floor(extract(epoch FROM (p_end - started_at)))::int),
         notes = CASE WHEN p_note IS NULL THEN notes
                      WHEN notes IS NULL OR notes = '' THEN p_note
                      ELSE notes || ' | ' || p_note END
   WHERE id = p_id AND is_running
   RETURNING card_id INTO v_card;

  IF v_card IS NOT NULL THEN
    UPDATE cards
       SET actual_hours = round(coalesce((SELECT sum(duration_seconds) FROM time_entries
                                          WHERE card_id = v_card AND NOT is_running), 0) / 3600.0, 2)
     WHERE id = v_card;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._time_entry_close(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;

-- Um cronometro ativo por pessoa: ao iniciar outro, o anterior e encerrado com o tempo correto.
-- Antes a pessoa podia deixar varios rodando ao mesmo tempo (um por card) e o tempo era contado em dobro.
CREATE OR REPLACE FUNCTION public.trg_time_entry_one_running()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  IF NEW.is_running THEN
    FOR r IN SELECT id FROM time_entries
             WHERE user_id = NEW.user_id AND is_running AND id IS DISTINCT FROM NEW.id
    LOOP
      PERFORM public._time_entry_close(r.id, now(), 'encerrado ao iniciar outro cronômetro');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_time_entry_one_running ON public.time_entries;
CREATE TRIGGER trg_time_entry_one_running
  BEFORE INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_time_entry_one_running();

-- Cronometro esquecido ligado: encerra com limite de 10 horas e deixa o aviso na anotacao.
CREATE OR REPLACE FUNCTION public.time_entries_autostop(p_limite_horas int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id, started_at FROM time_entries
           WHERE is_running AND started_at < now() - make_interval(hours => p_limite_horas)
  LOOP
    PERFORM public._time_entry_close(r.id, r.started_at + make_interval(hours => p_limite_horas),
      'encerrado automaticamente: ficou ligado por mais de ' || p_limite_horas || 'h');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.time_entries_autostop(int) FROM PUBLIC, anon, authenticated;

COMMIT;

SELECT cron.schedule('time-entries-autostop', '*/15 * * * *', 'select public.time_entries_autostop()');
