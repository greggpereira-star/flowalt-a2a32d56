
-- =====================================================
-- BLUEPRINT GOVERNANCE: STEP 9 - Notifications with ACL
-- Ensure notifications respect card/folder access
-- =====================================================

-- Create function to check if user should receive notification for a card
CREATE OR REPLACE FUNCTION public.can_receive_card_notification(_user_id UUID, _card_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT can_access_card(_user_id, _card_id)
$$;

-- Create trigger function to prevent notifications for inaccessible cards
CREATE OR REPLACE FUNCTION public.filter_card_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card_id UUID;
BEGIN
  -- Extract card_id from metadata if present
  v_card_id := (NEW.metadata->>'card_id')::UUID;
  
  -- If no card_id in metadata, allow the notification
  IF v_card_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if user can access the card
  IF NOT can_access_card(NEW.user_id, v_card_id) THEN
    -- Silently skip this notification
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS filter_card_notification_trigger ON public.notifications;

CREATE TRIGGER filter_card_notification_trigger
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.filter_card_notification();

-- Update notification RLS to also check card access
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "notifications_select_with_acl"
  ON public.notifications FOR SELECT
  USING (
    auth.uid() = user_id
    AND (
      -- No card reference, always visible
      (metadata->>'card_id') IS NULL
      -- Has card reference, check access
      OR can_access_card(auth.uid(), (metadata->>'card_id')::UUID)
    )
  );

-- Create function to revoke invite
CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_invite RECORD;
BEGIN
  v_user_id := auth.uid();
  
  -- Find invite
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE id = p_invite_id;
  
  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  
  -- Check permission
  IF NOT has_admin_access(v_user_id, v_invite.workspace_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Revoke invite
  UPDATE workspace_invites
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invite_id;
  
  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_invite.workspace_id,
    v_user_id,
    'invite_revoked',
    'workspace_invite',
    p_invite_id,
    jsonb_build_object('email', v_invite.email)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create function to change user role (admin function)
CREATE OR REPLACE FUNCTION public.change_member_role(
  p_workspace_id UUID,
  p_user_id UUID,
  p_new_role app_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_user_role app_role;
  v_target_current_role app_role;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Get current user's role
  SELECT role INTO v_current_user_role
  FROM user_roles
  WHERE workspace_id = p_workspace_id AND user_id = v_current_user_id;
  
  -- Get target user's current role
  SELECT role INTO v_target_current_role
  FROM user_roles
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  
  IF v_target_current_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace';
  END IF;
  
  -- Permission rules:
  -- Only owner can promote to owner
  IF p_new_role = 'owner' AND v_current_user_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can promote to owner';
  END IF;
  
  -- Only owner/admin can change roles
  IF v_current_user_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot change owner's role unless you're also owner
  IF v_target_current_role = 'owner' AND v_current_user_role != 'owner' THEN
    RAISE EXCEPTION 'Cannot change owner role';
  END IF;
  
  -- Cannot demote yourself if you're the only owner
  IF v_current_user_id = p_user_id AND v_current_user_role = 'owner' AND p_new_role != 'owner' THEN
    IF (SELECT COUNT(*) FROM user_roles WHERE workspace_id = p_workspace_id AND role = 'owner') <= 1 THEN
      RAISE EXCEPTION 'Cannot demote yourself: you are the only owner';
    END IF;
  END IF;
  
  -- Update role
  UPDATE user_roles
  SET role = p_new_role, created_at = now()
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  
  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    p_workspace_id,
    v_current_user_id,
    'role_changed',
    'workspace_member',
    p_user_id,
    jsonb_build_object('role', v_target_current_role),
    jsonb_build_object('role', p_new_role)
  );
  
  RETURN jsonb_build_object('success', true, 'new_role', p_new_role);
END;
$$;
