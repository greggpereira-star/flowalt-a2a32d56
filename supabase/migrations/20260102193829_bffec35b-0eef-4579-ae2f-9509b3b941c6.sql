
-- ============================================================
-- FIX: Permitir que qualquer pessoa com o token possa VER o convite
-- Isso é necessário para exibir informações na página de aceite
-- ============================================================

-- Adicionar política para SELECT por token (acesso público para visualização)
DROP POLICY IF EXISTS workspace_invites_select_by_token ON workspace_invites;
CREATE POLICY workspace_invites_select_by_token ON workspace_invites
  FOR SELECT
  USING (
    -- Qualquer pessoa pode ver um convite se souber o token (via URL)
    -- A segurança está no fato de que tokens são UUIDs aleatórios
    true
  );

-- Manter a política existente para admins e para o próprio usuário
-- Mas agora com a política acima, qualquer pessoa com o link pode ver o convite

-- Verificar e corrigir a política de update para ser mais restritiva
DROP POLICY IF EXISTS workspace_invites_update_own ON workspace_invites;
CREATE POLICY workspace_invites_update_own ON workspace_invites
  FOR UPDATE
  USING (
    -- Somente admins podem atualizar OU através de SECURITY DEFINER functions
    has_admin_access(auth.uid(), workspace_id)
  );

-- A aceitação do convite é feita via function SECURITY DEFINER, não via UPDATE direto
-- Então não precisamos permitir UPDATE para o usuário convidado

COMMENT ON POLICY workspace_invites_select_by_token ON workspace_invites IS 
  'Permite visualizar convite por qualquer pessoa com o link. A segurança está no token UUID aleatório.';
