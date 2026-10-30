-- Gamificacao, Onda 1 (30/10/2026):
-- 1) team_goals: meta do time por semana (calculada dos cards pela MESMA regra do ranking), com recompensa em texto livre
-- 2) get_meta_do_time / get_historico_entregas_semanais: leitura para a tela (com checagem de membro)
-- 3) gamificacao_avisos_diarios: aviso de subida/queda no ranking (comparando o snapshot de hoje com o de ontem)
-- 4) gamificacao_fechamento_semana: MVP da semana + posicao de cada um + meta do time
-- 5) agendamentos no pg_cron (sem chave embutida: chamam funcoes SQL)
BEGIN;

CREATE TABLE IF NOT EXISTS public.team_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entregas', 'entregas_no_prazo')),
  alvo integer NOT NULL CHECK (alvo BETWEEN 1 AND 1000),
  titulo text NOT NULL,
  recompensa text,
  ativa boolean NOT NULL DEFAULT true,
  celebrada_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, week_start, tipo)
);
ALTER TABLE public.team_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tg_select ON public.team_goals;
DROP POLICY IF EXISTS tg_write ON public.team_goals;
CREATE POLICY tg_select ON public.team_goals FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY tg_write ON public.team_goals FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id))
  WITH CHECK (public.has_admin_access(auth.uid(), workspace_id));
REVOKE ALL ON public.team_goals FROM anon;

-- progresso de uma meta: cards ENTREGUES na semana (por card, nao por responsavel), mesma regra de status e de prazo do ranking
CREATE OR REPLACE FUNCTION public._progresso_meta_do_time(p_ws uuid, p_ini date, p_tipo text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
SELECT count(*)::int FROM cards c
WHERE c.workspace_id = p_ws
  AND c.status IN ('delivered', 'approved', 'archived')
  AND c.completed_at IS NOT NULL
  AND (c.completed_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_ini
  AND (c.completed_at AT TIME ZONE 'America/Sao_Paulo')::date < p_ini + 7
  AND (p_tipo = 'entregas' OR c.due_date IS NULL OR c.completed_at <= c.due_date);
$function$;
REVOKE ALL ON FUNCTION public._progresso_meta_do_time(uuid, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._progresso_meta_do_time(uuid, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_meta_do_time(p_workspace_id uuid, p_week_start date DEFAULT NULL)
RETURNS TABLE(id uuid, tipo text, titulo text, alvo integer, atual integer, recompensa text, atingida boolean, week_start date, celebrada_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ini date := coalesce(p_week_start, date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date);
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
  SELECT x.id, x.tipo, x.titulo, x.alvo, x.atual, x.recompensa, (x.atual >= x.alvo), x.week_start, x.celebrada_em
  FROM (
    SELECT g.id, g.tipo, g.titulo, g.alvo, g.recompensa, g.week_start, g.celebrada_em,
           public._progresso_meta_do_time(p_workspace_id, v_ini, g.tipo) AS atual
    FROM team_goals g
    WHERE g.workspace_id = p_workspace_id AND g.week_start = v_ini AND g.ativa
  ) x
  ORDER BY x.tipo;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_meta_do_time(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meta_do_time(uuid, date) TO authenticated, service_role;

-- historico semanal (para escolher uma meta realista): entregas e entregas no prazo das ultimas N semanas, a atual inclusa
CREATE OR REPLACE FUNCTION public.get_historico_entregas_semanais(p_workspace_id uuid, p_semanas integer DEFAULT 6)
RETURNS TABLE(semana_inicio date, entregas integer, no_prazo integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_atual date := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
  SELECT s.d::date,
         public._progresso_meta_do_time(p_workspace_id, s.d::date, 'entregas'),
         public._progresso_meta_do_time(p_workspace_id, s.d::date, 'entregas_no_prazo')
  FROM generate_series(v_atual - 7 * (greatest(1, least(coalesce(p_semanas, 6), 26)) - 1), v_atual, interval '7 days') AS s(d)
  ORDER BY 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_historico_entregas_semanais(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_historico_entregas_semanais(uuid, integer) TO authenticated, service_role;

-- notifica todos os membros ativos quando uma meta do time e batida (uma vez por meta)
CREATE OR REPLACE FUNCTION public._celebrar_metas_do_time(p_ws uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE g record; v_ini date := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date; v_atual int; v_n int := 0;
BEGIN
  FOR g IN SELECT * FROM team_goals WHERE workspace_id = p_ws AND week_start = v_ini AND ativa AND celebrada_em IS NULL LOOP
    v_atual := public._progresso_meta_do_time(p_ws, v_ini, g.tipo);
    IF v_atual >= g.alvo THEN
      INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
      SELECT wm.user_id, p_ws, 'team_goal', 'Meta do time batida!',
             g.titulo || ' (' || v_atual || ' de ' || g.alvo || ').' || CASE WHEN coalesce(trim(g.recompensa), '') <> '' THEN ' Recompensa: ' || g.recompensa || '.' ELSE '' END,
             jsonb_build_object('route', '/gamification', 'goal_id', g.id)
      FROM workspace_members wm WHERE wm.workspace_id = p_ws AND wm.is_active;
      UPDATE team_goals SET celebrada_em = now() WHERE id = g.id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public._celebrar_metas_do_time(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._celebrar_metas_do_time(uuid) TO service_role;

-- aviso de subida/queda: compara o snapshot de hoje com o do ultimo dia anterior, so entre membros ativos que participam
CREATE OR REPLACE FUNCTION public.gamificacao_avisos_diarios()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w record; m record; v_dia_ant date; v_n int := 0; v_vizinho record; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  FOR w IN SELECT id FROM workspaces LOOP
    SELECT max(recorded_at) INTO v_dia_ant FROM ranking_history WHERE workspace_id = w.id AND recorded_at < current_date;
    IF v_dia_ant IS NOT NULL AND EXISTS (SELECT 1 FROM ranking_history WHERE workspace_id = w.id AND recorded_at = current_date) THEN
      FOR m IN
        WITH ativos AS (SELECT user_id FROM workspace_members WHERE workspace_id = w.id AND is_active),
        hoje AS (
          SELECT rh.user_id, rh.score, rank() OVER (ORDER BY rh.score DESC, rh.cards_completed DESC, rh.user_id) r
          FROM ranking_history rh JOIN ativos USING (user_id)
          WHERE rh.workspace_id = w.id AND rh.recorded_at = current_date AND rh.score > 0),
        ontem AS (
          SELECT rh.user_id, rank() OVER (ORDER BY rh.score DESC, rh.cards_completed DESC, rh.user_id) r
          FROM ranking_history rh JOIN ativos USING (user_id)
          WHERE rh.workspace_id = w.id AND rh.recorded_at = v_dia_ant AND rh.score > 0)
        SELECT h.user_id, h.score, h.r AS r_hoje, o.r AS r_ontem FROM hoje h JOIN ontem o USING (user_id) WHERE h.r <> o.r
      LOOP
        CONTINUE WHEN EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = m.user_id AND n.type = 'ranking_change' AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje);
        -- vizinho que importa: quem esta logo a frente (se caiu) ou logo atras (se subiu), no ranking de hoje
        SELECT pf.full_name AS nome, v.score INTO v_vizinho
        FROM (
          SELECT rh.user_id, rh.score, rank() OVER (ORDER BY rh.score DESC, rh.cards_completed DESC, rh.user_id) r
          FROM ranking_history rh JOIN workspace_members wm ON wm.workspace_id = rh.workspace_id AND wm.user_id = rh.user_id AND wm.is_active
          WHERE rh.workspace_id = w.id AND rh.recorded_at = current_date AND rh.score > 0) v
        JOIN profiles pf ON pf.id = v.user_id
        WHERE v.r = CASE WHEN m.r_hoje > m.r_ontem THEN m.r_hoje - 1 ELSE m.r_hoje + 1 END
        LIMIT 1;
        INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
        VALUES (m.user_id, w.id, 'ranking_change',
          CASE WHEN m.r_hoje < m.r_ontem THEN 'Você subiu no ranking' ELSE 'Você caiu no ranking' END,
          CASE WHEN m.r_hoje < m.r_ontem
            THEN 'Agora você é o ' || m.r_hoje || 'º do mês.' || CASE WHEN v_vizinho.nome IS NOT NULL THEN ' ' || split_part(v_vizinho.nome, ' ', 1) || ' está logo atrás, a ' || round(m.score - v_vizinho.score) || ' pts.' ELSE '' END
            ELSE 'Agora você é o ' || m.r_hoje || 'º do mês.' || CASE WHEN v_vizinho.nome IS NOT NULL THEN ' ' || split_part(v_vizinho.nome, ' ', 1) || ' está à frente por ' || round(v_vizinho.score - m.score) || ' pts.' ELSE '' END END,
          jsonb_build_object('route', '/gamification', 'de', m.r_ontem, 'para', m.r_hoje));
        v_n := v_n + 1;
      END LOOP;
    END IF;
    PERFORM public._celebrar_metas_do_time(w.id);
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gamificacao_avisos_diarios() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacao_avisos_diarios() TO service_role;

-- fechamento da semana (sexta): MVP, posicao de cada um e meta do time
CREATE OR REPLACE FUNCTION public.gamificacao_fechamento_semana()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w record; v_mvp record; r record; v_n int := 0; v_ini date := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date; v_meta text; g record; v_prog int;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _fech (user_id uuid, nome text, score numeric, pos int) ON COMMIT DROP;
  FOR w IN SELECT id FROM workspaces LOOP
    PERFORM public._celebrar_metas_do_time(w.id);
    TRUNCATE _fech;
    INSERT INTO _fech
      SELECT s.user_id, coalesce(pf.full_name, pf.email), s.score,
             (rank() OVER (ORDER BY s.score DESC, s.entregas DESC, s.user_id))::int
      FROM public._people_scores(w.id, 7) s
      JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = s.user_id AND wm.is_active
      JOIN profiles pf ON pf.id = s.user_id
      WHERE s.participa AND s.score > 0;
    SELECT * INTO v_mvp FROM _fech WHERE pos = 1 LIMIT 1;
    CONTINUE WHEN v_mvp.user_id IS NULL;
    v_meta := '';
    FOR g IN SELECT * FROM team_goals WHERE workspace_id = w.id AND week_start = v_ini AND ativa ORDER BY tipo LOOP
      v_prog := public._progresso_meta_do_time(w.id, v_ini, g.tipo);
      v_meta := v_meta || ' Meta do time: ' || v_prog || ' de ' || g.alvo || CASE WHEN v_prog >= g.alvo THEN ' (batida!).' ELSE ' (faltaram ' || (g.alvo - v_prog) || ').' END;
    END LOOP;
    FOR r IN SELECT wm.user_id, f.pos, f.score FROM workspace_members wm LEFT JOIN _fech f ON f.user_id = wm.user_id WHERE wm.workspace_id = w.id AND wm.is_active LOOP
      INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
      VALUES (r.user_id, w.id, 'weekly_mvp',
        CASE WHEN r.user_id = v_mvp.user_id THEN 'Você foi o MVP da semana!' ELSE 'Fechamento da semana' END,
        'MVP: ' || split_part(v_mvp.nome, ' ', 1) || ' (' || round(v_mvp.score) || ' pts).'
          || CASE WHEN r.pos IS NOT NULL AND r.user_id <> v_mvp.user_id THEN ' Você ficou em ' || r.pos || 'º com ' || round(r.score) || ' pts.' ELSE '' END
          || v_meta,
        jsonb_build_object('route', '/gamification', 'mvp', v_mvp.user_id));
      v_n := v_n + 1;
    END LOOP;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gamificacao_fechamento_semana() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacao_fechamento_semana() TO service_role;

-- agendamentos (11:00 UTC = 08:00 de Brasilia, dias uteis; fechamento sexta 20:00 UTC = 17:00)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('gamificacao-avisos', 'gamificacao-fechamento');
SELECT cron.schedule('gamificacao-avisos', '0 11 * * 1-5', 'select public.gamificacao_avisos_diarios()');
SELECT cron.schedule('gamificacao-fechamento', '0 20 * * 5', 'select public.gamificacao_fechamento_semana()');

COMMIT;
