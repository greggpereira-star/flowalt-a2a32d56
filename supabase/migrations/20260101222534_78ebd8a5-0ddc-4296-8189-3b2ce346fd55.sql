
-- FLOWALT SECURITY HARDENING - PART 3 (Final - Correct enum values)

-- =====================================================
-- 5. COLLABORATOR_DETAILS - Reforçar proteção (SEC-2)
-- =====================================================

DROP POLICY IF EXISTS "collaborator_details_select_restricted" ON public.collaborator_details;
DROP POLICY IF EXISTS "collaborator_details_select_sensitive" ON public.collaborator_details;
DROP POLICY IF EXISTS "Workspace members can view collaborators" ON public.collaborator_details;

CREATE POLICY "collaborator_details_select_strict" ON public.collaborator_details
FOR SELECT USING (
  -- O próprio colaborador
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.id = collaborator_details.member_id
    AND wm.user_id = auth.uid()
  )
  -- OU tem acesso financeiro sensível
  OR can_view_sensitive_financial(auth.uid(), workspace_id)
  -- OU Super Admin com sessão ativa
  OR is_super_admin_with_session(auth.uid(), workspace_id)
);

DROP POLICY IF EXISTS "collaborator_details_update" ON public.collaborator_details;
DROP POLICY IF EXISTS "Admins can manage collaborators" ON public.collaborator_details;
CREATE POLICY "collaborator_details_update_restricted" ON public.collaborator_details
FOR UPDATE USING (can_view_sensitive_financial(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "collaborator_details_insert" ON public.collaborator_details;
CREATE POLICY "collaborator_details_insert_restricted" ON public.collaborator_details
FOR INSERT WITH CHECK (can_view_sensitive_financial(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "collaborator_details_delete" ON public.collaborator_details;
CREATE POLICY "collaborator_details_delete_owner" ON public.collaborator_details
FOR DELETE USING (has_role(auth.uid(), workspace_id, 'owner'::app_role));

-- =====================================================
-- 6. Atualizar can_view_sensitive_financial com roles corretos
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_view_sensitive_financial(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p_user_id
    AND ur.workspace_id = p_workspace_id
    AND ur.role IN ('owner'::app_role, 'admin'::app_role, 'finance'::app_role)
  )
  OR is_super_admin_with_session(p_user_id, p_workspace_id)
$$;

-- =====================================================
-- 7. Comentários
-- =====================================================

COMMENT ON POLICY "collaborator_details_select_strict" ON public.collaborator_details IS 
'Dados sensíveis (salário, CPF) só visíveis para o próprio colaborador ou roles com acesso financeiro (owner/admin/finance)';
