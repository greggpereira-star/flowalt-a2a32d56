
-- ============================================================
-- SECURITY FIX: Corrigir exposição pública de dados sensíveis
-- ============================================================

-- 1. SYSTEM_METRICS: Remover políticas muito permissivas e manter apenas as corretas
DROP POLICY IF EXISTS "Service can insert metrics" ON public.system_metrics;
DROP POLICY IF EXISTS "System can insert metrics" ON public.system_metrics;
DROP POLICY IF EXISTS "Admins can read system metrics" ON public.system_metrics;
DROP POLICY IF EXISTS "Admins can view system metrics" ON public.system_metrics;
DROP POLICY IF EXISTS "Users can view metrics from their workspace" ON public.system_metrics;
DROP POLICY IF EXISTS "Users can insert metrics to their workspace" ON public.system_metrics;

-- Criar políticas seguras para system_metrics
CREATE POLICY "system_metrics_select_authenticated"
ON public.system_metrics FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    workspace_id IS NULL 
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "system_metrics_insert_authenticated"
ON public.system_metrics FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    workspace_id IS NULL 
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

-- 2. USER_LEVELS: Remover política muito permissiva
DROP POLICY IF EXISTS "System can manage levels" ON public.user_levels;
DROP POLICY IF EXISTS "Members can view workspace levels" ON public.user_levels;
DROP POLICY IF EXISTS "Users can view their own level" ON public.user_levels;

-- Criar políticas seguras para user_levels
CREATE POLICY "user_levels_select_own"
ON public.user_levels FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "user_levels_insert_own"
ON public.user_levels FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
  AND workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "user_levels_update_own"
ON public.user_levels FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- 3. Recriar as VIEWs com SECURITY INVOKER (herdam RLS da tabela base)
DROP VIEW IF EXISTS public.api_keys_safe;
CREATE VIEW public.api_keys_safe 
WITH (security_invoker = true)
AS SELECT 
  id,
  workspace_id,
  name,
  key_prefix,
  permissions,
  is_active,
  last_used_at,
  expires_at,
  created_by,
  created_at,
  updated_at,
  rate_limit_per_minute,
  rate_limit_per_hour
FROM api_keys;

DROP VIEW IF EXISTS public.webhook_subscriptions_safe;
CREATE VIEW public.webhook_subscriptions_safe 
WITH (security_invoker = true)
AS SELECT 
  id,
  workspace_id,
  name,
  url,
  events,
  is_active,
  created_by,
  created_at,
  updated_at,
  '***MASKED***'::text AS secret
FROM webhook_subscriptions;

-- Garantir grants corretos nas views
GRANT SELECT ON public.api_keys_safe TO authenticated;
GRANT SELECT ON public.webhook_subscriptions_safe TO authenticated;
