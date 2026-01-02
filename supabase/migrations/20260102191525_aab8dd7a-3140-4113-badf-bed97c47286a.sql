-- =============================================
-- FIX: financial_categories INSERT policy
-- During workspace creation, user is not yet admin
-- =============================================

-- Add policy for users to insert categories in their workspace
CREATE POLICY "Users can insert categories in own workspace"
ON public.financial_categories
FOR INSERT
TO authenticated
WITH CHECK (
  -- User is member of the workspace (just created)
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = financial_categories.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  OR
  -- Or user is about to become owner (check if they own the workspace)
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.workspace_id = financial_categories.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role = 'owner'
  )
);