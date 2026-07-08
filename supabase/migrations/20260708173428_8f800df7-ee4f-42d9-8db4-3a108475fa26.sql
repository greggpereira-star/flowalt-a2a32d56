CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.workspace_invites%ROWTYPE;
  v_user_id uuid;
  v_user_email text;
  v_full_name text;
BEGIN
  v_user_id := auth.uid();
  v_user_email := lower(NULLIF(auth.jwt() ->> 'email', ''));
  v_full_name := NULLIF(auth.jwt() -> 'user_metadata' ->> 'full_name', '');

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_NOT_AVAILABLE');
  END IF;

  SELECT *
  INTO v_invite
  FROM public.workspace_invites
  WHERE token = p_token::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_NOT_FOUND');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.workspace_invites
    SET status = 'expired', updated_at = now()
    WHERE id = v_invite.id AND status = 'pending';

    RETURN jsonb_build_object('success', false, 'error', 'INVITE_EXPIRED');
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_REVOKED');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_ALREADY_USED', 'status', v_invite.status);
  END IF;

  IF lower(v_invite.email) <> v_user_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_MISMATCH');
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    v_user_id,
    v_user_email,
    COALESCE(v_full_name, split_part(v_user_email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    updated_at = now();

  IF EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = v_invite.workspace_id
      AND wm.user_id = v_user_id
      AND wm.is_active = true
  ) THEN
    INSERT INTO public.user_roles (workspace_id, user_id, role)
    VALUES (v_invite.workspace_id, v_user_id, v_invite.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

    UPDATE public.workspace_invites
    SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id, updated_at = now()
    WHERE id = v_invite.id;

    RETURN jsonb_build_object('success', true, 'message', 'ALREADY_MEMBER', 'workspace_id', v_invite.workspace_id, 'role', v_invite.role);
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, is_active, joined_at)
  VALUES (v_invite.workspace_id, v_user_id, true, now())
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET is_active = true, joined_at = now();

  INSERT INTO public.user_roles (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, v_user_id, v_invite.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role = EXCLUDED.role;

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id, updated_at = now()
  WHERE id = v_invite.id;

  INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (
    v_invite.workspace_id,
    v_user_id,
    'invite_accepted',
    'workspace_member',
    v_user_id,
    jsonb_build_object('role', v_invite.role, 'invited_by', v_invite.invited_by)
  );

  RETURN jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'role', v_invite.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;