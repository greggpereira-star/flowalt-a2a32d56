-- Fix notifications INSERT RLS policy (use NEW row columns, not table-qualified refs)
DROP POLICY IF EXISTS "notifications_insert_workspace_member" ON public.notifications;

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
  -- User can insert notification for other members if both are active members in the same workspace
  (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm1
      WHERE wm1.workspace_id = workspace_id
        AND wm1.user_id = auth.uid()
        AND COALESCE(wm1.is_active, true) = true
    )
    AND
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm2
      WHERE wm2.workspace_id = workspace_id
        AND wm2.user_id = user_id
        AND COALESCE(wm2.is_active, true) = true
    )
  )
);