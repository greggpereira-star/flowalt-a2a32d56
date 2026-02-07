-- Drop existing INSERT policy
DROP POLICY IF EXISTS "notifications_insert_service_or_self" ON public.notifications;

-- Create new INSERT policy that allows workspace members to create notifications for other members
CREATE POLICY "notifications_insert_workspace_member"
ON public.notifications
FOR INSERT
WITH CHECK (
  -- Service role can always insert
  (current_setting('role'::text, true) = 'service_role'::text) 
  OR 
  -- User can insert notification for themselves
  (user_id = auth.uid())
  OR
  -- User can insert notification for other members if they share the same workspace
  (
    EXISTS (
      SELECT 1 FROM workspace_members wm1
      WHERE wm1.workspace_id = notifications.workspace_id
      AND wm1.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM workspace_members wm2
      WHERE wm2.workspace_id = notifications.workspace_id
      AND wm2.user_id = notifications.user_id
    )
  )
);