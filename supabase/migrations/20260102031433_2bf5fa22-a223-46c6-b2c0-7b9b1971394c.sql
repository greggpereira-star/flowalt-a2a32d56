-- =============================================
-- TABELAS DE USUÁRIO - Operações CRUD necessárias
-- =============================================

-- view_templates - falta UPDATE/DELETE (usando has_role)
CREATE POLICY "view_templates_update_policy"
ON public.view_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = view_templates.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "view_templates_delete_policy"
ON public.view_templates
FOR DELETE
USING (
  has_role(auth.uid(), view_templates.workspace_id, 'owner') 
  OR has_role(auth.uid(), view_templates.workspace_id, 'admin')
  OR has_role(auth.uid(), view_templates.workspace_id, 'coordinator')
);

-- email_notifications - falta DELETE
CREATE POLICY "email_notifications_delete_policy"
ON public.email_notifications
FOR DELETE
USING (
  has_role(auth.uid(), email_notifications.workspace_id, 'owner') 
  OR has_role(auth.uid(), email_notifications.workspace_id, 'admin')
);

-- user_goal_progress - falta DELETE
CREATE POLICY "user_goal_progress_delete_policy"
ON public.user_goal_progress
FOR DELETE
USING (user_id = auth.uid());

-- user_onboarding - falta DELETE
CREATE POLICY "user_onboarding_delete_policy"
ON public.user_onboarding
FOR DELETE
USING (user_id = auth.uid());

-- internal_feedback - falta UPDATE/DELETE
CREATE POLICY "internal_feedback_update_policy"
ON public.internal_feedback
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "internal_feedback_delete_policy"
ON public.internal_feedback
FOR DELETE
USING (user_id = auth.uid());