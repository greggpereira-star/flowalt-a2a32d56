-- Pontuacao do ranking (29/10/2026):
-- 1) "Dia ativo" da constancia passa a contar so DIAS UTEIS com uma ACAO (comentar, mover card, criar card, entregar card ou
--    lancar horas). Abrir um modulo (module_usage), editar qualquer coisa (audit_logs em geral) e fim de semana deixam de contar.
--    O mesmo criterio vale para a sequencia de dias uteis seguidos.
--    O XP vitalicio NAO muda: continua usando dias_ativos (presenca), por isso a coluna antiga fica e entra uma nova (dias_acao).
-- 2) As metas deixam de ter teto seco. Entregas, colaboracao e horas: a meta vale 80% do peso e os 20% restantes se ganham
--    ate o DOBRO da meta (acima disso, 100%). Constancia: 100% na meta (ela e limitada pelos dias uteis da janela).
-- Defaults: meta de dias 20 -> 18 (a janela de 30 dias tem ~22 dias uteis).
BEGIN;

CREATE OR REPLACE FUNCTION public._people_escala(p_x numeric, p_meta numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
SELECT CASE
  WHEN p_meta IS NULL OR p_meta <= 0 OR p_x IS NULL OR p_x <= 0 THEN 0::numeric
  WHEN p_x <= p_meta THEN 0.8 * p_x / p_meta
  WHEN p_x < 2 * p_meta THEN 0.8 + 0.2 * (p_x - p_meta) / p_meta
  ELSE 1::numeric
END;
$function$;
REVOKE ALL ON FUNCTION public._people_escala(numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._people_escala(numeric, numeric) TO service_role;

-- _people_signals ganha a coluna dias_acao (muda o retorno, entao precisa recriar)
DROP FUNCTION IF EXISTS public._people_signals(uuid, timestamptz, numeric);
CREATE FUNCTION public._people_signals(p_ws uuid, p_since timestamp with time zone, p_atraso numeric DEFAULT 0.7)
 RETURNS TABLE(user_id uuid, entregas integer, entregas_pond numeric, comentarios integer, movimentacoes integer, criacoes integer, horas numeric, dias_ativos integer, ultima_atividade timestamp with time zone, dias_acao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH uni AS (
  SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = p_ws
  UNION SELECT ul.user_id FROM user_levels ul WHERE ul.workspace_id = p_ws
),
ent AS (
  SELECT cm.user_id, count(*) n,
         sum(CASE WHEN c.due_date IS NULL OR c.completed_at <= c.due_date THEN 1 ELSE p_atraso END) pond
  FROM cards c JOIN card_members cm ON cm.card_id = c.id
  WHERE c.workspace_id = p_ws AND c.status IN ('delivered','approved','archived')
    AND c.completed_at IS NOT NULL AND c.completed_at >= p_since
  GROUP BY 1),
com AS (
  SELECT k.user_id, count(*) n FROM comments k JOIN cards c ON c.id = k.card_id
  WHERE c.workspace_id = p_ws AND k.created_at >= p_since GROUP BY 1),
mov AS (
  SELECT h.triggered_by AS user_id, count(*) n FROM card_stage_history h JOIN cards c ON c.id = h.card_id
  WHERE c.workspace_id = p_ws AND h.triggered_by IS NOT NULL AND h.created_at >= p_since GROUP BY 1),
cri AS (
  SELECT a.user_id, count(*) n FROM audit_logs a
  WHERE a.workspace_id = p_ws AND a.entity_type = 'cards' AND lower(a.action) IN ('create','insert')
    AND a.created_at >= p_since AND a.user_id IS NOT NULL GROUP BY 1),
hor AS (
  SELECT t.user_id,
         sum(CASE WHEN t.is_running THEN extract(epoch FROM now() - t.started_at) ELSE t.duration_seconds END) / 3600.0 h
  FROM time_entries t WHERE t.workspace_id = p_ws AND t.started_at >= p_since GROUP BY 1),
-- presenca: qualquer sinal de uso (so o XP vitalicio ainda usa)
ev AS (
  SELECT a.user_id, a.created_at ts FROM audit_logs a WHERE a.workspace_id = p_ws AND a.created_at >= p_since AND a.user_id IS NOT NULL
  UNION ALL SELECT m.user_id, m.created_at FROM module_usage m WHERE m.workspace_id = p_ws AND m.created_at >= p_since
  UNION ALL SELECT k.user_id, k.created_at FROM comments k JOIN cards c ON c.id = k.card_id WHERE c.workspace_id = p_ws AND k.created_at >= p_since
  UNION ALL SELECT t.user_id, t.started_at FROM time_entries t WHERE t.workspace_id = p_ws AND t.started_at >= p_since
),
dia AS (
  SELECT ev.user_id, count(DISTINCT (ev.ts AT TIME ZONE 'America/Sao_Paulo')::date) n, max(ev.ts) ultima FROM ev GROUP BY 1),
-- acao: comentar, mover, criar, entregar ou lancar horas, so em dia util
acao AS (
  SELECT k.user_id, k.created_at ts FROM comments k JOIN cards c ON c.id = k.card_id WHERE c.workspace_id = p_ws AND k.created_at >= p_since
  UNION ALL SELECT h.triggered_by, h.created_at FROM card_stage_history h JOIN cards c ON c.id = h.card_id WHERE c.workspace_id = p_ws AND h.triggered_by IS NOT NULL AND h.created_at >= p_since
  UNION ALL SELECT a.user_id, a.created_at FROM audit_logs a WHERE a.workspace_id = p_ws AND a.entity_type = 'cards' AND lower(a.action) IN ('create','insert') AND a.user_id IS NOT NULL AND a.created_at >= p_since
  UNION ALL SELECT cm.user_id, c.completed_at FROM cards c JOIN card_members cm ON cm.card_id = c.id WHERE c.workspace_id = p_ws AND c.status IN ('delivered','approved','archived') AND c.completed_at IS NOT NULL AND c.completed_at >= p_since
  UNION ALL SELECT t.user_id, t.started_at FROM time_entries t WHERE t.workspace_id = p_ws AND t.started_at >= p_since
),
dia_a AS (
  SELECT acao.user_id,
         count(DISTINCT (acao.ts AT TIME ZONE 'America/Sao_Paulo')::date)
           FILTER (WHERE extract(isodow FROM acao.ts AT TIME ZONE 'America/Sao_Paulo') < 6) n
  FROM acao GROUP BY 1)
SELECT u.user_id,
       coalesce(ent.n, 0)::int, coalesce(ent.pond, 0)::numeric, coalesce(com.n, 0)::int,
       coalesce(mov.n, 0)::int, coalesce(cri.n, 0)::int, coalesce(round(hor.h, 1), 0)::numeric,
       coalesce(dia.n, 0)::int, dia.ultima, coalesce(dia_a.n, 0)::int
FROM uni u
LEFT JOIN ent USING (user_id) LEFT JOIN com USING (user_id) LEFT JOIN mov USING (user_id)
LEFT JOIN cri USING (user_id) LEFT JOIN hor USING (user_id) LEFT JOIN dia USING (user_id) LEFT JOIN dia_a USING (user_id);
$function$;
REVOKE ALL ON FUNCTION public._people_signals(uuid, timestamptz, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._people_signals(uuid, timestamptz, numeric) TO service_role;

-- score: constancia por dias com acao; escala continua em entregas, colaboracao e horas
CREATE OR REPLACE FUNCTION public._people_scores(p_ws uuid, p_days integer)
 RETURNS TABLE(user_id uuid, participa boolean, entregas integer, entregas_pond numeric, comentarios integer, movimentacoes integer, criacoes integer, horas numeric, dias_ativos integer, ultima_atividade timestamp with time zone, pts_entrega numeric, pts_constancia numeric, pts_colaboracao numeric, pts_horas numeric, score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH c AS (
  SELECT coalesce(max(peso_entrega), 50) pe, coalesce(max(peso_constancia), 20) pc,
         coalesce(max(peso_colaboracao), 20) pl, coalesce(max(peso_horas), 10) ph,
         coalesce(max(meta_entregas), 12) me, coalesce(max(meta_dias), 18) md,
         coalesce(max(meta_colaboracao), 40) ml, coalesce(max(meta_horas), 20) mh,
         coalesce(max(valor_atraso), 70) va,
         greatest(1, least(coalesce(p_days, 30), 365)) / 30.0 f
  FROM public.people_ranking_config WHERE workspace_id = p_ws
)
SELECT s.user_id, coalesce(pr.included, true), s.entregas, s.entregas_pond, s.comentarios, s.movimentacoes,
       s.criacoes, s.horas, s.dias_acao, s.ultima_atividade,
       x.a, x.b, x.d, x.e, round(x.a + x.b + x.d + x.e, 1)
FROM c
CROSS JOIN LATERAL public._people_signals(p_ws, now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))), c.va / 100.0) s
LEFT JOIN public.people_ranking_participation pr ON pr.workspace_id = p_ws AND pr.user_id = s.user_id
CROSS JOIN LATERAL (SELECT
  round(public._people_escala(s.entregas_pond, c.me * c.f) * c.pe, 1) a,
  round(least(1, s.dias_acao / (c.md * c.f)) * c.pc, 1) b,
  round(public._people_escala(s.comentarios * 2 + s.movimentacoes + s.criacoes, c.ml * c.f) * c.pl, 1) d,
  round(public._people_escala(s.horas, c.mh * c.f) * c.ph, 1) e) x;
$function$;

-- sequencia de dias uteis seguidos: mesmo criterio de "dia com acao"
CREATE OR REPLACE FUNCTION public.get_people_streaks(p_workspace_id uuid)
 RETURNS TABLE(user_id uuid, streak_atual integer, melhor_streak integer, ativo_hoje boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ref  int;
  v_hoje_util boolean := extract(isodow FROM v_hoje) < 6;
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_ref := ((v_hoje - extract(isodow FROM v_hoje)::int + 1 - DATE '2001-01-01') / 7) * 5
           + LEAST(extract(isodow FROM v_hoje)::int, 5) - 1;

  RETURN QUERY
  WITH ev AS (
    SELECT k.user_id, k.created_at ts FROM comments k JOIN cards c ON c.id = k.card_id
      WHERE c.workspace_id = p_workspace_id AND k.created_at > now() - interval '180 days'
    UNION ALL SELECT h.triggered_by, h.created_at FROM card_stage_history h JOIN cards c ON c.id = h.card_id
      WHERE c.workspace_id = p_workspace_id AND h.triggered_by IS NOT NULL AND h.created_at > now() - interval '180 days'
    UNION ALL SELECT a.user_id, a.created_at FROM audit_logs a
      WHERE a.workspace_id = p_workspace_id AND a.entity_type = 'cards' AND lower(a.action) IN ('create','insert')
        AND a.user_id IS NOT NULL AND a.created_at > now() - interval '180 days'
    UNION ALL SELECT cm.user_id, c.completed_at FROM cards c JOIN card_members cm ON cm.card_id = c.id
      WHERE c.workspace_id = p_workspace_id AND c.status IN ('delivered','approved','archived')
        AND c.completed_at IS NOT NULL AND c.completed_at > now() - interval '180 days'
    UNION ALL SELECT t.user_id, t.started_at FROM time_entries t
      WHERE t.workspace_id = p_workspace_id AND t.started_at > now() - interval '180 days'
  ),
  dias AS (
    SELECT DISTINCT e.user_id, (e.ts AT TIME ZONE 'America/Sao_Paulo')::date d FROM ev e
    WHERE extract(isodow FROM (e.ts AT TIME ZONE 'America/Sao_Paulo')) < 6
  ),
  idx AS (
    SELECT d.user_id, d.d,
           ((d.d - extract(isodow FROM d.d)::int + 1 - DATE '2001-01-01') / 7) * 5 + extract(isodow FROM d.d)::int - 1 AS bd
    FROM dias d
  ),
  isl AS (
    SELECT i.user_id, i.bd, i.bd - row_number() OVER (PARTITION BY i.user_id ORDER BY i.bd) AS grp FROM idx i
  ),
  sq AS (
    SELECT s.user_id, count(*)::int len, max(s.bd) ultimo FROM isl s GROUP BY s.user_id, s.grp
  )
  SELECT u.user_id,
         coalesce(max(sq.len) FILTER (WHERE sq.ultimo >= v_ref - 1), 0)::int,
         coalesce(max(sq.len), 0)::int,
         coalesce(bool_or(sq.ultimo = v_ref), false) AND v_hoje_util
  FROM (SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.is_active) u
  LEFT JOIN sq ON sq.user_id = u.user_id
  GROUP BY u.user_id;
END;
$function$;

ALTER TABLE public.people_ranking_config ALTER COLUMN meta_dias SET DEFAULT 18;

COMMIT;
