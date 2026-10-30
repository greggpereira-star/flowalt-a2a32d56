-- Gamificacao, Onda 2, etapa 2: missoes da semana.
-- O sistema aponta ate 5 cards que travam a entrega (vencidos ha 1 dia ou mais, ou parados em Aprovacao ha 2 dias ou mais)
-- e paga pontos de TEMPORADA por cobrar e por destravar. Nao mexe no score nem no XP.
-- Anti-jogo: so o sistema cria missao; mesmo card so volta a ser missao 14 dias depois; a resolucao de atraso paga 6 pontos
-- (entrega atrasada vale 14, entao atrasar de proposito nunca rende mais que entregar no prazo: 14 + 6 = 20).
BEGIN;

CREATE TABLE IF NOT EXISTS public.missoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('atraso', 'aprovacao')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'cumprida', 'expirada')),
  dias_no_inicio integer NOT NULL DEFAULT 0,
  criada_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  encerrada_em timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS missoes_uma_aberta_por_card ON public.missoes (card_id) WHERE status = 'aberta';
CREATE INDEX IF NOT EXISTS missoes_ws_criada ON public.missoes (workspace_id, criada_em DESC);

CREATE TABLE IF NOT EXISTS public.missao_creditos (
  missao_id uuid NOT NULL REFERENCES public.missoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  motivo text NOT NULL CHECK (motivo IN ('cobranca', 'resolucao')),
  pontos integer NOT NULL,
  creditado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (missao_id, user_id, motivo)
);
-- so a primeira cobranca de cada missao paga
CREATE UNIQUE INDEX IF NOT EXISTS missao_creditos_uma_cobranca ON public.missao_creditos (missao_id) WHERE motivo = 'cobranca';
CREATE INDEX IF NOT EXISTS missao_creditos_user ON public.missao_creditos (user_id, creditado_em);

ALTER TABLE public.missoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missao_creditos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ms_select ON public.missoes;
DROP POLICY IF EXISTS mc_select ON public.missao_creditos;
CREATE POLICY ms_select ON public.missoes FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY mc_select ON public.missao_creditos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.missoes m WHERE m.id = missao_id AND public.is_workspace_member(auth.uid(), m.workspace_id)));
REVOKE ALL ON public.missoes FROM anon;
REVOKE ALL ON public.missao_creditos FROM anon;
-- escrita so pelas funcoes do servidor
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.missoes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.missao_creditos FROM authenticated;

-- tabela de pontos num lugar so (a tela le o mesmo valor)
CREATE OR REPLACE FUNCTION public._missao_pontos(p_tipo text, p_motivo text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ SELECT CASE WHEN p_motivo = 'cobranca' THEN 3 WHEN p_tipo = 'atraso' THEN 6 ELSE 10 END $function$;
REVOKE ALL ON FUNCTION public._missao_pontos(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._missao_pontos(text, text) TO authenticated, service_role;

-- um ciclo para um workspace: paga cobranca, fecha missoes cumpridas, expira vencidas e abre novas. Idempotente.
CREATE OR REPLACE FUNCTION public._missoes_sincronizar(p_ws uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m record; v_novas int := 0; v_abertas int; v_fim timestamptz; v_titulo text;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('missoes:' || p_ws::text)) THEN RETURN 0; END IF;

  -- 1) cobranca: o primeiro comentario de verdade (15+ caracteres) de um membro ativo, dentro da janela da missao
  INSERT INTO missao_creditos (missao_id, user_id, motivo, pontos, creditado_em)
  SELECT DISTINCT ON (ms.id) ms.id, k.user_id, 'cobranca', public._missao_pontos(ms.tipo, 'cobranca'), k.created_at
  FROM missoes ms
  JOIN comments k ON k.card_id = ms.card_id AND k.created_at > ms.criada_em AND k.created_at <= ms.expira_em AND length(trim(coalesce(k.content, ''))) >= 15
  JOIN workspace_members wm ON wm.workspace_id = ms.workspace_id AND wm.user_id = k.user_id AND wm.is_active
  WHERE ms.workspace_id = p_ws AND ms.status = 'aberta'
    AND NOT EXISTS (SELECT 1 FROM missao_creditos c WHERE c.missao_id = ms.id AND c.motivo = 'cobranca')
  ORDER BY ms.id, k.created_at
  ON CONFLICT DO NOTHING;

  -- 2) resolucao de atraso: o card foi entregue/aprovado/arquivado; paga todos os responsaveis ativos
  FOR m IN
    SELECT ms.id, ms.expira_em, ms.tipo, c.title, coalesce(c.completed_at, now()) AS quando, c.id AS card_id
    FROM missoes ms JOIN cards c ON c.id = ms.card_id
    WHERE ms.workspace_id = p_ws AND ms.status = 'aberta' AND ms.tipo = 'atraso' AND c.status IN ('delivered', 'approved', 'archived')
  LOOP
    IF m.quando <= m.expira_em THEN
      UPDATE missoes SET status = 'cumprida', encerrada_em = m.quando WHERE id = m.id;
      INSERT INTO missao_creditos (missao_id, user_id, motivo, pontos, creditado_em)
      SELECT m.id, cm.user_id, 'resolucao', public._missao_pontos('atraso', 'resolucao'), m.quando
      FROM card_members cm JOIN workspace_members wm ON wm.workspace_id = p_ws AND wm.user_id = cm.user_id AND wm.is_active
      WHERE cm.card_id = m.card_id ON CONFLICT DO NOTHING;
    ELSE
      UPDATE missoes SET status = 'expirada', encerrada_em = m.expira_em WHERE id = m.id;
    END IF;
  END LOOP;

  -- 3) resolucao de aprovacao: o card saiu de Aprovacao; quem mexeu na etapa leva os pontos
  FOR m IN
    SELECT ms.id, ms.expira_em, c.title,
           (SELECT h.created_at FROM card_stage_history h WHERE h.card_id = ms.card_id AND h.created_at > ms.criada_em ORDER BY h.created_at LIMIT 1) AS quando,
           (SELECT h.triggered_by FROM card_stage_history h WHERE h.card_id = ms.card_id AND h.created_at > ms.criada_em ORDER BY h.created_at LIMIT 1) AS quem
    FROM missoes ms JOIN cards c ON c.id = ms.card_id
    WHERE ms.workspace_id = p_ws AND ms.status = 'aberta' AND ms.tipo = 'aprovacao' AND c.status <> 'review'
  LOOP
    v_fim := coalesce(m.quando, now());
    IF v_fim <= m.expira_em THEN
      UPDATE missoes SET status = 'cumprida', encerrada_em = v_fim WHERE id = m.id;
      INSERT INTO missao_creditos (missao_id, user_id, motivo, pontos, creditado_em)
      SELECT m.id, m.quem, 'resolucao', public._missao_pontos('aprovacao', 'resolucao'), v_fim
      WHERE m.quem IS NOT NULL AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p_ws AND wm.user_id = m.quem AND wm.is_active)
      ON CONFLICT DO NOTHING;
    ELSE
      UPDATE missoes SET status = 'expirada', encerrada_em = m.expira_em WHERE id = m.id;
    END IF;
  END LOOP;

  -- 4) o que passou de 7 dias sem resolver expira (cobranca ja paga continua paga)
  UPDATE missoes SET status = 'expirada', encerrada_em = expira_em WHERE workspace_id = p_ws AND status = 'aberta' AND expira_em < now();

  -- aviso para quem ganhou pontos de resolucao agora (uma vez por credito)
  INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
  SELECT c.user_id, p_ws, 'mission_done', 'Missão cumprida: +' || c.pontos || ' pts',
         left(coalesce(cd.title, 'Card'), 80), jsonb_build_object('route', '/gamification', 'missao_id', c.missao_id)
  FROM missao_creditos c JOIN missoes ms ON ms.id = c.missao_id JOIN cards cd ON cd.id = ms.card_id
  WHERE ms.workspace_id = p_ws AND c.motivo = 'resolucao' AND c.creditado_em > now() - interval '2 hours'
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = c.user_id AND n.type = 'mission_done' AND n.metadata->>'missao_id' = c.missao_id::text);

  -- 5) abre novas ate 5 abertas: cards vencidos ha 1 dia ou mais e cards parados em Aprovacao ha 2 dias ou mais, os mais antigos primeiro
  SELECT count(*) INTO v_abertas FROM missoes WHERE workspace_id = p_ws AND status = 'aberta';
  IF v_abertas < 5 THEN
    WITH cand AS (
      SELECT DISTINCT ON (x.card_id) x.card_id, x.tipo, x.seg FROM (
        SELECT c.id AS card_id, 'atraso'::text AS tipo, extract(epoch FROM now() - c.due_date) AS seg
        FROM cards c WHERE c.workspace_id = p_ws AND c.status NOT IN ('delivered', 'approved', 'archived')
          AND coalesce(c.visibility, 'inherit') <> 'restricted' AND c.due_date < now() - interval '1 day'
        UNION ALL
        SELECT c.id, 'aprovacao', extract(epoch FROM now() - c.stage_entered_at)
        FROM cards c WHERE c.workspace_id = p_ws AND c.status = 'review'
          AND coalesce(c.visibility, 'inherit') <> 'restricted' AND c.stage_entered_at < now() - interval '2 days') x
      WHERE NOT EXISTS (SELECT 1 FROM missoes m2 WHERE m2.card_id = x.card_id AND (m2.status = 'aberta' OR m2.criada_em > now() - interval '14 days'))
      ORDER BY x.card_id, CASE x.tipo WHEN 'aprovacao' THEN 0 ELSE 1 END)
    INSERT INTO missoes (workspace_id, card_id, tipo, dias_no_inicio, expira_em)
    SELECT p_ws, cand.card_id, cand.tipo, floor(cand.seg / 86400)::int, now() + interval '7 days'
    FROM cand ORDER BY cand.seg DESC LIMIT (5 - v_abertas)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_novas = ROW_COUNT;
  END IF;
  RETURN v_novas;
END;
$function$;
REVOKE ALL ON FUNCTION public._missoes_sincronizar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._missoes_sincronizar(uuid) TO service_role;

-- leitura para a tela: sincroniza e devolve as abertas mais o que foi encerrado nos ultimos 7 dias
CREATE OR REPLACE FUNCTION public.get_missoes_semana(p_workspace_id uuid)
RETURNS TABLE(id uuid, card_id uuid, space_id uuid, titulo text, tipo text, status text, dias integer, criada_em timestamptz, expira_em timestamptz,
              encerrada_em timestamptz, pontos_cobranca integer, pontos_resolucao integer, cobrada_por text, resolvida_por text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  PERFORM public._missoes_sincronizar(p_workspace_id);
  RETURN QUERY
  SELECT ms.id, ms.card_id, c.space_id, c.title, ms.tipo, ms.status,
         CASE WHEN ms.status = 'aberta' THEN
           greatest(ms.dias_no_inicio, floor(extract(epoch FROM now() - CASE WHEN ms.tipo = 'atraso' THEN c.due_date ELSE c.stage_entered_at END) / 86400)::int)
         ELSE ms.dias_no_inicio END,
         ms.criada_em, ms.expira_em, ms.encerrada_em,
         public._missao_pontos(ms.tipo, 'cobranca'), public._missao_pontos(ms.tipo, 'resolucao'),
         (SELECT string_agg(split_part(coalesce(pf.full_name, pf.email), ' ', 1), ', ') FROM missao_creditos cr LEFT JOIN profiles pf ON pf.id = cr.user_id WHERE cr.missao_id = ms.id AND cr.motivo = 'cobranca'),
         (SELECT string_agg(split_part(coalesce(pf.full_name, pf.email), ' ', 1), ', ') FROM missao_creditos cr LEFT JOIN profiles pf ON pf.id = cr.user_id WHERE cr.missao_id = ms.id AND cr.motivo = 'resolucao')
  FROM missoes ms JOIN cards c ON c.id = ms.card_id
  WHERE ms.workspace_id = p_workspace_id AND (ms.status = 'aberta' OR ms.encerrada_em > now() - interval '7 days')
  ORDER BY (ms.status = 'aberta') DESC, ms.criada_em DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_missoes_semana(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_missoes_semana(uuid) TO authenticated, service_role;

-- ciclo de todos os workspaces (agendado) e aviso das segundas
CREATE OR REPLACE FUNCTION public.gamificacao_missoes_ciclo()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w record; v_n int := 0;
BEGIN
  FOR w IN SELECT DISTINCT workspace_id AS id FROM temporadas LOOP v_n := v_n + public._missoes_sincronizar(w.id); END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gamificacao_missoes_ciclo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacao_missoes_ciclo() TO service_role;

CREATE OR REPLACE FUNCTION public.gamificacao_missoes_aviso()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w record; v_n int := 0; v_q int; v_pts int;
BEGIN
  FOR w IN SELECT DISTINCT workspace_id AS id FROM temporadas LOOP
    PERFORM public._missoes_sincronizar(w.id);
    SELECT count(*), coalesce(sum(public._missao_pontos(tipo, 'resolucao') + public._missao_pontos(tipo, 'cobranca')), 0)
      INTO v_q, v_pts FROM missoes WHERE workspace_id = w.id AND status = 'aberta';
    IF v_q > 0 THEN
      INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
      SELECT wm.user_id, w.id, 'mission_week', 'Missões da semana: ' || v_q || CASE WHEN v_q = 1 THEN ' card precisa' ELSE ' cards precisam' END || ' de você',
             'Cobrar e destravar vale até ' || v_pts || ' pts de temporada. Veja a lista na Gamificação.',
             jsonb_build_object('route', '/gamification')
      FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.is_active;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gamificacao_missoes_aviso() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacao_missoes_aviso() TO service_role;

-- pontos de missao entram na temporada do mes (mesma assinatura; so a soma muda)
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
  GROUP BY cr.user_id)
SELECT s.user_id, coalesce(pf.full_name, pf.email), pf.avatar_url, coalesce(pr.included, true),
       s.entregas, s.entregas_pond, s.comentarios, coalesce(m.mov_valida, 0), s.dias_acao, s.horas,
       round(s.entregas_pond * 20 + s.comentarios * 3 + coalesce(m.mov_valida, 0) * 2 + s.dias_acao * 5 + floor(s.horas) * 5 + coalesce(mi.pts, 0))::int
FROM sig s
JOIN workspace_members wm ON wm.workspace_id = p_ws AND wm.user_id = s.user_id AND wm.is_active
LEFT JOIN profiles pf ON pf.id = s.user_id
LEFT JOIN people_ranking_participation pr ON pr.workspace_id = p_ws AND pr.user_id = s.user_id
LEFT JOIN mov m ON m.user_id = s.user_id
LEFT JOIN mis mi ON mi.user_id = s.user_id;
$function$;
REVOKE ALL ON FUNCTION public._pontos_temporada(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._pontos_temporada(uuid, date) TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('gamificacao-missoes', 'gamificacao-missoes-aviso');
SELECT cron.schedule('gamificacao-missoes', '*/30 * * * *', 'select public.gamificacao_missoes_ciclo()');
SELECT cron.schedule('gamificacao-missoes-aviso', '5 11 * * 1', 'select public.gamificacao_missoes_aviso()');

COMMIT;
