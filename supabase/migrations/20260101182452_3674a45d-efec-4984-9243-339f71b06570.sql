
-- Corrigir policy de SELECT para user_roles
-- Permite que o usuário veja sua própria role ou roles de membros do mesmo workspace

-- Remover a policy atual
DROP POLICY IF EXISTS "Users can view roles in their workspaces" ON public.user_roles;

-- Criar policy correta
CREATE POLICY "Users can view own role and workspace roles" 
ON public.user_roles 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  is_workspace_member(auth.uid(), workspace_id)
);
