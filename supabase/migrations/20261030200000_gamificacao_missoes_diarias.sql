-- Gamificacao, Onda 2, etapa 3: missoes diarias.
-- Em dia util, cada pessoa tem 3 missoes: mover um card de etapa (+2), comentar com 15+ caracteres (+2) e entregar um card (+4);
-- fazer as tres no mesmo dia rende +4 de "dia completo" (maximo 12 pts/dia). Os pontos entram so na temporada.
-- Tudo e calculado do historico real (sem tabela de estado e sem cron): a tela e a soma da temporada leem a mesma regra.
BEGIN;

CREATE OR REPLACE FUNCTION public._pontos_diarias(p_moveu boolean, p_comentou boolean, p_entregou boolean)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
SELECT (CASE WHEN p_moveu THEN 2 ELSE 0 END) + (CASE WHEN p_comentou THEN 2 ELSE 0 END) + (CASE WHEN p_entregou THEN 4 ELSE 0 END)
     + (CASE WHEN p_moveu AND p_comentou AND p_entregou THEN 4 ELSE 0 END)
$function$;
REVOKE ALL ON FUNCTION public._pontos_diarias(boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._pontos_diarias(boolean, boolean, boolean) TO authenticated, service_role;

-- o que cada pessoa fez em cada dia util do intervalo (datas de Sao Paulo)
CREATE OR REPLACE FUNCTION public._diarias_por_usuario(p_ws uuid, p_ini timestamptz, p_fim timestamptz)
RETURNS TABLE(user_id uuid, dia date, moveu boolean, comentou boolean, entregou boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH ev AS (
  SELECT h.triggered_by AS user_id, (h.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, 'm'::text AS k
  FROM card_stage_history h JOIN cards c ON c.id = h.card_id
  WHERE c.workspace_id = p_ws AND h.triggered_by IS NOT NULL AND h.created_at >= p_ini AND h.created_at < p_fim
  UNION ALL
  SELECT k.user_id, (k.created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'c'
  FROM comments k JOIN cards c ON c.id = k.card_id
  WHERE c.workspace_id = p_ws AND length(trim(coalesce(k.content, ''))) >= 15 AND k.created_at >= p_ini AND k.created_at < p_fim
  UNION ALL
  SELECT cm.user_id, (c.completed_at AT TIME ZONE 'America/Sao_Paulo')::date, 'e'
  FROM cards c JOIN card_members cm ON cm.card_id = c.id
  WHERE c.workspace_id = p_ws AND c.status IN ('delivered', 'approved', 'archived') AND c.completed_at >= p_ini AND c.completed_at < p_fim)
SELECT ev.user_id, ev.d, bool_or(ev.k = 'm'), bool_or(ev.k = 'c'), bool_or(ev.k = 'e')
FROM ev WHERE extract(isodow FROM ev.d) < 6 GROUP BY ev.user_id, ev.d
$function$;
REVOKE ALL ON FUNCTION public._diarias_por_usuario(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._diarias_por_usuario(uuid, timestamptz, timestamptz) TO service_role;

-- para a tela: o dia de hoje de quem esta logado, o acumulado do mes e quantos do time ja fecharam o dia
CREATE OR REPLACE FUNCTION public.get_missoes_diarias(p_workspace_id uuid)
RETURNS TABLE(dia date, fim_de_semana boolean, moveu boolean, comentou boolean, entregou boolean, pontos_hoje integer, pontos_max integer,
              dias_completos_mes integer, pontos_mes integer, equipe_completa integer, equipe_total integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ini timestamptz := (date_trunc('month', v_hoje::timestamp) AT TIME ZONE 'America/Sao_Paulo');
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  WITH d AS (SELECT * FROM public._diarias_por_usuario(p_workspace_id, v_ini, v_ini + interval '1 month')),
  ativos AS (
    SELECT wm.user_id FROM workspace_members wm
    LEFT JOIN people_ranking_participation pr ON pr.workspace_id = p_workspace_id AND pr.user_id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id AND wm.is_active AND coalesce(pr.included, true)),
  eu AS (SELECT * FROM d WHERE d.user_id = auth.uid() AND d.dia = v_hoje)
  SELECT v_hoje, extract(isodow FROM v_hoje) >= 6,
         coalesce((SELECT eu.moveu FROM eu), false), coalesce((SELECT eu.comentou FROM eu), false), coalesce((SELECT eu.entregou FROM eu), false),
         coalesce((SELECT public._pontos_diarias(eu.moveu, eu.comentou, eu.entregou) FROM eu), 0),
         public._pontos_diarias(true, true, true),
         (SELECT count(*)::int FROM d WHERE d.user_id = auth.uid() AND d.moveu AND d.comentou AND d.entregou),
         coalesce((SELECT sum(public._pontos_diarias(d.moveu, d.comentou, d.entregou))::int FROM d WHERE d.user_id = auth.uid()), 0),
         (SELECT count(*)::int FROM d JOIN ativos a ON a.user_id = d.user_id WHERE d.dia = v_hoje AND d.moveu AND d.comentou AND d.entregou),
         (SELECT count(*)::int FROM ativos);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_missoes_diarias(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_missoes_diarias(uuid) TO authenticated, service_role;

-- pontos das missoes diarias entram na temporada do mes (mesma assinatura; so a soma muda)
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
  GROUP BY x.user_id),
mis AS (
  SELECT cr.user_id, sum(cr.pontos)::int AS pts FROM missao_creditos cr JOIN missoes ms ON ms.id = cr.missao_id CROSS JOIN ini
  WHERE ms.workspace_id = p_ws AND cr.creditado_em >= ini.t AND cr.creditado_em < (ini.t + interval '1 month')
  GROUP BY cr.user_id),
dia AS (
  SELECT d.user_id, sum(public._pontos_diarias(d.moveu, d.comentou, d.entregou))::int AS pts
  FROM ini CROSS JOIN LATERAL public._diarias_por_usuario(p_ws, ini.t, ini.t + interval '1 month') d
  GROUP BY d.user_id)
SELECT s.user_id, coalesce(pf.full_name, pf.email), pf.avatar_url, coalesce(pr.included, true),
       s.entregas, s.entregas_pond, s.comentarios, coalesce(m.mov_valida, 0), s.dias_acao, s.horas,
       round(s.entregas_pond * 20 + s.comentarios * 3 + coalesce(m.mov_valida, 0) * 2 + s.dias_acao * 5 + floor(s.horas) * 5 + coalesce(mi.pts, 0) + coalesce(di.pts, 0))::int
FROM sig s
JOIN workspace_members wm ON wm.workspace_id = p_ws AND wm.user_id = s.user_id AND wm.is_active
LEFT JOIN profiles pf ON pf.id = s.user_id
LEFT JOIN people_ranking_participation pr ON pr.workspace_id = p_ws AND pr.user_id = s.user_id
LEFT JOIN mov m ON m.user_id = s.user_id
LEFT JOIN mis mi ON mi.user_id = s.user_id
LEFT JOIN dia di ON di.user_id = s.user_id;
$function$;
REVOKE ALL ON FUNCTION public._pontos_temporada(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._pontos_temporada(uuid, date) TO service_role;

COMMIT;
