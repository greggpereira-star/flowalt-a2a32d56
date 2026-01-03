
-- =====================================================
-- HARDENING: Social Media Module Security - Fixed Version
-- =====================================================

-- 1. Recreate RLS policies with correct role check via user_roles table
DROP POLICY IF EXISTS "Users can view social posts with workspace or card access" ON public.social_posts;
DROP POLICY IF EXISTS "Users can insert social posts in their workspace" ON public.social_posts;
DROP POLICY IF EXISTS "Users can update social posts with proper access" ON public.social_posts;
DROP POLICY IF EXISTS "Users can delete social posts with proper access" ON public.social_posts;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role_in_workspace(p_workspace_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role::TEXT FROM user_roles 
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- SELECT policy with card-level access
CREATE POLICY "social_posts_select_policy"
ON public.social_posts
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
  AND (
    card_id IS NULL
    OR card_id IN (
      SELECT card_id FROM card_members WHERE user_id = auth.uid() AND can_view = true
    )
    OR public.get_user_role_in_workspace(workspace_id, auth.uid()) IN ('owner', 'admin')
  )
);

-- INSERT policy
CREATE POLICY "social_posts_insert_policy"
ON public.social_posts
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
  AND (
    card_id IS NULL
    OR card_id IN (
      SELECT card_id FROM card_members WHERE user_id = auth.uid() AND can_edit = true
    )
    OR public.get_user_role_in_workspace(workspace_id, auth.uid()) IN ('owner', 'admin', 'coordinator')
  )
);

-- UPDATE policy with status-based permissions
CREATE POLICY "social_posts_update_policy"
ON public.social_posts
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
  AND (
    (created_by = auth.uid() AND status IN ('draft', 'pending_approval'))
    OR card_id IN (
      SELECT card_id FROM card_members WHERE user_id = auth.uid() AND can_edit = true
    )
    OR public.get_user_role_in_workspace(workspace_id, auth.uid()) IN ('owner', 'admin', 'coordinator')
  )
);

-- DELETE policy with strict permissions
CREATE POLICY "social_posts_delete_policy"
ON public.social_posts
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
  AND (
    (created_by = auth.uid() AND status = 'draft')
    OR card_id IN (
      SELECT card_id FROM card_members WHERE user_id = auth.uid() AND can_delete = true
    )
    OR public.get_user_role_in_workspace(workspace_id, auth.uid()) IN ('owner', 'admin')
  )
);

-- 2. Create audit trigger for social posts
CREATE OR REPLACE FUNCTION public.audit_social_post_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.domain_events (
      workspace_id, event_type, aggregate_type, aggregate_id, actor_id, payload, created_at
    ) VALUES (
      NEW.workspace_id, 'social_post.created', 'social_post', NEW.id, auth.uid(),
      jsonb_build_object('platform', NEW.platform, 'content_type', NEW.content_type, 'status', NEW.status),
      now()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.domain_events (
        workspace_id, event_type, aggregate_type, aggregate_id, actor_id, payload, created_at
      ) VALUES (
        NEW.workspace_id, 'social_post.' || NEW.status, 'social_post', NEW.id, auth.uid(),
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'platform', NEW.platform),
        now()
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.domain_events (
      workspace_id, event_type, aggregate_type, aggregate_id, actor_id, payload, created_at
    ) VALUES (
      OLD.workspace_id, 'social_post.deleted', 'social_post', OLD.id, auth.uid(),
      jsonb_build_object('platform', OLD.platform, 'status', OLD.status),
      now()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_social_posts ON public.social_posts;
CREATE TRIGGER audit_social_posts
  AFTER INSERT OR UPDATE OR DELETE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.audit_social_post_changes();

-- 3. Set default for created_by
ALTER TABLE public.social_posts ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_social_posts_card_id ON public.social_posts(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_client_id ON public.social_posts(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON public.social_posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_workspace_status ON public.social_posts(workspace_id, status);
