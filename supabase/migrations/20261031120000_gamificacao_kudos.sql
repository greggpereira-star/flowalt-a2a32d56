-- Gamificacao, Onda 3, etapa 1: kudos (reconhecimento entre colegas).
-- Cada pessoa tem 3 palmas por semana (segunda a domingo, fuso de Sao Paulo) para dar a colegas, com categoria e motivo.
-- Regras: nao vale para si mesmo, no maximo 1 palma por colega por semana (impede combinar troca de elogios) e motivo de 10 a 280 caracteres.
-- Reconhecimento puro: nao da pontos, XP nem entra no ranking. Aparece no feed da equipe e como aviso a quem recebeu.
BEGIN;

CREATE TABLE IF NOT EXISTS public.kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  de_user_id uuid NOT NULL,
  para_user_id uuid NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('ajuda', 'qualidade', 'prazo', 'ideia', 'equipe')),
  motivo text NOT NULL CHECK (char_length(motivo) BETWEEN 10 AND 280),
  semana date NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (de_user_id <> para_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS kudos_um_por_colega_na_semana ON public.kudos (workspace_id, de_user_id, para_user_id, semana);
CREATE INDEX IF NOT EXISTS kudos_ws_recentes ON public.kudos (workspace_id, criado_em DESC);

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kd_select ON public.kudos;
CREATE POLICY kd_select ON public.kudos FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
REVOKE ALL ON public.kudos FROM anon;
GRANT SELECT ON public.kudos TO authenticated;
GRANT ALL ON public.kudos TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.kudos FROM authenticated;

-- segunda-feira da semana de hoje (Sao Paulo)
CREATE OR REPLACE FUNCTION public._kudos_semana_atual()
RETURNS date LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$ SELECT date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date $function$;
REVOKE ALL ON FUNCTION public._kudos_semana_atual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._kudos_semana_atual() TO authenticated, service_role;

-- quantas palmas ainda restam esta semana para quem esta logado
CREATE OR REPLACE FUNCTION public.get_kudos_restantes(p_workspace_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN greatest(0, 3 - (SELECT count(*)::int FROM kudos k WHERE k.workspace_id = p_workspace_id AND k.de_user_id = auth.uid() AND k.semana = public._kudos_semana_atual()));
END;
$function$;
REVOKE ALL ON FUNCTION public.get_kudos_restantes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kudos_restantes(uuid) TO authenticated, service_role;

-- colegas que podem receber palma (membros ativos, menos quem esta logado)
CREATE OR REPLACE FUNCTION public.get_kudos_colegas(p_workspace_id uuid)
RETURNS TABLE(user_id uuid, nome text, avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT wm.user_id, coalesce(pf.full_name, pf.email), pf.avatar_url
  FROM workspace_members wm LEFT JOIN profiles pf ON pf.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id AND wm.is_active AND wm.user_id <> auth.uid()
  ORDER BY coalesce(pf.full_name, pf.email);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_kudos_colegas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kudos_colegas(uuid) TO authenticated, service_role;

-- dar uma palma; devolve quantas restam. Erros comecam com "kudos:" para a tela traduzir.
CREATE OR REPLACE FUNCTION public.dar_kudos(p_workspace_id uuid, p_para uuid, p_categoria text, p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_de uuid := auth.uid(); v_semana date := public._kudos_semana_atual(); v_motivo text := trim(coalesce(p_motivo, '')); v_nome text;
BEGIN
  IF v_de IS NULL OR NOT public.is_workspace_member(v_de, p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF p_para = v_de THEN RAISE EXCEPTION 'kudos:si_mesmo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_para AND wm.is_active) THEN RAISE EXCEPTION 'kudos:colega_invalido'; END IF;
  IF p_categoria NOT IN ('ajuda', 'qualidade', 'prazo', 'ideia', 'equipe') THEN RAISE EXCEPTION 'kudos:categoria_invalida'; END IF;
  IF char_length(v_motivo) < 10 THEN RAISE EXCEPTION 'kudos:motivo_curto'; END IF;
  IF char_length(v_motivo) > 280 THEN RAISE EXCEPTION 'kudos:motivo_longo'; END IF;
  -- uma pessoa por vez: evita duas palmas simultaneas passarem do limite
  PERFORM pg_advisory_xact_lock(hashtext('kudos:' || v_de::text));
  IF (SELECT count(*) FROM kudos k WHERE k.workspace_id = p_workspace_id AND k.de_user_id = v_de AND k.semana = v_semana) >= 3 THEN RAISE EXCEPTION 'kudos:limite_semanal'; END IF;
  IF EXISTS (SELECT 1 FROM kudos k WHERE k.workspace_id = p_workspace_id AND k.de_user_id = v_de AND k.para_user_id = p_para AND k.semana = v_semana) THEN RAISE EXCEPTION 'kudos:colega_repetido'; END IF;
  INSERT INTO kudos (workspace_id, de_user_id, para_user_id, categoria, motivo, semana) VALUES (p_workspace_id, v_de, p_para, p_categoria, v_motivo, v_semana);
  SELECT split_part(coalesce(pf.full_name, pf.email), ' ', 1) INTO v_nome FROM profiles pf WHERE pf.id = v_de;
  INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
  VALUES (p_para, p_workspace_id, 'kudos_received', 'Kudos de ' || coalesce(v_nome, 'um colega'), left(v_motivo, 140), jsonb_build_object('route', '/gamification?aba=kudos'));
  RETURN public.get_kudos_restantes(p_workspace_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.dar_kudos(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dar_kudos(uuid, uuid, text, text) TO authenticated, service_role;

-- feed da equipe: ultimos 60 dias, mais recentes primeiro
CREATE OR REPLACE FUNCTION public.get_kudos(p_workspace_id uuid, p_limite integer DEFAULT 40)
RETURNS TABLE(id uuid, de_user_id uuid, de_nome text, de_avatar text, para_user_id uuid, para_nome text, para_avatar text, categoria text, motivo text, criado_em timestamptz, posso_remover boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), p_workspace_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT k.id, k.de_user_id, coalesce(d.full_name, d.email), d.avatar_url, k.para_user_id, coalesce(p.full_name, p.email), p.avatar_url,
         k.categoria, k.motivo, k.criado_em, (k.de_user_id = auth.uid() OR public.has_admin_access(auth.uid(), p_workspace_id))
  FROM kudos k LEFT JOIN profiles d ON d.id = k.de_user_id LEFT JOIN profiles p ON p.id = k.para_user_id
  WHERE k.workspace_id = p_workspace_id AND k.criado_em > now() - interval '60 days'
  ORDER BY k.criado_em DESC LIMIT least(greatest(p_limite, 1), 100);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_kudos(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kudos(uuid, integer) TO authenticated, service_role;

-- remover: quem deu ou um admin (moderacao). A palma volta para quem deu, porque o limite conta as linhas da semana.
CREATE OR REPLACE FUNCTION public.remover_kudos(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k record;
BEGIN
  SELECT * INTO k FROM kudos WHERE id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT (k.de_user_id = auth.uid() OR public.has_admin_access(auth.uid(), k.workspace_id)) THEN RETURN false; END IF;
  DELETE FROM kudos WHERE id = p_id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.remover_kudos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_kudos(uuid) TO authenticated, service_role;

COMMIT;
