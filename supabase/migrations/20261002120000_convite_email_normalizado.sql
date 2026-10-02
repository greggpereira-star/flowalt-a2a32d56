BEGIN;

-- Backup completo antes de tocar nos dados.
CREATE TABLE IF NOT EXISTS _backup_workspace_invites_20261002 AS
  SELECT * FROM workspace_invites;

-- 1) O e-mail do convite passa a ser SEMPRE gravado em minúsculas e sem espaços.
--
-- Antes, "Vargas2004anabeatriz@gmail.com" e "vargas2004anabeatriz@gmail.com"
-- eram dois convites diferentes para a mesma pessoa, e o convite com maiúscula
-- ficava invisível para a conta dela: a política de leitura e o "meus convites"
-- comparavam com profiles.email, que é sempre minúsculo.
CREATE OR REPLACE FUNCTION public.normalize_invite_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_invite_email ON public.workspace_invites;
CREATE TRIGGER trg_normalize_invite_email
  BEFORE INSERT OR UPDATE OF email ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.normalize_invite_email();

UPDATE public.workspace_invites
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

-- 2) A política de leitura do convidado compara sem diferenciar maiúsculas.
ALTER POLICY workspace_invites_select_own_email ON public.workspace_invites
  USING (
    (lower(email) = (SELECT lower(profiles.email) FROM public.profiles WHERE profiles.id = auth.uid()))
    OR public.has_admin_access(auth.uid(), workspace_id)
  );

-- 3) Criação do convite: normaliza o e-mail, valida o formato e compara
--    pendente/membro sem diferenciar maiúsculas. Contrato de retorno igual.
CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  p_workspace_id uuid,
  p_email text,
  p_role app_role DEFAULT 'member'::app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_invite_id UUID;
  v_token UUID;
  v_email TEXT;
BEGIN
  v_user_id := auth.uid();
  v_email := lower(btrim(p_email));

  IF has_admin_access(v_user_id, p_workspace_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Permission denied: only admins can invite users';
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'E-mail inválido: confira se há erro de digitação';
  END IF;

  IF p_role = 'owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE workspace_id = p_workspace_id
        AND user_id = v_user_id
        AND role = 'owner'
    ) THEN
      RAISE EXCEPTION 'Only owners can invite new owners';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM workspace_invites
    WHERE workspace_id = p_workspace_id
      AND lower(email) = v_email
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'User already has a pending invite';
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles p
    JOIN workspace_members wm ON wm.user_id = p.id
    WHERE lower(p.email) = v_email
      AND wm.workspace_id = p_workspace_id
      AND wm.is_active = true
  ) THEN
    RAISE EXCEPTION 'User is already a member of this workspace';
  END IF;

  v_token := gen_random_uuid();

  INSERT INTO workspace_invites (workspace_id, email, role, token, invited_by)
  VALUES (p_workspace_id, v_email, p_role, v_token, v_user_id)
  RETURNING id INTO v_invite_id;

  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_workspace_id, v_user_id, 'invite_created', 'workspace_invite', v_invite_id,
    jsonb_build_object('email', v_email, 'role', p_role)
  );

  RETURN jsonb_build_object('success', true, 'invite_id', v_invite_id, 'token', v_token);
END;
$function$;

COMMIT;

SELECT 'convites com e-mail fora do padrao (deve ser 0)' AS r, count(*)
FROM workspace_invites WHERE email <> lower(btrim(email));
SELECT 'backup', count(*) FROM _backup_workspace_invites_20261002;
