-- ============================================================
-- SISTEMA DE NOTIFICAÇÕES POR E-MAIL - FLOWALT
-- ============================================================

-- 1. Tabela de log de emails (auditoria)
CREATE TABLE IF NOT EXISTS public.email_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id UUID,
  email TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  template_version TEXT DEFAULT '1.0',
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  resend_id TEXT,
  correlation_id TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_email_log_workspace ON public.email_notifications_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_log_user ON public.email_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON public.email_notifications_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON public.email_notifications_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_notifications_log(created_at DESC);

-- 2. Tabela de preferências de notificação por usuário
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  -- Categorias de notificação (true = ativado)
  notify_authentication BOOLEAN NOT NULL DEFAULT true,
  notify_workspace BOOLEAN NOT NULL DEFAULT true,
  notify_cards BOOLEAN NOT NULL DEFAULT true,
  notify_governance BOOLEAN NOT NULL DEFAULT true,
  notify_gamification BOOLEAN NOT NULL DEFAULT true,
  notify_system BOOLEAN NOT NULL DEFAULT true,
  -- Preferências específicas que NÃO podem ser desativadas (segurança)
  -- password_reset, password_changed, email_confirmation são sempre enviados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Índice para busca por usuário
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.user_notification_preferences(user_id);

-- 3. RLS para email_notifications_log
ALTER TABLE public.email_notifications_log ENABLE ROW LEVEL SECURITY;

-- Admins e owners podem ver logs do workspace
CREATE POLICY "email_log_select_workspace_admin"
ON public.email_notifications_log FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Próprio email
    user_id = auth.uid()
    OR
    -- Admin/Owner do workspace (usando user_roles)
    (
      workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.workspace_id = email_notifications_log.workspace_id
        AND ur.role IN ('owner', 'admin')
      )
    )
  )
);

-- Sistema pode inserir (via service role)
CREATE POLICY "email_log_insert_service"
ON public.email_notifications_log FOR INSERT
WITH CHECK (true);

-- 4. RLS para user_notification_preferences
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas suas próprias preferências
CREATE POLICY "notification_prefs_select_own"
ON public.user_notification_preferences FOR SELECT
USING (auth.uid() = user_id);

-- Usuários podem inserir suas próprias preferências
CREATE POLICY "notification_prefs_insert_own"
ON public.user_notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias preferências
CREATE POLICY "notification_prefs_update_own"
ON public.user_notification_preferences FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Trigger para updated_at em preferências
CREATE OR REPLACE FUNCTION public.update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_prefs_updated_at ON public.user_notification_preferences;
CREATE TRIGGER trigger_notification_prefs_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_prefs_updated_at();

-- 6. Função para verificar se usuário quer receber notificação de uma categoria
CREATE OR REPLACE FUNCTION public.user_wants_notification(
  p_user_id UUID,
  p_category TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs user_notification_preferences%ROWTYPE;
  v_wants BOOLEAN;
BEGIN
  -- Buscar preferências do usuário
  SELECT * INTO v_prefs
  FROM user_notification_preferences
  WHERE user_id = p_user_id;
  
  -- Se não tem preferências, assume que quer receber tudo
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Verificar categoria
  CASE p_category
    WHEN 'authentication' THEN v_wants := v_prefs.notify_authentication;
    WHEN 'workspace' THEN v_wants := v_prefs.notify_workspace;
    WHEN 'cards' THEN v_wants := v_prefs.notify_cards;
    WHEN 'governance' THEN v_wants := v_prefs.notify_governance;
    WHEN 'gamification' THEN v_wants := v_prefs.notify_gamification;
    WHEN 'system' THEN v_wants := v_prefs.notify_system;
    ELSE v_wants := true; -- Categoria desconhecida = enviar
  END CASE;
  
  RETURN v_wants;
END;
$$;

-- Comentários de documentação
COMMENT ON TABLE public.email_notifications_log IS 'Log de todas as notificações por email enviadas pelo sistema';
COMMENT ON TABLE public.user_notification_preferences IS 'Preferências de notificação por email de cada usuário';
COMMENT ON FUNCTION public.user_wants_notification IS 'Verifica se usuário quer receber notificação de uma categoria específica';