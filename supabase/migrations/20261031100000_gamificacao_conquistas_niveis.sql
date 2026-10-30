-- Gamificacao, Onda 2, etapa 4: trilhas de conquista com niveis bronze, prata e ouro.
-- Complementa as medalhas unicas (user_badges): aqui cada trilha mede um numero vitalicio e sobe de nivel ao cruzar o limite.
-- O valor e sempre calculado do historico real; a tabela conquistas_niveis guarda so QUANDO cada nivel foi conquistado,
-- para avisar uma vez e para o mural. Nao concede XP nem pontos: e reconhecimento.
BEGIN;

CREATE TABLE IF NOT EXISTS public.conquistas_niveis (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  trilha text NOT NULL,
  nivel integer NOT NULL CHECK (nivel BETWEEN 1 AND 3),
  conquistado_em timestamptz NOT NULL DEFAULT now(),
  retroativa boolean NOT NULL DEFAULT false,
  PRIMARY KEY (workspace_id, user_id, trilha, nivel)
);
ALTER TABLE public.conquistas_niveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cn_select ON public.conquistas_niveis;
CREATE POLICY cn_select ON public.conquistas_niveis FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
REVOKE ALL ON public.conquistas_niveis FROM anon;
GRANT SELECT ON public.conquistas_niveis TO authenticated;
GRANT ALL ON public.conquistas_niveis TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.conquistas_niveis FROM authenticated;

-- limites de bronze, prata e ouro de cada trilha (um lugar so; a tela le daqui)
CREATE OR REPLACE FUNCTION public._conquistas_limites(p_trilha text)
RETURNS integer[] LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
SELECT CASE p_trilha
  WHEN 'entregador' THEN ARRAY[10, 50, 150]
  WHEN 'pontual' THEN ARRAY[5, 20, 50]
  WHEN 'voz' THEN ARRAY[10, 50, 150]
  WHEN 'constante' THEN ARRAY[10, 40, 100]
  WHEN 'dia_completo' THEN ARRAY[1, 10, 30]
  WHEN 'missoes' THEN ARRAY[1, 5, 15]
  WHEN 'campeao' THEN ARRAY[1, 3, 6]
END
$function$;
REVOKE ALL ON FUNCTION public._conquistas_limites(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._conquistas_limites(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._conquistas_info(p_trilha text)
RETURNS TABLE(nome text, unidade text, unidade_singular text) LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
SELECT v.nome, v.unidade, v.sing FROM (VALUES
  ('entregador', 'Entregador', 'entregas', 'entrega'), ('pontual', 'Pontual', 'entregas no prazo', 'entrega no prazo'),
  ('voz', 'Voz do time', 'comentários', 'comentário'), ('constante', 'Constante', 'dias úteis com ação', 'dia útil com ação'),
  ('dia_completo', 'Dia completo', 'dias completos', 'dia completo'), ('missoes', 'Caçador de missões', 'missões', 'missão'),
  ('campeao', 'Campeão', 'títulos de temporada', 'título de temporada')) v(t, nome, unidade, sing)
WHERE v.t = p_trilha
$function$;
REVOKE ALL ON FUNCTION public._conquistas_info(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._conquistas_info(text) TO authenticated, service_role;

-- valor vitalicio de cada trilha para cada membro ativo
CREATE OR REPLACE FUNCTION public._conquistas_valores(p_ws uuid)
RETURNS TABLE(user_id uuid, trilha text, valor integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH ativos AS (SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = p_ws AND wm.is_active),
ent AS (
  SELECT cm.user_id, count(*)::int AS n, (count(*) FILTER (WHERE c.due_date IS NULL OR c.completed_at <= c.due_date))::int AS np
  FROM cards c JOIN card_members cm ON cm.card_id = c.id
  WHERE c.workspace_id = p_ws AND c.status IN ('delivered', 'approved', 'archived') AND c.completed_at IS NOT NULL GROUP BY 1),
com AS (SELECT k.user_id, count(*)::int AS n FROM comments k JOIN cards c ON c.id = k.card_id WHERE c.workspace_id = p_ws GROUP BY 1),
sig AS (SELECT s.user_id, s.dias_acao FROM public._people_signals(p_ws, timestamptz '2000-01-01', 0.7) s),
dc AS (SELECT d.user_id, count(*)::int AS n FROM public._diarias_por_usuario(p_ws, timestamptz '2000-01-01', now() + interval '1 day') d WHERE d.moveu AND d.comentou AND d.entregou GROUP BY 1),
mi AS (SELECT cr.user_id, count(DISTINCT cr.missao_id)::int AS n FROM missao_creditos cr JOIN missoes ms ON ms.id = cr.missao_id WHERE ms.workspace_id = p_ws GROUP BY 1),
ca AS (SELECT r.user_id, count(*)::int AS n FROM temporada_resultados r WHERE r.workspace_id = p_ws AND r.posicao = 1 GROUP BY 1)
SELECT a.user_id, t.trilha, t.valor FROM ativos a
CROSS JOIN LATERAL (VALUES
  ('entregador', coalesce((SELECT ent.n FROM ent WHERE ent.user_id = a.user_id), 0)),
  ('pontual', coalesce((SELECT ent.np FROM ent WHERE ent.user_id = a.user_id), 0)),
  ('voz', coalesce((SELECT com.n FROM com WHERE com.user_id = a.user_id), 0)),
  ('constante', coalesce((SELECT sig.dias_acao FROM sig WHERE sig.user_id = a.user_id), 0)),
  ('dia_completo', coalesce((SELECT dc.n FROM dc WHERE dc.user_id = a.user_id), 0)),
  ('missoes', coalesce((SELECT mi.n FROM mi WHERE mi.user_id = a.user_id), 0)),
  ('campeao', coalesce((SELECT ca.n FROM ca WHERE ca.user_id = a.user_id), 0))) t(trilha, valor)
$function$;
REVOKE ALL ON FUNCTION public._conquistas_valores(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._conquistas_valores(uuid) TO service_role;

-- para a tela: valor, nivel atual, limites e quando o nivel atual foi conquistado
CREATE OR REPLACE FUNCTION public.get_conquistas_niveis(p_workspace_id uuid)
RETURNS TABLE(user_id uuid, trilha text, valor integer, nivel integer, limites integer[], conquistado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT v.user_id, v.trilha, v.valor,
         ((v.valor >= l.lim[1])::int + (v.valor >= l.lim[2])::int + (v.valor >= l.lim[3])::int),
         l.lim,
         (SELECT cn.conquistado_em FROM conquistas_niveis cn
           WHERE cn.workspace_id = p_workspace_id AND cn.user_id = v.user_id AND cn.trilha = v.trilha AND NOT cn.retroativa
           ORDER BY cn.nivel DESC LIMIT 1)
  FROM public._conquistas_valores(p_workspace_id) v
  CROSS JOIN LATERAL (SELECT public._conquistas_limites(v.trilha) AS lim) l;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_conquistas_niveis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conquistas_niveis(uuid) TO authenticated, service_role;

-- ciclo diario: grava os niveis novos e avisa quem subiu. p_silencioso grava como retroativo, sem avisar (carga inicial).
CREATE OR REPLACE FUNCTION public.gamificacao_conquistas_ciclo(p_silencioso boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w record; x record; v_n int := 0; v_nivel text[] := ARRAY['Bronze', 'Prata', 'Ouro']; v_inf record;
BEGIN
  FOR w IN SELECT DISTINCT workspace_id AS id FROM temporadas LOOP
    FOR x IN
      SELECT v.user_id, v.trilha, v.valor, n.nivel, (public._conquistas_limites(v.trilha))[n.nivel] AS limite
      FROM public._conquistas_valores(w.id) v
      CROSS JOIN LATERAL generate_series(1, 3) n(nivel)
      WHERE v.valor >= (public._conquistas_limites(v.trilha))[n.nivel]
        AND NOT EXISTS (SELECT 1 FROM conquistas_niveis cn WHERE cn.workspace_id = w.id AND cn.user_id = v.user_id AND cn.trilha = v.trilha AND cn.nivel = n.nivel)
    LOOP
      INSERT INTO conquistas_niveis (workspace_id, user_id, trilha, nivel, retroativa) VALUES (w.id, x.user_id, x.trilha, x.nivel, p_silencioso) ON CONFLICT DO NOTHING;
      IF NOT p_silencioso AND FOUND THEN
        SELECT * INTO v_inf FROM public._conquistas_info(x.trilha);
        INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
        VALUES (x.user_id, w.id, 'achievement_tier', 'Conquista: ' || v_inf.nome || ' ' || v_nivel[x.nivel],
                'Você chegou a ' || x.limite || ' ' || CASE WHEN x.limite = 1 THEN v_inf.unidade_singular ELSE v_inf.unidade END || '.', jsonb_build_object('route', '/gamification?aba=conquistas', 'trilha', x.trilha, 'nivel', x.nivel));
      END IF;
      v_n := v_n + 1;
    END LOOP;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gamificacao_conquistas_ciclo(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacao_conquistas_ciclo(boolean) TO service_role;

-- carga inicial silenciosa: quem ja tem nivel hoje nao recebe aviso retroativo
SELECT public.gamificacao_conquistas_ciclo(true);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gamificacao-conquistas';
SELECT cron.schedule('gamificacao-conquistas', '30 11 * * *', 'select public.gamificacao_conquistas_ciclo()');

COMMIT;
