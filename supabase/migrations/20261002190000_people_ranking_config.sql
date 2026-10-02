BEGIN;

-- Pesos e metas do score, por workspace (padrao = valores originais).
CREATE TABLE IF NOT EXISTS public.people_ranking_config (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  peso_entrega int NOT NULL DEFAULT 50 CHECK (peso_entrega BETWEEN 0 AND 100),
  peso_constancia int NOT NULL DEFAULT 20 CHECK (peso_constancia BETWEEN 0 AND 100),
  peso_colaboracao int NOT NULL DEFAULT 20 CHECK (peso_colaboracao BETWEEN 0 AND 100),
  peso_horas int NOT NULL DEFAULT 10 CHECK (peso_horas BETWEEN 0 AND 100),
  meta_entregas int NOT NULL DEFAULT 12 CHECK (meta_entregas BETWEEN 1 AND 500),
  meta_dias int NOT NULL DEFAULT 20 CHECK (meta_dias BETWEEN 1 AND 31),
  meta_colaboracao int NOT NULL DEFAULT 40 CHECK (meta_colaboracao BETWEEN 1 AND 1000),
  meta_horas int NOT NULL DEFAULT 20 CHECK (meta_horas BETWEEN 1 AND 744),
  valor_atraso int NOT NULL DEFAULT 70 CHECK (valor_atraso BETWEEN 0 AND 100),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_ranking_pesos_100 CHECK (peso_entrega + peso_constancia + peso_colaboracao + peso_horas = 100)
);
ALTER TABLE public.people_ranking_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY prc_select ON public.people_ranking_config FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY prc_write ON public.people_ranking_config FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id))
  WITH CHECK (public.has_admin_access(auth.uid(), workspace_id));

-- _people_signals ganha a penalidade de atraso como parametro.
DROP FUNCTION IF EXISTS public._people_signals(uuid, timestamptz);
CREATE OR REPLACE FUNCTION public._people_signals(p_ws uuid, p_since timestamptz, p_atraso numeric DEFAULT 0.7)
RETURNS TABLE(user_id uuid, entregas int, entregas_pond numeric, comentarios int,
              movimentacoes int, criacoes int, horas numeric, dias_ativos int,
              ultima_atividade timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
ev AS (
  SELECT a.user_id, a.created_at ts FROM audit_logs a WHERE a.workspace_id = p_ws AND a.created_at >= p_since AND a.user_id IS NOT NULL
  UNION ALL SELECT m.user_id, m.created_at FROM module_usage m WHERE m.workspace_id = p_ws AND m.created_at >= p_since
  UNION ALL SELECT k.user_id, k.created_at FROM comments k JOIN cards c ON c.id = k.card_id WHERE c.workspace_id = p_ws AND k.created_at >= p_since
  UNION ALL SELECT t.user_id, t.started_at FROM time_entries t WHERE t.workspace_id = p_ws AND t.started_at >= p_since
),
dia AS (
  SELECT ev.user_id, count(DISTINCT (ev.ts AT TIME ZONE 'America/Sao_Paulo')::date) n, max(ev.ts) ultima FROM ev GROUP BY 1)
SELECT u.user_id,
       coalesce(ent.n, 0)::int, coalesce(ent.pond, 0)::numeric, coalesce(com.n, 0)::int,
       coalesce(mov.n, 0)::int, coalesce(cri.n, 0)::int, coalesce(round(hor.h, 1), 0)::numeric,
       coalesce(dia.n, 0)::int, dia.ultima
FROM uni u
LEFT JOIN ent USING (user_id) LEFT JOIN com USING (user_id) LEFT JOIN mov USING (user_id)
LEFT JOIN cri USING (user_id) LEFT JOIN hor USING (user_id) LEFT JOIN dia USING (user_id);
$$;


REVOKE EXECUTE ON FUNCTION public._people_signals(uuid, timestamptz, numeric) FROM PUBLIC, anon, authenticated;

-- Score por pessoa, lendo a configuracao (ou o padrao).
CREATE OR REPLACE FUNCTION public._people_scores(p_ws uuid, p_days int)
RETURNS TABLE(user_id uuid, participa boolean, entregas int, entregas_pond numeric, comentarios int,
  movimentacoes int, criacoes int, horas numeric, dias_ativos int, ultima_atividade timestamptz,
  pts_entrega numeric, pts_constancia numeric, pts_colaboracao numeric, pts_horas numeric, score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH c AS (
  SELECT coalesce(max(peso_entrega), 50) pe, coalesce(max(peso_constancia), 20) pc,
         coalesce(max(peso_colaboracao), 20) pl, coalesce(max(peso_horas), 10) ph,
         coalesce(max(meta_entregas), 12) me, coalesce(max(meta_dias), 20) md,
         coalesce(max(meta_colaboracao), 40) ml, coalesce(max(meta_horas), 20) mh,
         coalesce(max(valor_atraso), 70) va
  FROM public.people_ranking_config WHERE workspace_id = p_ws
)
SELECT s.user_id, coalesce(pr.included, true), s.entregas, s.entregas_pond, s.comentarios, s.movimentacoes,
       s.criacoes, s.horas, s.dias_ativos, s.ultima_atividade,
       x.a, x.b, x.d, x.e, round(x.a + x.b + x.d + x.e, 1)
FROM c
CROSS JOIN LATERAL public._people_signals(p_ws, now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))), c.va / 100.0) s
LEFT JOIN public.people_ranking_participation pr ON pr.workspace_id = p_ws AND pr.user_id = s.user_id
CROSS JOIN LATERAL (SELECT
  round(least(1, s.entregas_pond / c.me::numeric) * c.pe, 1) a,
  round(least(1, s.dias_ativos / c.md::numeric) * c.pc, 1) b,
  round(least(1, (s.comentarios * 2 + s.movimentacoes + s.criacoes) / c.ml::numeric) * c.pl, 1) d,
  round(least(1, s.horas / c.mh::numeric) * c.ph, 1) e) x;
$$;
REVOKE EXECUTE ON FUNCTION public._people_scores(uuid, int) FROM PUBLIC, anon, authenticated;

-- Pagina: agora devolve tambem os pesos vigentes.
DROP FUNCTION IF EXISTS public.get_people_activity(uuid, int);
CREATE OR REPLACE FUNCTION public.get_people_activity(p_workspace_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(user_id uuid, participa boolean, entregas int, entregas_pond numeric, comentarios int,
  movimentacoes int, criacoes int, horas numeric, dias_ativos int,
  pts_entrega numeric, pts_constancia numeric, pts_colaboracao numeric, pts_horas numeric, score numeric,
  xp int, nivel int, nivel_nome text, proximo_nivel_xp int, medalhas int, ultima_atividade timestamptz,
  peso_entrega int, peso_constancia int, peso_colaboracao int, peso_horas int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
  SELECT q.user_id, q.participa, q.entregas, q.entregas_pond, q.comentarios, q.movimentacoes, q.criacoes,
         q.horas, q.dias_ativos, q.pts_entrega, q.pts_constancia, q.pts_colaboracao, q.pts_horas, q.score,
         x.xp, lv.nivel, lv.nome, lv.proximo, x.medalhas, q.ultima_atividade,
         coalesce(cf.peso_entrega, 50), coalesce(cf.peso_constancia, 20),
         coalesce(cf.peso_colaboracao, 20), coalesce(cf.peso_horas, 10)
  FROM public._people_scores(p_workspace_id, p_days) q
  JOIN public._people_xp(p_workspace_id) x ON x.user_id = q.user_id
  CROSS JOIN LATERAL public._xp_level(x.xp) lv
  LEFT JOIN public.people_ranking_config cf ON cf.workspace_id = p_workspace_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_people_activity(uuid, int) TO authenticated;

-- Rotina diaria passa a usar o mesmo calculo (historico fica coerente com a tela).
CREATE OR REPLACE FUNCTION public.people_ranking_daily()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w record;
BEGIN
  FOR w IN SELECT id FROM workspaces LOOP
    UPDATE user_levels ul SET total_score = x.xp, current_level = lv.nivel, level_name = lv.nome,
           next_level_score = lv.proximo, updated_at = now()
    FROM public._people_xp(w.id) x CROSS JOIN LATERAL public._xp_level(x.xp) lv
    WHERE ul.workspace_id = w.id AND ul.user_id = x.user_id;

    INSERT INTO user_levels (user_id, workspace_id, total_score, current_level, level_name, next_level_score)
    SELECT x.user_id, w.id, x.xp, lv.nivel, lv.nome, lv.proximo
    FROM public._people_xp(w.id) x CROSS JOIN LATERAL public._xp_level(x.xp) lv
    WHERE x.xp > 0 AND NOT EXISTS (SELECT 1 FROM user_levels u WHERE u.workspace_id = w.id AND u.user_id = x.user_id);

    DELETE FROM ranking_history WHERE workspace_id = w.id AND recorded_at = current_date;
    INSERT INTO ranking_history (workspace_id, user_id, score, rank, cards_created, cards_completed, hours_logged, badges_count, recorded_at)
    SELECT w.id, a.user_id, round(a.score)::int, rank() OVER (ORDER BY a.score DESC)::int,
           a.criacoes, a.entregas, a.horas, x.medalhas, current_date
    FROM public._people_scores(w.id, 30) a
    JOIN public._people_xp(w.id) x ON x.user_id = a.user_id
    WHERE a.participa;
  END LOOP;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.people_ranking_daily() FROM PUBLIC, anon, authenticated;

COMMIT;
