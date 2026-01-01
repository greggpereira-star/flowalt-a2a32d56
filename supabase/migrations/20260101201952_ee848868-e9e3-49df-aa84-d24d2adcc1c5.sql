
-- FLOWALT SECURITY HARDENING - PART 2
-- Accept invite function + Audit triggers + Remaining fixes

-- 1. Fix SECURITY DEFINER view issue - recreate as normal view
DROP VIEW IF EXISTS public.api_keys_safe;
CREATE VIEW public.api_keys_safe WITH (security_invoker = true) AS
SELECT id, workspace_id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_by, created_at, updated_at, rate_limit_per_minute, rate_limit_per_hour
FROM public.api_keys;
GRANT SELECT ON public.api_keys_safe TO authenticated;

-- 2. Webhook subscriptions safe view (mask secret)
DROP VIEW IF EXISTS public.webhook_subscriptions_safe;
CREATE VIEW public.webhook_subscriptions_safe WITH (security_invoker = true) AS
SELECT id, workspace_id, name, url, '***MASKED***'::text as secret, events, is_active, created_by, created_at, updated_at
FROM public.webhook_subscriptions;
GRANT SELECT ON public.webhook_subscriptions_safe TO authenticated;

-- 3. Accept workspace invite function with full server-side validation
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

  SELECT * INTO v_invite FROM workspace_invites WHERE token = p_token FOR UPDATE;
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
    UPDATE workspace_invites SET status = 'accepted', accepted_at = now() WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', true, 'message', 'ALREADY_MEMBER', 'workspace_id', v_invite.workspace_id);
  END IF;

  -- Create member + role
  INSERT INTO workspace_members (workspace_id, user_id, is_active, joined_at) VALUES (v_invite.workspace_id, v_user_id, true, now())
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET is_active = true, joined_at = now();
  INSERT INTO user_roles (workspace_id, user_id, role) VALUES (v_invite.workspace_id, v_user_id, v_invite.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = v_invite.role;
  UPDATE workspace_invites SET status = 'accepted', accepted_at = now() WHERE id = v_invite.id;

  -- Audit log
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (v_invite.workspace_id, v_user_id, 'invite_accepted', 'workspace_member', v_user_id::text,
    jsonb_build_object('role', v_invite.role, 'invited_by', v_invite.invited_by));

  RETURN jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'role', v_invite.role);
END;
$$;

-- 4. Coordinator can invite (fix policy)
DROP POLICY IF EXISTS "workspace_invites_insert_admins" ON public.workspace_invites;
DROP POLICY IF EXISTS "workspace_invites_insert_authorized" ON public.workspace_invites;
CREATE POLICY "workspace_invites_insert_authorized" ON public.workspace_invites FOR INSERT
WITH CHECK (invited_by = auth.uid() AND (has_admin_access(auth.uid(), workspace_id) OR has_role(auth.uid(), workspace_id, 'coordinator')));

-- 5. Generic audit function for critical entities
CREATE OR REPLACE FUNCTION public.audit_entity_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace_id uuid; v_action text;
BEGIN
  v_action := lower(TG_OP);
  IF TG_OP = 'DELETE' THEN v_workspace_id := OLD.workspace_id; ELSE v_workspace_id := NEW.workspace_id; END IF;
  IF v_workspace_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_workspace_id, auth.uid(), v_action, TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- 6. Audit triggers for critical tables
DROP TRIGGER IF EXISTS trigger_audit_user_roles ON public.user_roles;
CREATE TRIGGER trigger_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_workspace_members ON public.workspace_members;
CREATE TRIGGER trigger_audit_workspace_members AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_spaces ON public.spaces;
CREATE TRIGGER trigger_audit_spaces AFTER DELETE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_folders ON public.folders;
CREATE TRIGGER trigger_audit_folders AFTER DELETE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_cards ON public.cards;
CREATE TRIGGER trigger_audit_cards AFTER DELETE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_client_financials ON public.client_financials;
CREATE TRIGGER trigger_audit_client_financials AFTER INSERT OR UPDATE OR DELETE ON public.client_financials FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_collaborator_details ON public.collaborator_details;
CREATE TRIGGER trigger_audit_collaborator_details AFTER INSERT OR UPDATE OR DELETE ON public.collaborator_details FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

-- 7. Additional functions for break-glass
CREATE OR REPLACE FUNCTION public.has_active_support_session(p_user_id uuid, p_workspace_id uuid)
RETURNS TABLE(is_active boolean, mode text, expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT true as is_active, ss.mode, ss.expires_at
  FROM support_sessions ss JOIN platform_super_admins psa ON psa.user_id = ss.super_admin_user_id
  WHERE psa.user_id = p_user_id AND ss.workspace_id = p_workspace_id AND ss.ended_at IS NULL AND ss.expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_with_write_session(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_sessions ss JOIN platform_super_admins psa ON psa.user_id = ss.super_admin_user_id
    WHERE psa.user_id = p_user_id AND ss.workspace_id = p_workspace_id AND ss.ended_at IS NULL AND ss.expires_at > now() AND ss.mode = 'write'
  );
$$;
