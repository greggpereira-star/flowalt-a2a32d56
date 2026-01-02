
-- ============================================================
-- SECURITY FIX: folder_templates - Exigir autenticação
-- ============================================================

-- Remover política permissiva
DROP POLICY IF EXISTS "Users can view folder templates" ON public.folder_templates;

-- Criar política segura que exige autenticação
CREATE POLICY "folder_templates_select_authenticated"
ON public.folder_templates FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Templates de sistema (workspace_id NULL) visíveis para usuários autenticados
    workspace_id IS NULL 
    OR 
    -- Templates de workspace visíveis apenas para membros
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);
