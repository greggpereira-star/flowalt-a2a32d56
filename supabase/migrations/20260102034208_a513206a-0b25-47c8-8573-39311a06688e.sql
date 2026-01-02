
-- ========================================================
-- PERMISSION REGRESSION HARDENING - Migration Fix (v2)
-- ========================================================

-- 1. Add revoked_at column to workspace_invites for proper revocation tracking
ALTER TABLE public.workspace_invites 
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- 2. CRITICAL FIX: Update can_view_sensitive_financial to EXCLUDE admin
-- Per blueprint: Only Owner + Finance can see salary/contract data
-- Admin has operational access but NOT sensitive financial access
CREATE OR REPLACE FUNCTION public.can_view_sensitive_financial(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p_user_id
    AND ur.workspace_id = p_workspace_id
    AND ur.role IN ('owner'::app_role, 'finance'::app_role)
  )
  OR is_super_admin_with_session(p_user_id, p_workspace_id)
$$;

-- 3. Create helper function to check if user can view NON-sensitive financial data
-- Admin, Coordinator, Owner, Finance can view invoices/transactions but NOT salary data
CREATE OR REPLACE FUNCTION public.can_view_financial(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p_user_id
    AND ur.workspace_id = p_workspace_id
    AND ur.role IN ('owner'::app_role, 'admin'::app_role, 'coordinator'::app_role, 'finance'::app_role)
  )
  OR is_super_admin_with_session(p_user_id, p_workspace_id)
$$;

-- 4. Create can_manage_financial for insert/update/delete of non-sensitive financial data
CREATE OR REPLACE FUNCTION public.can_manage_financial(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p_user_id
    AND ur.workspace_id = p_workspace_id
    AND ur.role IN ('owner'::app_role, 'admin'::app_role, 'finance'::app_role)
  )
  OR is_super_admin_with_write_session(p_user_id, p_workspace_id)
$$;

-- 5. Create function to check if user can access a card (for deep link protection)
CREATE OR REPLACE FUNCTION public.can_access_card(p_user_id uuid, p_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cards c
    WHERE c.id = p_card_id
    AND is_workspace_member(p_user_id, c.workspace_id)
    AND (
      has_admin_access(p_user_id, c.workspace_id)
      OR c.owner_id = p_user_id
      OR c.created_by = p_user_id
      OR COALESCE(c.visibility, 'inherit') != 'restricted'
      OR is_card_member(p_user_id, p_card_id)
      OR is_super_admin_with_session(p_user_id, c.workspace_id)
    )
  )
$$;

-- 6. Update accept_workspace_invite to handle revoked_at properly
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

  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (v_invite.workspace_id, v_user_id, 'invite_accepted', 'workspace_member', v_user_id::text,
    jsonb_build_object('role', v_invite.role, 'invited_by', v_invite.invited_by));

  RETURN jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'role', v_invite.role);
END;
$$;

-- 7. Create function to revoke invite
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

  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (v_invite.workspace_id, v_user_id, 'invite_revoked', 'workspace_invite', p_invite_id::text,
    jsonb_build_object('email', v_invite.email, 'role', v_invite.role));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Add check_entitlement_with_log function for billing/entitlement enforcement
CREATE OR REPLACE FUNCTION public.check_entitlement_with_log(
  p_workspace_id uuid,
  p_entitlement_key text,
  p_action text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace workspaces%ROWTYPE;
  v_entitlement plan_entitlements%ROWTYPE;
BEGIN
  -- Get workspace
  SELECT * INTO v_workspace FROM workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason_code', 'WORKSPACE_NOT_FOUND');
  END IF;

  -- Get entitlement
  SELECT * INTO v_entitlement 
  FROM plan_entitlements 
  WHERE plan_key = COALESCE(v_workspace.plan, 'free') 
  AND entitlement_key = p_entitlement_key;
  
  IF NOT FOUND THEN
    -- Log the check
    INSERT INTO entitlement_audit (workspace_id, user_id, entitlement_key, action, reason_code)
    VALUES (p_workspace_id, auth.uid(), p_entitlement_key, p_action, 'ENTITLEMENT_NOT_FOUND');
    
    RETURN jsonb_build_object('allowed', false, 'reason_code', 'ENTITLEMENT_NOT_FOUND');
  END IF;

  IF NOT v_entitlement.enabled THEN
    -- Log the block
    INSERT INTO entitlement_audit (workspace_id, user_id, entitlement_key, action, reason_code)
    VALUES (p_workspace_id, auth.uid(), p_entitlement_key, p_action, 'ENTITLEMENT_DISABLED');
    
    RETURN jsonb_build_object('allowed', false, 'reason_code', 'ENTITLEMENT_DISABLED', 'plan', v_workspace.plan);
  END IF;

  -- Entitlement is allowed
  RETURN jsonb_build_object('allowed', true, 'plan', v_workspace.plan, 'limit_value', v_entitlement.limit_value);
END;
$$;

-- 9. Ensure notifications policy is user-only for SELECT
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
FOR SELECT USING (user_id = auth.uid());

-- 10. Add index for faster permission checks (without partial index using now())
CREATE INDEX IF NOT EXISTS idx_user_roles_user_workspace ON user_roles(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_card_members_user_card ON card_members(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_folder_members_user_folder ON folder_members(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_support_sessions_lookup ON support_sessions(super_admin_user_id, workspace_id, ended_at);
