-- FIX: entity_id type mismatch in accept_workspace_invite
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite workspace_invites%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_invite FROM workspace_invites WHERE token = p_token::uuid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_NOT_FOUND');
  END IF;
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_EXPIRED');
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_REVOKED');
  END IF;
  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_ALREADY_USED', 'status', v_invite.status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = v_user_id AND lower(p.email) = lower(v_invite.email)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_MISMATCH');
  END IF;

  -- Check if already member
  IF EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = v_invite.workspace_id AND wm.user_id = v_user_id AND wm.is_active = true) THEN
    UPDATE workspace_invites SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', true, 'message', 'ALREADY_MEMBER', 'workspace_id', v_invite.workspace_id);
  END IF;

  -- Create member + role
  INSERT INTO workspace_members (workspace_id, user_id, is_active, joined_at) VALUES (v_invite.workspace_id, v_user_id, true, now())
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET is_active = true, joined_at = now();
  INSERT INTO user_roles (workspace_id, user_id, role) VALUES (v_invite.workspace_id, v_user_id, v_invite.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = v_invite.role;
  UPDATE workspace_invites SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id WHERE id = v_invite.id;

  -- Audit log - FIX: entity_id is UUID, not text
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (v_invite.workspace_id, v_user_id, 'invite_accepted', 'workspace_member', v_user_id,
    jsonb_build_object('role', v_invite.role, 'invited_by', v_invite.invited_by));

  RETURN jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'role', v_invite.role);
END;
$$;