-- =====================================================
-- ETAPA 15.2: AUDITORIA NATIVA AUTOMÁTICA (CORRIGIDO)
-- =====================================================

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_action TEXT;
BEGIN
  -- Determinar workspace_id baseado na tabela
  IF TG_TABLE_NAME = 'cards' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'transactions' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'workspace_members' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'api_keys' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'webhook_subscriptions' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'feature_flags' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'collaborator_details' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'sprints' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSE
    v_workspace_id := NULL;
  END IF;

  -- Se não conseguir workspace_id, não auditar
  IF v_workspace_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determinar ação
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  END IF;

  -- Inserir log de auditoria
  INSERT INTO public.audit_logs (
    workspace_id,
    user_id,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data,
    metadata
  ) VALUES (
    v_workspace_id,
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_data,
    v_new_data,
    jsonb_build_object(
      'trigger_name', TG_NAME,
      'trigger_when', TG_WHEN,
      'timestamp', now()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Função especial para cards (audita apenas mudanças críticas)
CREATE OR REPLACE FUNCTION public.audit_cards_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Para INSERT e DELETE, sempre auditar
  IF TG_OP IN ('INSERT', 'DELETE') THEN
    RETURN public.audit_trigger_function();
  END IF;
  
  -- Para UPDATE, só auditar mudanças críticas
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR
       OLD.briefing_data IS DISTINCT FROM NEW.briefing_data OR
       OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      RETURN public.audit_trigger_function();
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers para tabelas críticas (sem WHEN clause)

-- Auditoria de cards
DROP TRIGGER IF EXISTS audit_cards_trigger ON public.cards;
CREATE TRIGGER audit_cards_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.cards
FOR EACH ROW
EXECUTE FUNCTION public.audit_cards_function();

-- Auditoria de transações financeiras
DROP TRIGGER IF EXISTS audit_transactions_trigger ON public.transactions;
CREATE TRIGGER audit_transactions_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- Auditoria de membros do workspace
DROP TRIGGER IF EXISTS audit_workspace_members_trigger ON public.workspace_members;
CREATE TRIGGER audit_workspace_members_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- Auditoria de roles/permissões
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON public.user_roles;
CREATE TRIGGER audit_user_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- Auditoria de API keys
DROP TRIGGER IF EXISTS audit_api_keys_trigger ON public.api_keys;
CREATE TRIGGER audit_api_keys_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- Auditoria de webhooks
DROP TRIGGER IF EXISTS audit_webhooks_trigger ON public.webhook_subscriptions;
CREATE TRIGGER audit_webhooks_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.webhook_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- Auditoria de feature flags
DROP TRIGGER IF EXISTS audit_feature_flags_trigger ON public.feature_flags;
CREATE TRIGGER audit_feature_flags_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- Auditoria de detalhes de colaboradores
DROP TRIGGER IF EXISTS audit_collaborator_details_trigger ON public.collaborator_details;
CREATE TRIGGER audit_collaborator_details_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.collaborator_details
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- Auditoria de sprints
DROP TRIGGER IF EXISTS audit_sprints_trigger ON public.sprints;
CREATE TRIGGER audit_sprints_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sprints
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_function();

-- =====================================================
-- ETAPA 15.4: LOGS DE ACESSO SENSÍVEL
-- =====================================================

-- Criar tabela de logs de acesso se não existir
CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  access_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_access_logs_workspace ON public.access_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON public.access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_type ON public.access_logs(access_type);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.access_logs(created_at DESC);

-- RLS para access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view access logs" ON public.access_logs;
CREATE POLICY "Super admins can view access logs"
ON public.access_logs FOR SELECT
USING (has_admin_access(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "System can insert access logs" ON public.access_logs;
CREATE POLICY "System can insert access logs"
ON public.access_logs FOR INSERT
WITH CHECK (true);

-- Índices adicionais para auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_id);