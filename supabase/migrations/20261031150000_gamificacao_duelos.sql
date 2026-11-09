-- Gamificacao, Onda 3, etapa 3: duelos 1x1.
-- Alguem desafia um colega numa categoria; so vale se o colega aceitar. O duelo dura 7 dias a partir do aceite e mede so o que
-- acontece nessa janela. Categorias: mais entregas, mais comentarios (15+ caracteres) e mais dias ativos.
-- Sem pontos, sem XP e fora do ranking: e so desafio e placar. Uma pessoa participa de um duelo por vez.
-- Recusa e silenciosa para o time (o desafiante recebe so "nao foi aceito"); convite parado por 3 dias expira.
BEGIN;

CREATE TABLE IF NOT EXISTS public.duelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  desafiante_id uuid NOT NULL,
  desafiado_id uuid NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('entregas', 'comentarios', 'constancia')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'encerrado', 'recusado', 'expirado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  aceito_em timestamptz,
  fim timestamptz,
  encerrado_em timestamptz,
  valor_desafiante integer,
  valor_desafiado integer,
  vencedor_id uuid,
  CHECK (desafiante_id <> desafiado_id)
);
-- seguranca extra: ninguem aparece duas vezes, no mesmo papel, num duelo em andamento
CREATE UNIQUE INDEX IF NOT EXISTS duelos_um_em_andamento_desafiante ON public.duelos (desafiante_id) WHERE status IN ('pendente', 'ativo');
CREATE UNIQUE INDEX IF NOT EXISTS duelos_um_em_andamento_desafiado ON public.duelos (desafiado_id) WHERE status IN ('pendente', 'ativo');
CREATE INDEX IF NOT EXISTS duelos_ws_recentes ON public.duelos (workspace_id, criado_em DESC);

ALTER TABLE public.duelos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS du_select ON public.duelos;
CREATE POLICY du_select ON public.duelos FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
REVOKE ALL ON public.duelos FROM anon;
GRANT SELECT ON public.duelos TO authenticated;
GRANT ALL ON public.duelos TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.duelos FROM authenticated;

-- quanto uma pessoa fez numa categoria dentro da janela [p_ini, p_fim)
CREATE OR REPLACE FUNCTION public._duelo_valor(p_ws uuid, p_user uuid, p_categoria text, p_ini timestamptz, p_fim timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
SELECT CASE p_categoria
  WHEN 'entregas' THEN (SELECT count(*)::int FROM cards c JOIN card_members cm ON cm.card_id = c.id
                         WHERE c.workspace_id = p_ws AND cm.user_id = p_user AND c.status IN ('delivered', 'approved', 'archived') AND c.completed_at >= p_ini AND c.completed_at < p_fim)
  WHEN 'comentarios' THEN (SELECT count(*)::int FROM comments k JOIN cards c ON c.id = k.card_id
                            WHERE c.workspace_id = p_ws AND k.user_id = p_user AND length(trim(coalesce(k.content, ''))) >= 15 AND k.created_at >= p_ini AND k.created_at < p_fim)
  WHEN 'constancia' THEN (SELECT count(*)::int FROM public._diarias_por_usuario(p_ws, p_ini, p_fim) d WHERE d.user_id = p_user AND (d.moveu OR d.comentou OR d.entregou))
  ELSE 0 END
$function$;
REVOKE ALL ON FUNCTION public._duelo_valor(uuid, uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._duelo_valor(uuid, uuid, text, timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public._duelo_rotulo(p_categoria text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ SELECT CASE p_categoria WHEN 'entregas' THEN 'mais entregas' WHEN 'comentarios' THEN 'mais comentários' ELSE 'mais dias ativos' END $function$;
REVOKE ALL ON FUNCTION public._duelo_rotulo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._duelo_rotulo(text) TO authenticated, service_role;

-- desafiar um colega. Erros comecam com "duelo:" para a tela traduzir.
CREATE OR REPLACE FUNCTION public.desafiar_duelo(p_workspace_id uuid, p_oponente uuid, p_categoria text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_de uuid := auth.uid(); v_id uuid; v_nome text;
BEGIN
  IF v_de IS NULL OR NOT public.is_workspace_member(v_de, p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF p_oponente = v_de THEN RAISE EXCEPTION 'duelo:si_mesmo'; END IF;
  IF p_categoria NOT IN ('entregas', 'comentarios', 'constancia') THEN RAISE EXCEPTION 'duelo:categoria_invalida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_oponente AND wm.is_active) THEN RAISE EXCEPTION 'duelo:colega_invalido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('duelos:' || p_workspace_id::text));
  IF EXISTS (SELECT 1 FROM duelos d WHERE d.status IN ('pendente', 'ativo') AND v_de IN (d.desafiante_id, d.desafiado_id)) THEN RAISE EXCEPTION 'duelo:voce_ocupado'; END IF;
  IF EXISTS (SELECT 1 FROM duelos d WHERE d.status IN ('pendente', 'ativo') AND p_oponente IN (d.desafiante_id, d.desafiado_id)) THEN RAISE EXCEPTION 'duelo:colega_ocupado'; END IF;
  INSERT INTO duelos (workspace_id, desafiante_id, desafiado_id, categoria) VALUES (p_workspace_id, v_de, p_oponente, p_categoria) RETURNING id INTO v_id;
  SELECT split_part(coalesce(pf.full_name, pf.email), ' ', 1) INTO v_nome FROM profiles pf WHERE pf.id = v_de;
  INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
  VALUES (p_oponente, p_workspace_id, 'duel_invite', coalesce(v_nome, 'Um colega') || ' te chamou para um duelo',
          'Valendo ' || public._duelo_rotulo(p_categoria) || ' em 7 dias. Aceite ou recuse na Gamificação.', jsonb_build_object('route', '/gamification', 'duelo_id', v_id));
  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.desafiar_duelo(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desafiar_duelo(uuid, uuid, text) TO authenticated, service_role;

-- aceitar ou recusar (so quem foi desafiado, e so enquanto pendente); devolve o novo status
CREATE OR REPLACE FUNCTION public.responder_duelo(p_id uuid, p_aceitar boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d record; v_nome text;
BEGIN
  SELECT * INTO d FROM duelos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.desafiado_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF d.status <> 'pendente' THEN RAISE EXCEPTION 'duelo:nao_esta_pendente'; END IF;
  SELECT split_part(coalesce(pf.full_name, pf.email), ' ', 1) INTO v_nome FROM profiles pf WHERE pf.id = d.desafiado_id;
  IF p_aceitar THEN
    UPDATE duelos SET status = 'ativo', aceito_em = now(), fim = now() + interval '7 days' WHERE id = p_id;
    INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
    VALUES (d.desafiante_id, d.workspace_id, 'duel_accepted', coalesce(v_nome, 'Seu colega') || ' aceitou o duelo',
            'Valendo ' || public._duelo_rotulo(d.categoria) || ' pelos próximos 7 dias.', jsonb_build_object('route', '/gamification', 'duelo_id', p_id));
    RETURN 'ativo';
  END IF;
  UPDATE duelos SET status = 'recusado' WHERE id = p_id;
  INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
  VALUES (d.desafiante_id, d.workspace_id, 'duel_accepted', 'O duelo não foi aceito desta vez', 'Sem problema: você pode chamar outro colega.', jsonb_build_object('route', '/gamification', 'duelo_id', p_id));
  RETURN 'recusado';
END;
$function$;
REVOKE ALL ON FUNCTION public.responder_duelo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_duelo(uuid, boolean) TO authenticated, service_role;

-- o desafiante desiste de um convite ainda pendente
CREATE OR REPLACE FUNCTION public.cancelar_duelo(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM duelos WHERE id = p_id AND desafiante_id = auth.uid() AND status = 'pendente';
  RETURN FOUND;
END;
$function$;
REVOKE ALL ON FUNCTION public.cancelar_duelo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_duelo(uuid) TO authenticated, service_role;

-- para a tela: duelos ativos e os encerrados nos ultimos 14 dias (todos veem); convites pendentes so os dois envolvidos
CREATE OR REPLACE FUNCTION public.get_duelos(p_workspace_id uuid)
RETURNS TABLE(id uuid, desafiante_id uuid, desafiante_nome text, desafiante_avatar text, desafiado_id uuid, desafiado_nome text, desafiado_avatar text,
              categoria text, status text, criado_em timestamptz, aceito_em timestamptz, fim timestamptz,
              valor_desafiante integer, valor_desafiado integer, vencedor_id uuid, sou_participante boolean, posso_responder boolean, posso_cancelar boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT d.id, d.desafiante_id, coalesce(a.full_name, a.email), a.avatar_url, d.desafiado_id, coalesce(b.full_name, b.email), b.avatar_url,
         d.categoria, d.status, d.criado_em, d.aceito_em, d.fim,
         CASE d.status WHEN 'ativo' THEN public._duelo_valor(d.workspace_id, d.desafiante_id, d.categoria, d.aceito_em, d.fim) WHEN 'encerrado' THEN d.valor_desafiante END,
         CASE d.status WHEN 'ativo' THEN public._duelo_valor(d.workspace_id, d.desafiado_id, d.categoria, d.aceito_em, d.fim) WHEN 'encerrado' THEN d.valor_desafiado END,
         d.vencedor_id, auth.uid() IN (d.desafiante_id, d.desafiado_id),
         (d.status = 'pendente' AND d.desafiado_id = auth.uid()), (d.status = 'pendente' AND d.desafiante_id = auth.uid())
  FROM duelos d LEFT JOIN profiles a ON a.id = d.desafiante_id LEFT JOIN profiles b ON b.id = d.desafiado_id
  WHERE d.workspace_id = p_workspace_id
    AND (d.status = 'ativo' OR (d.status = 'encerrado' AND d.encerrado_em > now() - interval '14 days')
         OR (d.status = 'pendente' AND auth.uid() IN (d.desafiante_id, d.desafiado_id)))
  ORDER BY CASE d.status WHEN 'ativo' THEN 0 WHEN 'pendente' THEN 1 ELSE 2 END, coalesce(d.aceito_em, d.criado_em) DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_duelos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_duelos(uuid) TO authenticated, service_role;

-- ciclo horario: expira convites parados ha 3 dias e encerra os duelos que chegaram ao fim, avisando os dois
CREATE OR REPLACE FUNCTION public.gamificacao_duelos_ciclo()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d record; v_a int; v_b int; v_venc uuid; v_nome_a text; v_nome_b text; v_n int := 0; v_msg_a text; v_msg_b text;
BEGIN
  UPDATE duelos SET status = 'expirado' WHERE status = 'pendente' AND criado_em < now() - interval '3 days';
  FOR d IN SELECT * FROM duelos WHERE status = 'ativo' AND fim <= now() LOOP
    v_a := public._duelo_valor(d.workspace_id, d.desafiante_id, d.categoria, d.aceito_em, d.fim);
    v_b := public._duelo_valor(d.workspace_id, d.desafiado_id, d.categoria, d.aceito_em, d.fim);
    v_venc := CASE WHEN v_a > v_b THEN d.desafiante_id WHEN v_b > v_a THEN d.desafiado_id END;
    UPDATE duelos SET status = 'encerrado', encerrado_em = now(), valor_desafiante = v_a, valor_desafiado = v_b, vencedor_id = v_venc WHERE id = d.id;
    SELECT split_part(coalesce(pf.full_name, pf.email), ' ', 1) INTO v_nome_a FROM profiles pf WHERE pf.id = d.desafiante_id;
    SELECT split_part(coalesce(pf.full_name, pf.email), ' ', 1) INTO v_nome_b FROM profiles pf WHERE pf.id = d.desafiado_id;
    IF v_venc IS NULL THEN
      v_msg_a := 'Empate em ' || public._duelo_rotulo(d.categoria) || ': ' || v_a || ' a ' || v_b || '. Que duelo!';
      v_msg_b := v_msg_a;
    ELSE
      v_msg_a := CASE WHEN v_venc = d.desafiante_id THEN 'Você venceu' ELSE coalesce(v_nome_b, 'Seu colega') || ' levou desta vez' END || ' em ' || public._duelo_rotulo(d.categoria) || ': ' || v_a || ' a ' || v_b || '.';
      v_msg_b := CASE WHEN v_venc = d.desafiado_id THEN 'Você venceu' ELSE coalesce(v_nome_a, 'Seu colega') || ' levou desta vez' END || ' em ' || public._duelo_rotulo(d.categoria) || ': ' || v_b || ' a ' || v_a || '.';
    END IF;
    INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata) VALUES
      (d.desafiante_id, d.workspace_id, 'duel_result', 'Duelo encerrado', v_msg_a, jsonb_build_object('route', '/gamification', 'duelo_id', d.id)),
      (d.desafiado_id, d.workspace_id, 'duel_result', 'Duelo encerrado', v_msg_b, jsonb_build_object('route', '/gamification', 'duelo_id', d.id));
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.gamificacao_duelos_ciclo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacao_duelos_ciclo() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gamificacao-duelos';
SELECT cron.schedule('gamificacao-duelos', '10 * * * *', 'select public.gamificacao_duelos_ciclo()');

COMMIT;
