-- Gamificacao, Onda 3, etapa 2: linha do tempo do time.
-- Um feed so de coisas boas dos ultimos 7 dias: entregas, missoes cumpridas, niveis de conquista e kudos.
-- Nao cria tabela: e uma leitura sobre o que ja existe. Cards restritos ficam de fora (o titulo nao pode vazar).
-- Nao mostra atraso nem quem nao fez nada: so o que merece ser visto.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_linha_do_tempo(p_workspace_id uuid, p_limite integer DEFAULT 30)
RETURNS TABLE(tipo text, quando timestamptz, titulo text, nomes text[], alvo text, detalhe text, pontos integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  WITH ev AS (
    -- entregas: um evento por card, com todos os responsaveis ativos
    SELECT 'entrega'::text AS t, c.completed_at AS q, c.title::text AS ti,
           (SELECT array_agg(split_part(coalesce(pf.full_name, pf.email), ' ', 1) ORDER BY coalesce(pf.full_name, pf.email))
              FROM card_members cm JOIN workspace_members wm ON wm.workspace_id = p_workspace_id AND wm.user_id = cm.user_id AND wm.is_active
              LEFT JOIN profiles pf ON pf.id = cm.user_id WHERE cm.card_id = c.id) AS n,
           NULL::text AS a,
           (CASE WHEN c.due_date IS NULL OR c.completed_at <= c.due_date THEN 'no_prazo' ELSE 'atrasada' END)::text AS d,
           NULL::int AS p
    FROM cards c
    WHERE c.workspace_id = p_workspace_id AND c.status IN ('delivered', 'approved', 'archived') AND c.completed_at > now() - interval '7 days'
      AND coalesce(c.visibility, 'inherit') <> 'restricted'
    UNION ALL
    -- missoes cumpridas: um evento por missao
    SELECT 'missao', max(cr.creditado_em), c.title::text,
           array_agg(split_part(coalesce(pf.full_name, pf.email), ' ', 1) ORDER BY coalesce(pf.full_name, pf.email)),
           NULL, ms.tipo, max(cr.pontos)
    FROM missao_creditos cr JOIN missoes ms ON ms.id = cr.missao_id JOIN cards c ON c.id = ms.card_id LEFT JOIN profiles pf ON pf.id = cr.user_id
    WHERE ms.workspace_id = p_workspace_id AND cr.motivo = 'resolucao' AND cr.creditado_em > now() - interval '7 days' AND coalesce(c.visibility, 'inherit') <> 'restricted'
    GROUP BY ms.id, c.title, ms.tipo
    UNION ALL
    -- conquistas: so niveis conquistados de verdade (a carga inicial e retroativa e fica de fora)
    SELECT 'conquista', cn.conquistado_em, NULL, ARRAY[split_part(coalesce(pf.full_name, pf.email), ' ', 1)], NULL, cn.trilha, cn.nivel
    FROM conquistas_niveis cn LEFT JOIN profiles pf ON pf.id = cn.user_id
    WHERE cn.workspace_id = p_workspace_id AND NOT cn.retroativa AND cn.conquistado_em > now() - interval '7 days'
    UNION ALL
    -- kudos: quem deu, para quem e a categoria (o motivo fica na aba Kudos)
    SELECT 'kudos', k.criado_em, NULL, ARRAY[split_part(coalesce(d.full_name, d.email), ' ', 1)], split_part(coalesce(p.full_name, p.email), ' ', 1), k.categoria, NULL
    FROM kudos k LEFT JOIN profiles d ON d.id = k.de_user_id LEFT JOIN profiles p ON p.id = k.para_user_id
    WHERE k.workspace_id = p_workspace_id AND k.criado_em > now() - interval '7 days')
  SELECT ev.t, ev.q, ev.ti, ev.n, ev.a, ev.d, ev.p FROM ev
  WHERE ev.n IS NOT NULL
  ORDER BY ev.q DESC
  LIMIT least(greatest(p_limite, 1), 60);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_linha_do_tempo(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linha_do_tempo(uuid, integer) TO authenticated, service_role;

COMMIT;
