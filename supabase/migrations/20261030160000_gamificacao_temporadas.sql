-- Gamificacao, Onda 2, etapa 1 (30/10/2026): TEMPORADAS mensais + HALL DA FAMA.
-- Temporada = campeonato do mes de calendario (fuso de Sao Paulo), com PONTOS SEM TETO que zeram todo dia 1o.
-- O XP vitalicio e o nivel NAO mudam. So conta como "oficial" (e vale troféu) o mes que tem linha em `temporadas`.
-- Pontos: entrega ponderada pelo prazo x20, comentario x3, movimentacao x2 (maximo 8 por dia, anti-abuso), dia util com acao x5, hora x5.
BEGIN;

CREATE TABLE IF NOT EXISTS public.temporadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  mes date NOT NULL CHECK (extract(day FROM mes) = 1),
  premio text,
  encerrada_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, mes)
);
CREATE TABLE IF NOT EXISTS public.temporada_resultados (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  mes date NOT NULL,
  user_id uuid NOT NULL,
  posicao integer NOT NULL,
  pontos integer NOT NULL,
  entregas integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, mes, user_id)
);
ALTER TABLE public.temporadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporada_resultados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tp_select ON public.temporadas;
DROP POLICY IF EXISTS tp_write ON public.temporadas;
DROP POLICY IF EXISTS tr_select ON public.temporada_resultados;
CREATE POLICY tp_select ON public.temporadas FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY tp_write ON public.temporadas FOR ALL USING (public.has_admin_access(auth.uid(), workspace_id)) WITH CHECK (public.has_admin_access(auth.uid(), workspace_id));
CREATE POLICY tr_select ON public.temporada_resultados FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
REVOKE ALL ON public.temporadas FROM anon;
REVOKE ALL ON public.temporada_resultados FROM anon;
-- resultados so sao gravados pelas funcoes do servidor (nao ha politica de escrita para usuarios)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temporadas TO authenticated, service_role;
GRANT SELECT ON public.temporada_resultados TO authenticated;
GRANT ALL ON public.temporada_resultados TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.temporada_resultados FROM authenticated;

-- pontos de uma temporada EM ANDAMENTO (desde o 1o dia do mes; nao serve para mes ja encerrado: para esses vale o resultado gravado)
CREATE OR REPLACE FUNCTION public._pontos_temporada(p_ws uuid, p_mes date)
RETURNS TABLE(user_id uuid, nome text, avatar_url text, participa boolean, entregas integer, entregas_pond numeric, comentarios integer, movimentacoes integer, dias_acao integer, horas numeric, pontos integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH ini AS (SELECT ((p_mes::timestamp) AT TIME ZONE 'America/Sao_Paulo') AS t),
sig AS (SELECT s.* FROM ini CROSS JOIN LATERAL public._people_signals(p_ws, ini.t, 0.7) s),
mov AS (
  SELECT x.user_id, sum(least(x.n, 8))::int AS mov_valida FROM (
    SELECT h.triggered_by AS user_id, (h.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, count(*) AS n
    FROM card_stage_history h JOIN cards c ON c.id = h.card_id CROSS JOIN ini
    WHERE c.workspace_id = p_ws AND h.triggered_by IS NOT NULL AND h.created_at >= ini.t
    GROUP BY 1, 2) x
  GROUP BY x.user_id)
SELECT s.user_id, coalesce(pf.full_name, pf.email), pf.avatar_url, coalesce(pr.included, true),
       s.entregas, s.entregas_pond, s.comentarios, coalesce(m.mov_valida, 0), s.dias_acao, s.horas,
       round(s.entregas_pond * 20 + s.comentarios * 3 + coalesce(m.mov_valida, 0) * 2 + s.dias_acao * 5 + floor(s.horas) * 5)::int
FROM sig s
JOIN workspace_members wm ON wm.workspace_id = p_ws AND wm.user_id = s.user_id AND wm.is_active
LEFT JOIN profiles pf ON pf.id = s.user_id
LEFT JOIN people_ranking_participation pr ON pr.workspace_id = p_ws AND pr.user_id = s.user_id
LEFT JOIN mov m ON m.user_id = s.user_id;
$function$;
REVOKE ALL ON FUNCTION public._pontos_temporada(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._pontos_temporada(uuid, date) TO service_role;

-- classificacao da temporada para a tela (a corrente ao vivo; uma encerrada, do resultado gravado)
CREATE OR REPLACE FUNCTION public.get_temporada(p_workspace_id uuid, p_mes date DEFAULT NULL)
RETURNS TABLE(mes date, oficial boolean, encerrada boolean, premio text, user_id uuid, nome text, avatar_url text, posicao integer, pontos integer, entregas integer, comentarios integer, movimentacoes integer, dias_acao integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_mes date := coalesce(date_trunc('month', p_mes::timestamp)::date, date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date); v_t record;
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO v_t FROM temporadas WHERE workspace_id = p_workspace_id AND temporadas.mes = v_mes;
  IF v_t.encerrada_em IS NOT NULL THEN
    RETURN QUERY
    SELECT v_mes, true, true, v_t.premio, r.user_id, coalesce(pf.full_name, pf.email), pf.avatar_url, r.posicao, r.pontos, r.entregas, 0, 0, 0
    FROM temporada_resultados r LEFT JOIN profiles pf ON pf.id = r.user_id
    WHERE r.workspace_id = p_workspace_id AND r.mes = v_mes ORDER BY r.posicao;
  ELSE
    RETURN QUERY
    SELECT v_mes, (v_t.id IS NOT NULL), false, v_t.premio, q.user_id, q.nome, q.avatar_url,
           (rank() OVER (ORDER BY q.pontos DESC, q.entregas DESC, q.user_id))::int, q.pontos, q.entregas, q.comentarios, q.movimentacoes, q.dias_acao
    FROM public._pontos_temporada(p_workspace_id, v_mes) q WHERE q.participa
    ORDER BY 8, 5;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_temporada(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_temporada(uuid, date) TO authenticated, service_role;

-- Hall da Fama: podio (1o a 3o) de cada temporada oficial encerrada
CREATE OR REPLACE FUNCTION public.get_hall_da_fama(p_workspace_id uuid)
RETURNS TABLE(mes date, premio text, user_id uuid, nome text, avatar_url text, posicao integer, pontos integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT t.mes, t.premio, r.user_id, coalesce(pf.full_name, pf.email), pf.avatar_url, r.posicao, r.pontos
  FROM temporadas t JOIN temporada_resultados r ON r.workspace_id = t.workspace_id AND r.mes = t.mes AND r.posicao <= 3
  LEFT JOIN profiles pf ON pf.id = r.user_id
  WHERE t.workspace_id = p_workspace_id AND t.encerrada_em IS NOT NULL
  ORDER BY t.mes DESC, r.posicao;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_hall_da_fama(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hall_da_fama(uuid) TO authenticated, service_role;

-- virada do mes (dia 1o, 00:05 de Brasilia): encerra a temporada do mes anterior (se oficial), avisa todos e abre a do mes novo.
-- p_hoje existe so para teste; o agendamento chama sem argumento.
CREATE OR REPLACE FUNCTION public.gamificacao_virada_de_temporada(p_hoje date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := coalesce(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_mes_novo date := date_trunc('month', v_hoje::timestamp)::date;
  v_mes_ant date := (date_trunc('month', v_hoje::timestamp) - interval '1 month')::date;
  t record; v_n int := 0; v_c record; v_2 record; v_3 record; v_nome_mes text; v_msg text;
  v_meses text[] := ARRAY['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
BEGIN
  FOR t IN SELECT * FROM temporadas WHERE mes = v_mes_ant AND encerrada_em IS NULL LOOP
    INSERT INTO temporada_resultados (workspace_id, mes, user_id, posicao, pontos, entregas)
    SELECT t.workspace_id, t.mes, q.user_id,
           (rank() OVER (ORDER BY q.pontos DESC, q.entregas DESC, q.user_id))::int, q.pontos, q.entregas
    FROM public._pontos_temporada(t.workspace_id, t.mes) q WHERE q.participa AND q.pontos > 0
    ON CONFLICT DO NOTHING;
    UPDATE temporadas SET encerrada_em = now() WHERE id = t.id;
    SELECT r.user_id, coalesce(pf.full_name, pf.email) AS nome, r.pontos INTO v_c FROM temporada_resultados r LEFT JOIN profiles pf ON pf.id = r.user_id WHERE r.workspace_id = t.workspace_id AND r.mes = t.mes AND r.posicao = 1 LIMIT 1;
    SELECT coalesce(pf.full_name, pf.email) AS nome, r.pontos INTO v_2 FROM temporada_resultados r LEFT JOIN profiles pf ON pf.id = r.user_id WHERE r.workspace_id = t.workspace_id AND r.mes = t.mes AND r.posicao = 2 LIMIT 1;
    SELECT coalesce(pf.full_name, pf.email) AS nome, r.pontos INTO v_3 FROM temporada_resultados r LEFT JOIN profiles pf ON pf.id = r.user_id WHERE r.workspace_id = t.workspace_id AND r.mes = t.mes AND r.posicao = 3 LIMIT 1;
    v_nome_mes := v_meses[extract(month FROM t.mes)::int];
    IF v_c.user_id IS NOT NULL THEN
      v_msg := 'Campeão: ' || split_part(v_c.nome, ' ', 1) || ' (' || v_c.pontos || ' pts).'
        || CASE WHEN v_2.nome IS NOT NULL THEN ' 2º: ' || split_part(v_2.nome, ' ', 1) || ' (' || v_2.pontos || ').' ELSE '' END
        || CASE WHEN v_3.nome IS NOT NULL THEN ' 3º: ' || split_part(v_3.nome, ' ', 1) || ' (' || v_3.pontos || ').' ELSE '' END
        || CASE WHEN coalesce(trim(t.premio), '') <> '' THEN ' Prêmio: ' || t.premio || '.' ELSE '' END;
      INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
      SELECT wm.user_id, t.workspace_id, 'season_end', 'Temporada de ' || v_nome_mes || ' encerrada', v_msg,
             jsonb_build_object('route', '/gamification?aba=temporada', 'mes', t.mes)
      FROM workspace_members wm WHERE wm.workspace_id = t.workspace_id AND wm.is_active;
      v_n := v_n + 1;
    END IF;
    -- abre a proxima temporada do mesmo workspace
    INSERT INTO temporadas (workspace_id, mes) VALUES (t.workspace_id, v_mes_novo) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gamificacao_virada_de_temporada(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacao_virada_de_temporada(date) TO service_role;

-- primeira temporada OFICIAL: novembro de 2026, para quem ja usa a gamificacao (tem historico de ranking). Outubro fica como ensaio.
INSERT INTO public.temporadas (workspace_id, mes)
SELECT DISTINCT rh.workspace_id, date '2026-11-01' FROM public.ranking_history rh
ON CONFLICT DO NOTHING;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gamificacao-virada-temporada';
SELECT cron.schedule('gamificacao-virada-temporada', '5 3 1 * *', 'select public.gamificacao_virada_de_temporada()');

COMMIT;
