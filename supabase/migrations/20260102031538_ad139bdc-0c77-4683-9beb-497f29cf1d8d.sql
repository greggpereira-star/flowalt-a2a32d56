-- =============================================
-- Políticas DELETE faltantes para tabelas críticas
-- =============================================

-- profiles - Usuário pode deletar seu próprio perfil (para exclusão de conta)
CREATE POLICY "profiles_delete_policy"
ON public.profiles
FOR DELETE
USING (id = auth.uid());

-- workspaces - Apenas owner pode deletar workspace
CREATE POLICY "workspaces_delete_policy"
ON public.workspaces
FOR DELETE
USING (
  has_role(auth.uid(), id, 'owner')
);

-- workspace_plans - Apenas super_admin pode deletar planos
CREATE POLICY "workspace_plans_delete_policy"
ON public.workspace_plans
FOR DELETE
USING (is_platform_super_admin(auth.uid()));

-- user_badges - Sistema pode precisar remover badges (via service role) 
-- mas usuário não deve poder deletar seus próprios badges
-- Deixamos apenas para super_admin como fallback
CREATE POLICY "user_badges_delete_policy"
ON public.user_badges
FOR DELETE
USING (is_platform_super_admin(auth.uid()));