BEGIN;

-- Score por pessoa; as metas (base de 30 dias) escalam com o tamanho da janela (7 dias = 7/30 da meta).
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
         coalesce(max(valor_atraso), 70) va,
         greatest(1, least(coalesce(p_days, 30), 365)) / 30.0 f
  FROM public.people_ranking_config WHERE workspace_id = p_ws
)
SELECT s.user_id, coalesce(pr.included, true), s.entregas, s.entregas_pond, s.comentarios, s.movimentacoes,
       s.criacoes, s.horas, s.dias_ativos, s.ultima_atividade,
       x.a, x.b, x.d, x.e, round(x.a + x.b + x.d + x.e, 1)
FROM c
CROSS JOIN LATERAL public._people_signals(p_ws, now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))), c.va / 100.0) s
LEFT JOIN public.people_ranking_participation pr ON pr.workspace_id = p_ws AND pr.user_id = s.user_id
CROSS JOIN LATERAL (SELECT
  round(least(1, s.entregas_pond / (c.me * c.f)) * c.pe, 1) a,
  round(least(1, s.dias_ativos / (c.md * c.f)) * c.pc, 1) b,
  round(least(1, (s.comentarios * 2 + s.movimentacoes + s.criacoes) / (c.ml * c.f)) * c.pl, 1) d,
  round(least(1, s.horas / (c.mh * c.f)) * c.ph, 1) e) x;
$$;
REVOKE EXECUTE ON FUNCTION public._people_scores(uuid, int) FROM PUBLIC, anon, authenticated;


-- XP: so conta medalhas de marco concedidas pelo servidor e inclui pontos de metas semanais concluidas.
CREATE OR REPLACE FUNCTION public._people_xp(p_ws uuid)
RETURNS TABLE(user_id uuid, xp int, medalhas int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
SELECT s.user_id,
       (s.entregas * 20 + s.comentarios * 3 + s.movimentacoes * 2 + s.dias_ativos * 5
        + floor(s.horas)::int * 5 + coalesce(b.marcos, 0) * 50 + coalesce(g.pts, 0))::int,
       coalesce(b.todas, 0)::int
FROM public._people_signals(p_ws, '-infinity') s
LEFT JOIN (
  SELECT ub.user_id,
         count(*) FILTER (WHERE ub.badge_type IN ('first_card','five_cards','time_tracker','ten_hours',
                                                  'commenter','checklist_master','collaborator','space_creator')) marcos,
         count(*) todas
  FROM user_badges ub WHERE ub.workspace_id = p_ws GROUP BY 1) b ON b.user_id = s.user_id
LEFT JOIN (
  SELECT p.user_id, sum(wg.reward_points) pts
  FROM user_goal_progress p JOIN weekly_goals wg ON wg.id = p.goal_id
  WHERE wg.workspace_id = p_ws AND p.completed GROUP BY 1) g ON g.user_id = s.user_id;
$$;

CREATE OR REPLACE FUNCTION public.on_goal_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN RETURN NEW; END; $$;

DROP POLICY IF EXISTS "usuario recebe propria conquista" ON public.user_badges;
CREATE POLICY "usuario recebe propria conquista" ON public.user_badges FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id)
    AND badge_type IN ('first_login','onboarding_complete','birthday_celebrated','new_year_celebrated',
                       'christmas_celebrated','easter_celebrated','carnival_celebrated',
                       'halloween_celebrated','festa_junina_celebrated','valentines_celebrated')
  );

CREATE OR REPLACE FUNCTION public.get_people_streaks(p_workspace_id uuid)
RETURNS TABLE(user_id uuid, streak_atual int, melhor_streak int, ativo_hoje boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    SELECT a.user_id, a.created_at ts FROM audit_logs a
      WHERE a.workspace_id = p_workspace_id AND a.created_at > now() - interval '180 days' AND a.user_id IS NOT NULL
    UNION ALL SELECT m.user_id, m.created_at FROM module_usage m
      WHERE m.workspace_id = p_workspace_id AND m.created_at > now() - interval '180 days'
    UNION ALL SELECT k.user_id, k.created_at FROM comments k JOIN cards c ON c.id = k.card_id
      WHERE c.workspace_id = p_workspace_id AND k.created_at > now() - interval '180 days'
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
GRANT EXECUTE ON FUNCTION public.get_people_streaks(uuid) TO authenticated;

SELECT public.people_ranking_daily();
COMMIT;
