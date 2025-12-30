-- Tabela para logs de consumo de API
CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer,
  request_size integer,
  response_size integer,
  user_agent text,
  ip_address text,
  correlation_id text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index para queries comuns
CREATE INDEX idx_api_logs_workspace_created ON api_logs(workspace_id, created_at DESC);
CREATE INDEX idx_api_logs_api_key ON api_logs(api_key_id, created_at DESC);
CREATE INDEX idx_api_logs_correlation ON api_logs(correlation_id) WHERE correlation_id IS NOT NULL;

-- RLS para api_logs
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view API logs"
ON api_logs FOR SELECT
USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "System can insert API logs"
ON api_logs FOR INSERT
WITH CHECK (true);

-- Tabela para feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer DEFAULT 100,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, flag_key)
);

-- RLS para feature_flags
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view feature flags"
ON feature_flags FOR SELECT
USING (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage feature flags"
ON feature_flags FOR ALL
USING (workspace_id IS NULL OR has_admin_access(auth.uid(), workspace_id));

-- Tabela para métricas de uso por módulo
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  module text NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_metrics_workspace ON usage_metrics(workspace_id, module, created_at DESC);
CREATE INDEX idx_usage_metrics_user ON usage_metrics(user_id, created_at DESC);

-- RLS para usage_metrics
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view usage metrics"
ON usage_metrics FOR SELECT
USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "System can insert usage metrics"
ON usage_metrics FOR INSERT
WITH CHECK (true);

-- Função para registrar uso de módulo
CREATE OR REPLACE FUNCTION log_module_usage(
  p_workspace_id uuid,
  p_user_id uuid,
  p_module text,
  p_action text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO usage_metrics (workspace_id, user_id, module, action, metadata)
  VALUES (p_workspace_id, p_user_id, p_module, p_action, p_metadata);
END;
$$;

-- Rate limit configurável por workspace (expandindo api_keys)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer DEFAULT 100;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_hour integer DEFAULT 1000;

-- Adicionar event_version aos webhook_deliveries para compatibilidade futura
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS event_version text DEFAULT 'v1';