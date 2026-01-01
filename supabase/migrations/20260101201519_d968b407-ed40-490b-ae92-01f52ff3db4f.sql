
-- FLOWALT SECURITY HARDENING - PART 1 (Functions + Core RLS)
-- Fixed type casting for app_role

-- 1. Core security functions
CREATE OR REPLACE FUNCTION public.can_view_sensitive_financial(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = p_user_id AND ur.workspace_id = p_workspace_id AND ur.role IN ('owner', 'finance')
  ) OR EXISTS (
    SELECT 1 FROM platform_super_admins psa JOIN support_sessions ss ON ss.super_admin_user_id = psa.user_id
    WHERE psa.user_id = p_user_id AND ss.workspace_id = p_workspace_id AND ss.ended_at IS NULL AND ss.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_with_session(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_sessions ss JOIN platform_super_admins psa ON psa.user_id = ss.super_admin_user_id
    WHERE psa.user_id = p_user_id AND ss.workspace_id = p_workspace_id AND ss.ended_at IS NULL AND ss.expires_at > now()
  );
$$;

-- 2. Folders SELECT policy (CRITICAL)
DROP POLICY IF EXISTS "folders_select_workspace_members" ON public.folders;
CREATE POLICY "folders_select_workspace_members" ON public.folders FOR SELECT USING (
  (is_workspace_member(auth.uid(), workspace_id) AND (
    has_admin_access(auth.uid(), workspace_id) OR owner_id = auth.uid() OR COALESCE(is_restricted, false) = false
    OR EXISTS (SELECT 1 FROM folder_members fm WHERE fm.folder_id = folders.id AND fm.user_id = auth.uid())
  )) OR is_super_admin_with_session(auth.uid(), workspace_id)
);

-- 3. Notifications SELECT policy
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());

-- 4. Cards SELECT with visibility
DROP POLICY IF EXISTS "Members can view workspace cards" ON public.cards;
CREATE POLICY "cards_select_with_visibility" ON public.cards FOR SELECT USING (
  (is_workspace_member(auth.uid(), workspace_id) AND (
    has_admin_access(auth.uid(), workspace_id) OR owner_id = auth.uid() OR created_by = auth.uid()
    OR COALESCE(visibility, 'inherit') != 'restricted'
    OR EXISTS (SELECT 1 FROM card_members cm WHERE cm.card_id = cards.id AND cm.user_id = auth.uid())
  )) OR is_super_admin_with_session(auth.uid(), workspace_id)
);

-- 5. Checklists policies fix
DROP POLICY IF EXISTS "checklists_manage_with_ownership" ON public.checklists;
CREATE POLICY "checklists_insert_card_access" ON public.checklists FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM cards c WHERE c.id = checklists.card_id AND is_workspace_member(auth.uid(), c.workspace_id)
    AND (has_admin_access(auth.uid(), c.workspace_id) OR c.owner_id = auth.uid() OR c.created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM card_members cm WHERE cm.card_id = c.id AND cm.user_id = auth.uid())))
);
CREATE POLICY "checklists_update_card_access" ON public.checklists FOR UPDATE USING (
  EXISTS (SELECT 1 FROM cards c WHERE c.id = checklists.card_id AND (has_admin_access(auth.uid(), c.workspace_id)
    OR c.owner_id = auth.uid() OR c.created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM card_members cm WHERE cm.card_id = c.id AND cm.user_id = auth.uid())))
);
CREATE POLICY "checklists_delete_ownership" ON public.checklists FOR DELETE USING (
  EXISTS (SELECT 1 FROM cards c WHERE c.id = checklists.card_id AND (has_admin_access(auth.uid(), c.workspace_id) OR c.owner_id = auth.uid()))
);

-- 6. Invite token unique constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invites_token_unique') THEN
    ALTER TABLE public.workspace_invites ADD CONSTRAINT workspace_invites_token_unique UNIQUE (token);
  END IF;
END $$;

-- 7. Collaborator details restriction (LGPD)
DROP POLICY IF EXISTS "Members can view their own details" ON public.collaborator_details;
DROP POLICY IF EXISTS "Admins can manage collaborator details" ON public.collaborator_details;
CREATE POLICY "collaborator_details_select_restricted" ON public.collaborator_details FOR SELECT USING (
  EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.id = collaborator_details.member_id AND wm.user_id = auth.uid())
  OR can_view_sensitive_financial(auth.uid(), workspace_id)
);
CREATE POLICY "collaborator_details_manage_finance" ON public.collaborator_details FOR ALL
  USING (can_view_sensitive_financial(auth.uid(), workspace_id))
  WITH CHECK (can_view_sensitive_financial(auth.uid(), workspace_id));

-- 8. Audit trigger for support sessions
CREATE OR REPLACE FUNCTION public.audit_support_session_changes() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data, actor_type)
    VALUES (NEW.workspace_id, NEW.super_admin_user_id, 'support_session_started', 'support_session', NEW.id::text,
      jsonb_build_object('reason', NEW.reason, 'mode', NEW.mode, 'expires_at', NEW.expires_at), 'super_admin');
  ELSIF TG_OP = 'UPDATE' AND NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, old_data, new_data, actor_type)
    VALUES (NEW.workspace_id, NEW.super_admin_user_id, 'support_session_ended', 'support_session', NEW.id::text,
      jsonb_build_object('started_at', OLD.started_at), jsonb_build_object('ended_at', NEW.ended_at), 'super_admin');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trigger_audit_support_session ON public.support_sessions;
CREATE TRIGGER trigger_audit_support_session AFTER INSERT OR UPDATE ON public.support_sessions FOR EACH ROW EXECUTE FUNCTION public.audit_support_session_changes();

-- 9. Secure views for secrets
DROP VIEW IF EXISTS public.api_keys_safe;
CREATE VIEW public.api_keys_safe AS SELECT id, workspace_id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_by, created_at, updated_at, rate_limit_per_minute, rate_limit_per_hour FROM public.api_keys;
GRANT SELECT ON public.api_keys_safe TO authenticated;
