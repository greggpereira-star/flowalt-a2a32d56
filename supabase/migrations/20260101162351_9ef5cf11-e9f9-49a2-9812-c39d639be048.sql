
-- =====================================================
-- BLUEPRINT GOVERNANCE: STEP 1 + STEP 2 + STEP 7
-- Enterprise-grade RBAC with workspace invites
-- =====================================================

-- STEP 2: Create workspace_invites table for invitation-only access
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email, status)
);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON public.workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON public.workspace_invites(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status ON public.workspace_invites(workspace_id, status);

-- Enable RLS on workspace_invites
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace_invites
CREATE POLICY "workspace_invites_select_own_email"
  ON public.workspace_invites FOR SELECT
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "workspace_invites_insert_admins"
  ON public.workspace_invites FOR INSERT
  WITH CHECK (
    has_admin_access(auth.uid(), workspace_id)
    AND invited_by = auth.uid()
  );

CREATE POLICY "workspace_invites_update_own"
  ON public.workspace_invites FOR UPDATE
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "workspace_invites_delete_admins"
  ON public.workspace_invites FOR DELETE
  USING (has_admin_access(auth.uid(), workspace_id));

-- STEP 1: Create promote_to_owner function (ONLY owners can promote)
CREATE OR REPLACE FUNCTION public.promote_to_owner(
  p_workspace_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user_id UUID;
  v_is_owner BOOLEAN;
  v_target_role app_role;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Check if current user is owner
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE workspace_id = p_workspace_id 
    AND user_id = v_current_user_id 
    AND role = 'owner'
  ) INTO v_is_owner;
  
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only owners can promote users to owner';
  END IF;
  
  -- Check target user exists in workspace
  SELECT role INTO v_target_role
  FROM user_roles
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace';
  END IF;
  
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'User is already an owner';
  END IF;
  
  -- Promote to owner
  UPDATE user_roles
  SET role = 'owner', created_at = now()
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  
  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data, metadata)
  VALUES (
    p_workspace_id,
    v_current_user_id,
    'promoted_to_owner',
    'workspace_member',
    p_user_id,
    jsonb_build_object('role', 'owner'),
    jsonb_build_object('promoted_by', v_current_user_id)
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'User promoted to owner');
END;
$$;

-- STEP 1: Create transfer_ownership function
CREATE OR REPLACE FUNCTION public.transfer_ownership(
  p_workspace_id UUID,
  p_new_owner_id UUID,
  p_demote_self BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user_id UUID;
  v_is_owner BOOLEAN;
  v_target_exists BOOLEAN;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Check if current user is owner
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE workspace_id = p_workspace_id 
    AND user_id = v_current_user_id 
    AND role = 'owner'
  ) INTO v_is_owner;
  
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only owners can transfer ownership';
  END IF;
  
  -- Check target user exists in workspace
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id
  ) INTO v_target_exists;
  
  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace';
  END IF;
  
  -- Promote new owner
  UPDATE user_roles
  SET role = 'owner', created_at = now()
  WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;
  
  -- Optionally demote self
  IF p_demote_self THEN
    UPDATE user_roles
    SET role = 'admin', created_at = now()
    WHERE workspace_id = p_workspace_id AND user_id = v_current_user_id;
  END IF;
  
  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, old_data, new_data, metadata)
  VALUES (
    p_workspace_id,
    v_current_user_id,
    'ownership_transferred',
    'workspace',
    p_workspace_id,
    jsonb_build_object('previous_owner', v_current_user_id),
    jsonb_build_object('new_owner', p_new_owner_id),
    jsonb_build_object('demoted_self', p_demote_self)
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Ownership transferred');
END;
$$;

-- STEP 2: Create function to create invite
CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  p_workspace_id UUID,
  p_email TEXT,
  p_role app_role DEFAULT 'member'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_invite_id UUID;
  v_token UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check permission (owner, admin, coordinator can invite)
  IF NOT has_admin_access(v_user_id, p_workspace_id) THEN
    RAISE EXCEPTION 'Permission denied: only admins can invite users';
  END IF;
  
  -- Only owners can invite as owner
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
  
  -- Check if already invited (pending)
  IF EXISTS (
    SELECT 1 FROM workspace_invites 
    WHERE workspace_id = p_workspace_id 
    AND email = p_email 
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'User already has a pending invite';
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM profiles p
    JOIN workspace_members wm ON wm.user_id = p.id
    WHERE p.email = p_email 
    AND wm.workspace_id = p_workspace_id
    AND wm.is_active = true
  ) THEN
    RAISE EXCEPTION 'User is already a member of this workspace';
  END IF;
  
  -- Generate token
  v_token := gen_random_uuid();
  
  -- Create invite
  INSERT INTO workspace_invites (workspace_id, email, role, token, invited_by)
  VALUES (p_workspace_id, p_email, p_role, v_token, v_user_id)
  RETURNING id INTO v_invite_id;
  
  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_workspace_id,
    v_user_id,
    'invite_created',
    'workspace_invite',
    v_invite_id,
    jsonb_build_object('email', p_email, 'role', p_role)
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'invite_id', v_invite_id,
    'token', v_token
  );
END;
$$;

-- STEP 2: Create function to accept invite
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_invite RECORD;
  v_member_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get user email
  SELECT email INTO v_user_email FROM profiles WHERE id = v_user_id;
  
  -- Find invite
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now();
  
  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;
  
  -- Verify email matches
  IF v_invite.email != v_user_email THEN
    RAISE EXCEPTION 'This invite is for a different email address';
  END IF;
  
  -- Create workspace member
  INSERT INTO workspace_members (workspace_id, user_id, is_active)
  VALUES (v_invite.workspace_id, v_user_id, true)
  ON CONFLICT (workspace_id, user_id) 
  DO UPDATE SET is_active = true, joined_at = now()
  RETURNING id INTO v_member_id;
  
  -- Create user role
  INSERT INTO user_roles (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, v_user_id, v_invite.role)
  ON CONFLICT (user_id, workspace_id) 
  DO UPDATE SET role = v_invite.role, created_at = now();
  
  -- Mark invite as accepted
  UPDATE workspace_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id, updated_at = now()
  WHERE id = v_invite.id;
  
  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (
    v_invite.workspace_id,
    v_user_id,
    'invite_accepted',
    'workspace_invite',
    v_invite.id,
    jsonb_build_object('role', v_invite.role)
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'workspace_id', v_invite.workspace_id,
    'role', v_invite.role
  );
END;
$$;

-- STEP 7: Create helper function for finance access (Owner + Finance only)
CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role IN ('super_admin', 'owner', 'finance')
  )
$$;

-- STEP 7: Create helper function for sensitive salary data (Owner only)
CREATE OR REPLACE FUNCTION public.has_salary_access(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role IN ('super_admin', 'owner')
  )
$$;

-- Add unique constraint to user_roles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_workspace_unique'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_workspace_unique UNIQUE (user_id, workspace_id);
  END IF;
END $$;

-- Add unique constraint to workspace_members if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_user_workspace_unique'
  ) THEN
    ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_user_workspace_unique UNIQUE (user_id, workspace_id);
  END IF;
END $$;
