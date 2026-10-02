BEGIN;

-- Backup do XP antigo (todo ponto vinha de medalhas x 50).
CREATE TABLE IF NOT EXISTS _backup_user_levels_20261002 AS SELECT * FROM user_levels;

-- 1) Quem participa do ranking (so equipe operacional).
CREATE TABLE IF NOT EXISTS public.people_ranking_participation (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  included boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
ALTER TABLE public.people_ranking_participation ENABLE ROW LEVEL SECURITY;
CREATE POLICY prp_select ON public.people_ranking_participation FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY prp_write ON public.people_ranking_participation FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id))
  WITH CHECK (public.has_admin_access(auth.uid(), workspace_id));

INSERT INTO public.people_ranking_participation (workspace_id, user_id, included)
SELECT wm.workspace_id, wm.user_id,
       NOT (p.full_name IN ('Gregg Palmer Pereira de Oliveira','Lucas Matos','NATILA DA SILVA RAMOS'))
FROM workspace_members wm JOIN profiles p ON p.id = wm.user_id
WHERE wm.workspace_id = '10a7ca16-6328-490f-a6bd-28974a91ef8f' AND wm.is_active
ON CONFLICT DO NOTHING;

-- 2) Sinais reais de atividade por pessoa, desde p_since.
CREATE OR REPLACE FUNCTION public._people_signals(p_ws uuid, p_since timestamptz)
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
         sum(CASE WHEN c.due_date IS NULL OR c.completed_at <= c.due_date THEN 1 ELSE 0.7 END) pond
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

-- 3) XP vitalicio calculado de atividade real + medalhas de marco (feriados/primeiro login nao contam).
CREATE OR REPLACE FUNCTION public._people_xp(p_ws uuid)
RETURNS TABLE(user_id uuid, xp int, medalhas int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
SELECT s.user_id,
       (s.entregas * 20 + s.comentarios * 3 + s.movimentacoes * 2 + s.dias_ativos * 5
        + floor(s.horas)::int * 5 + coalesce(b.marcos, 0) * 50)::int,
       coalesce(b.todas, 0)::int
FROM public._people_signals(p_ws, '-infinity') s
LEFT JOIN (
  SELECT ub.user_id,
         count(*) FILTER (WHERE ub.badge_type NOT LIKE '%\_celebrated' AND ub.badge_type NOT IN ('first_login','onboarding_complete')) marcos,
         count(*) todas
  FROM user_badges ub WHERE ub.workspace_id = p_ws GROUP BY 1) b ON b.user_id = s.user_id;
$$;

CREATE OR REPLACE FUNCTION public._xp_level(p_xp int)
RETURNS TABLE(nivel int, nome text, proximo int)
LANGUAGE sql IMMUTABLE AS $$
SELECT l.n, l.nm, l.nx FROM (VALUES
  (1,'Iniciante',0,100),(2,'Aprendiz',100,300),(3,'Colaborador',300,600),(4,'Profissional',600,1000),
  (5,'Especialista',1000,1500),(6,'Expert',1500,2500),(7,'Mestre',2500,4000),(8,'Grão-Mestre',4000,6000),
  (9,'Lenda',6000,10000),(10,'Imortal',10000,100000)) AS l(n, nm, mn, nx)
WHERE p_xp >= l.mn ORDER BY l.mn DESC LIMIT 1;
$$;

-- 4) Pagina: ranking por atividade (50% entrega) + XP.
CREATE OR REPLACE FUNCTION public.get_people_activity(p_workspace_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(user_id uuid, participa boolean, entregas int, entregas_pond numeric, comentarios int,
  movimentacoes int, criacoes int, horas numeric, dias_ativos int,
  pts_entrega numeric, pts_constancia numeric, pts_colaboracao numeric, pts_horas numeric, score numeric,
  xp int, nivel int, nivel_nome text, proximo_nivel_xp int, medalhas int, ultima_atividade timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_days int := greatest(1, least(coalesce(p_days, 30), 365));
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
  SELECT q.user_id, q.participa, q.entregas, q.entregas_pond, q.comentarios, q.movimentacoes, q.criacoes,
         q.horas, q.dias_ativos, q.pe, q.pc, q.pl, q.ph,
         round(q.pe + q.pc + q.pl + q.ph, 1),
         x.xp, lv.nivel, lv.nome, lv.proximo, x.medalhas, q.ultima_atividade
  FROM (
    SELECT s.*, coalesce(pr.included, true) AS participa,
           round(least(1, s.entregas_pond / 12.0) * 50, 1) AS pe,
           round(least(1, s.dias_ativos / 20.0) * 20, 1) AS pc,
           round(least(1, (s.comentarios * 2 + s.movimentacoes + s.criacoes) / 40.0) * 20, 1) AS pl,
           round(least(1, s.horas / 20.0) * 10, 1) AS ph
    FROM public._people_signals(p_workspace_id, now() - make_interval(days => v_days)) s
    LEFT JOIN public.people_ranking_participation pr
      ON pr.workspace_id = p_workspace_id AND pr.user_id = s.user_id
  ) q
  JOIN public._people_xp(p_workspace_id) x ON x.user_id = q.user_id
  CROSS JOIN LATERAL public._xp_level(x.xp) lv;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_people_activity(uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._people_signals(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._people_xp(uuid) FROM PUBLIC, anon, authenticated;

-- 5) Sincroniza user_levels (usado por Ranking/barra lateral) e guarda historico diario.
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
           a.criacoes, a.entregas, a.horas, a.medalhas, current_date
    FROM (
      SELECT s.user_id, s.criacoes, s.entregas, s.horas, x.medalhas,
             least(1, s.entregas_pond / 12.0) * 50 + least(1, s.dias_ativos / 20.0) * 20
             + least(1, (s.comentarios * 2 + s.movimentacoes + s.criacoes) / 40.0) * 20 + least(1, s.horas / 20.0) * 10 AS score
      FROM public._people_signals(w.id, now() - interval '30 days') s
      JOIN public._people_xp(w.id) x ON x.user_id = s.user_id
      JOIN public.people_ranking_participation pr ON pr.workspace_id = w.id AND pr.user_id = s.user_id AND pr.included
    ) a;
  END LOOP;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.people_ranking_daily() FROM PUBLIC, anon, authenticated;

-- 6) Medalha nao gera mais ponto: o XP agora e calculado.
CREATE OR REPLACE FUNCTION public.on_badge_earned_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN RETURN NEW; END; $$;

SELECT public.people_ranking_daily();
COMMIT;

SELECT p.full_name, b.total_score AS xp_antes, ul.total_score AS xp_depois, ul.level_name
FROM user_levels ul JOIN _backup_user_levels_20261002 b ON b.id = ul.id JOIN profiles p ON p.id = ul.user_id
WHERE ul.workspace_id = '10a7ca16-6328-490f-a6bd-28974a91ef8f' ORDER BY ul.total_score DESC;
