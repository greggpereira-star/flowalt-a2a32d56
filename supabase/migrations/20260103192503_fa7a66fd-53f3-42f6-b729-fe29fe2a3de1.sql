
-- =====================================================
-- SMOKE TEST FIX: RLS para social_platforms com roles
-- =====================================================

-- Dropar policies antigas que permitem acesso amplo demais
DROP POLICY IF EXISTS "Users can insert social platforms in their workspace" ON public.social_platforms;
DROP POLICY IF EXISTS "Users can update social platforms in their workspace" ON public.social_platforms;
DROP POLICY IF EXISTS "Users can delete social platforms in their workspace" ON public.social_platforms;

-- Criar novas policies com validação de role elevado

-- INSERT: apenas owner, admin, coordinator podem conectar plataformas
CREATE POLICY "Elevated roles can insert social platforms"
ON public.social_platforms
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.workspace_id = social_platforms.workspace_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin', 'coordinator')
  )
);

-- UPDATE: apenas owner, admin, coordinator podem atualizar
CREATE POLICY "Elevated roles can update social platforms"
ON public.social_platforms
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.workspace_id = social_platforms.workspace_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin', 'coordinator')
  )
);

-- DELETE: apenas owner, admin podem deletar
CREATE POLICY "Elevated roles can delete social platforms"
ON public.social_platforms
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.workspace_id = social_platforms.workspace_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- =====================================================
-- Adicionar coluna used_at em oauth_states para prevenir replay
-- =====================================================
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS used_at timestamptz DEFAULT NULL;

-- Index para busca eficiente
CREATE INDEX IF NOT EXISTS idx_oauth_states_used ON oauth_states(state) WHERE used_at IS NULL;
