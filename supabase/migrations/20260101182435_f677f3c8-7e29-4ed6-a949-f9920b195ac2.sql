
-- Corrigir policy de SELECT para workspace_members
-- O problema é que precisa permitir que o usuário veja SUAS PRÓPRIAS entradas
-- não apenas entradas de workspaces onde já é membro

-- Remover a policy atual
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;

-- Criar policy correta:
-- 1. Usuário pode ver suas próprias entradas (para descobrir de quais workspaces é membro)
-- 2. Membros podem ver outros membros do mesmo workspace
CREATE POLICY "Users can view own memberships and workspace members" 
ON public.workspace_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  is_workspace_member(auth.uid(), workspace_id)
);
