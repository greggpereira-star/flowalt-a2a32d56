-- Fix revoke_workspace_invite: entity_id is UUID, not text
CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(p_invite_id uuid)
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

  SELECT * INTO v_invite FROM workspace_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_NOT_FOUND');
  END IF;

  -- Only admins can revoke
  IF NOT has_admin_access(v_user_id, v_invite.workspace_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_NOT_PENDING');
  END IF;

  UPDATE workspace_invites 
  SET revoked_at = now(), status = 'revoked', updated_at = now()
  WHERE id = p_invite_id;

  -- Audit log - entity_id is UUID, so pass UUID directly
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (v_invite.workspace_id, v_user_id, 'invite_revoked', 'workspace_invite', p_invite_id,
    jsonb_build_object('email', v_invite.email, 'role', v_invite.role));

  RETURN jsonb_build_object('success', true);
END;
$$;