-- =============================================
-- ENTITLEMENT REGISTRY - COMPLETE (SINGLE MIGRATION)
-- =============================================

-- Drop existing conflicting objects first
DROP FUNCTION IF EXISTS public.has_entitlement(uuid, text);
DROP FUNCTION IF EXISTS public.resolve_entitlement(uuid, text);
DROP FUNCTION IF EXISTS public.within_limit(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.enforce_entitlement(uuid, text, numeric, text, uuid);
DROP VIEW IF EXISTS public.workspace_entitlements_effective;

-- A1) Tabela entitlement_registry (catálogo)
CREATE TABLE IF NOT EXISTS public.entitlement_registry (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'core',
  type TEXT NOT NULL DEFAULT 'boolean' CHECK (type IN ('boolean', 'limit', 'tiered_limit')),
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  default_limit NUMERIC,
  unit TEXT,
  enforcement_scope TEXT NOT NULL DEFAULT 'workspace' CHECK (enforcement_scope IN ('workspace', 'user', 'resource')),
  ui_visibility TEXT NOT NULL DEFAULT 'paywall' CHECK (ui_visibility IN ('hidden', 'disabled', 'paywall', 'visible')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A2) Tabela plan_entitlements (matriz por plano)
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL CHECK (plan_key IN ('free', 'pro', 'enterprise')),
  entitlement_key TEXT NOT NULL REFERENCES public.entitlement_registry(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  limit_value NUMERIC,
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_key, entitlement_key)
);

-- A3) Tabela workspace_entitlement_overrides (override por workspace)
CREATE TABLE IF NOT EXISTS public.workspace_entitlement_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL REFERENCES public.entitlement_registry(key) ON DELETE CASCADE,
  enabled_override BOOLEAN,
  limit_override NUMERIC,
  expires_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, entitlement_key)
);

-- C2) Tabela entitlement_audit (auditoria de bloqueios)
CREATE TABLE IF NOT EXISTS public.entitlement_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  entitlement_key TEXT NOT NULL,
  action TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  current_value NUMERIC,
  limit_value NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entitlement_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view entitlement registry" ON public.entitlement_registry;
CREATE POLICY "Authenticated users can view entitlement registry"
  ON public.entitlement_registry FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view plan entitlements" ON public.plan_entitlements;
CREATE POLICY "Authenticated users can view plan entitlements"
  ON public.plan_entitlements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Workspace members can view overrides" ON public.workspace_entitlement_overrides;
CREATE POLICY "Workspace members can view overrides"
  ON public.workspace_entitlement_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_entitlement_overrides.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can manage overrides" ON public.workspace_entitlement_overrides;
CREATE POLICY "Owners can manage overrides"
  ON public.workspace_entitlement_overrides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.user_roles ur ON ur.user_id = wm.user_id AND ur.workspace_id = wm.workspace_id WHERE wm.workspace_id = workspace_entitlement_overrides.workspace_id AND wm.user_id = auth.uid() AND ur.role = 'owner'));

DROP POLICY IF EXISTS "Workspace admins can view audit" ON public.entitlement_audit;
CREATE POLICY "Workspace admins can view audit"
  ON public.entitlement_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.user_roles ur ON ur.user_id = wm.user_id AND ur.workspace_id = wm.workspace_id WHERE wm.workspace_id = entitlement_audit.workspace_id AND wm.user_id = auth.uid() AND ur.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.entitlement_audit;
CREATE POLICY "System can insert audit logs"
  ON public.entitlement_audit FOR INSERT TO authenticated WITH CHECK (true);

-- SEED Registry
INSERT INTO public.entitlement_registry (key, name, description, category, type, default_enabled, default_limit, unit, enforcement_scope, ui_visibility) VALUES
('audit_logs', 'Logs de Auditoria', 'Acesso a logs de auditoria detalhados', 'governance', 'boolean', false, null, null, 'workspace', 'paywall'),
('break_glass_support', 'Suporte Break-Glass', 'Sessões de suporte emergencial', 'governance', 'boolean', false, null, null, 'workspace', 'paywall'),
('advanced_rls_diagnostics', 'Diagnóstico RLS Avançado', 'Ferramentas de diagnóstico de segurança', 'security', 'boolean', false, null, null, 'workspace', 'paywall'),
('integrations_access', 'Acesso a Integrações', 'Acesso ao módulo de integrações', 'integrations', 'boolean', false, null, null, 'workspace', 'paywall'),
('api_keys_limit', 'Limite de API Keys', 'Máximo de API Keys', 'integrations', 'limit', true, 0, 'api_keys', 'workspace', 'paywall'),
('webhooks_limit', 'Limite de Webhooks', 'Máximo de webhooks', 'integrations', 'limit', true, 0, 'webhooks', 'workspace', 'paywall'),
('webhook_replay', 'Replay de Webhooks', 'Reenviar webhooks falhados', 'integrations', 'boolean', false, null, null, 'workspace', 'paywall'),
('events_stream', 'Stream de Eventos', 'Stream de eventos em tempo real', 'integrations', 'boolean', false, null, null, 'workspace', 'paywall'),
('members_limit', 'Limite de Membros', 'Máximo de membros', 'core', 'limit', true, 3, 'members', 'workspace', 'paywall'),
('spaces_limit', 'Limite de Espaços', 'Máximo de espaços', 'core', 'limit', true, 2, 'spaces', 'workspace', 'paywall'),
('storage_limit', 'Limite de Armazenamento', 'Limite em MB', 'core', 'limit', true, 100, 'mb', 'workspace', 'paywall'),
('automations_access', 'Acesso a Automações', 'Acesso ao módulo de automações', 'automation', 'boolean', false, null, null, 'workspace', 'paywall'),
('automations_limit', 'Limite de Automações', 'Máximo de automações', 'automation', 'limit', true, 0, 'automations', 'workspace', 'paywall')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();

-- SEED Free Plan
INSERT INTO public.plan_entitlements (plan_key, entitlement_key, enabled, limit_value) VALUES
('free', 'audit_logs', false, null), ('free', 'break_glass_support', false, null), ('free', 'advanced_rls_diagnostics', false, null),
('free', 'integrations_access', false, null), ('free', 'api_keys_limit', false, 0), ('free', 'webhooks_limit', false, 0),
('free', 'webhook_replay', false, null), ('free', 'events_stream', false, null), ('free', 'members_limit', true, 3),
('free', 'spaces_limit', true, 2), ('free', 'storage_limit', true, 100), ('free', 'automations_access', false, null), ('free', 'automations_limit', false, 0)
ON CONFLICT (plan_key, entitlement_key) DO UPDATE SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value, updated_at = now();

-- SEED Pro Plan
INSERT INTO public.plan_entitlements (plan_key, entitlement_key, enabled, limit_value) VALUES
('pro', 'audit_logs', false, null), ('pro', 'break_glass_support', false, null), ('pro', 'advanced_rls_diagnostics', false, null),
('pro', 'integrations_access', true, null), ('pro', 'api_keys_limit', true, 5), ('pro', 'webhooks_limit', true, 10),
('pro', 'webhook_replay', false, null), ('pro', 'events_stream', false, null), ('pro', 'members_limit', true, 15),
('pro', 'spaces_limit', true, 10), ('pro', 'storage_limit', true, 5000), ('pro', 'automations_access', true, null), ('pro', 'automations_limit', true, 20)
ON CONFLICT (plan_key, entitlement_key) DO UPDATE SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value, updated_at = now();

-- SEED Enterprise Plan
INSERT INTO public.plan_entitlements (plan_key, entitlement_key, enabled, limit_value) VALUES
('enterprise', 'audit_logs', true, null), ('enterprise', 'break_glass_support', true, null), ('enterprise', 'advanced_rls_diagnostics', true, null),
('enterprise', 'integrations_access', true, null), ('enterprise', 'api_keys_limit', true, 50), ('enterprise', 'webhooks_limit', true, 100),
('enterprise', 'webhook_replay', true, null), ('enterprise', 'events_stream', true, null), ('enterprise', 'members_limit', true, 500),
('enterprise', 'spaces_limit', true, 100), ('enterprise', 'storage_limit', true, 50000), ('enterprise', 'automations_access', true, null), ('enterprise', 'automations_limit', true, 200)
ON CONFLICT (plan_key, entitlement_key) DO UPDATE SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value, updated_at = now();

-- Create VIEW
CREATE VIEW public.workspace_entitlements_effective AS
SELECT 
  wp.workspace_id, er.key as entitlement_key, er.name, er.description, er.category, er.type, er.unit, er.enforcement_scope, er.ui_visibility,
  wp.plan_tier::TEXT as plan_key,
  COALESCE(weo.enabled_override, pe.enabled, er.default_enabled) as enabled,
  COALESCE(weo.limit_override, pe.limit_value, er.default_limit) as limit_value,
  CASE WHEN weo.id IS NOT NULL AND (weo.expires_at IS NULL OR weo.expires_at > now()) THEN 'override' WHEN pe.id IS NOT NULL THEN 'plan' ELSE 'default' END as source,
  weo.expires_at as override_expires_at, weo.reason as override_reason
FROM public.workspace_plans wp
CROSS JOIN public.entitlement_registry er
LEFT JOIN public.plan_entitlements pe ON pe.plan_key = wp.plan_tier::TEXT AND pe.entitlement_key = er.key
LEFT JOIN public.workspace_entitlement_overrides weo ON weo.workspace_id = wp.workspace_id AND weo.entitlement_key = er.key AND (weo.expires_at IS NULL OR weo.expires_at > now());

-- Functions
CREATE FUNCTION public.resolve_entitlement(p_workspace_id UUID, p_entitlement_key TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB; v_effective RECORD;
BEGIN
  SELECT * INTO v_effective FROM public.workspace_entitlements_effective WHERE workspace_id = p_workspace_id AND entitlement_key = p_entitlement_key;
  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.entitlement_registry WHERE key = p_entitlement_key) THEN
      RETURN jsonb_build_object('enabled', false, 'limit', null, 'plan_key', null, 'source', 'unknown', 'ui_visibility', 'hidden', 'reason_code', 'ENTITLEMENT_NOT_FOUND');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.workspace_plans WHERE workspace_id = p_workspace_id) THEN
      RETURN jsonb_build_object('enabled', false, 'limit', null, 'plan_key', null, 'source', 'default', 'ui_visibility', 'paywall', 'reason_code', 'NO_PLAN');
    END IF;
  END IF;
  v_result := jsonb_build_object('enabled', COALESCE(v_effective.enabled, false), 'limit', v_effective.limit_value, 'plan_key', v_effective.plan_key, 'source', v_effective.source, 'ui_visibility', v_effective.ui_visibility, 'reason_code', CASE WHEN v_effective.enabled = false THEN 'DISABLED' WHEN v_effective.source = 'override' AND v_effective.override_expires_at IS NOT NULL THEN 'OVERRIDE_ACTIVE' ELSE 'OK' END, 'type', v_effective.type, 'unit', v_effective.unit);
  RETURN v_result;
END; $$;

CREATE FUNCTION public.has_entitlement(p_workspace_id UUID, p_entitlement_key TEXT) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN COALESCE((public.resolve_entitlement(p_workspace_id, p_entitlement_key)->>'enabled')::BOOLEAN, false); END; $$;

CREATE FUNCTION public.within_limit(p_workspace_id UUID, p_entitlement_key TEXT, p_current_value NUMERIC DEFAULT 0) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_resolved JSONB; v_limit NUMERIC; v_enabled BOOLEAN; v_remaining NUMERIC; v_within BOOLEAN;
BEGIN
  v_resolved := public.resolve_entitlement(p_workspace_id, p_entitlement_key);
  v_enabled := COALESCE((v_resolved->>'enabled')::BOOLEAN, false);
  v_limit := (v_resolved->>'limit')::NUMERIC;
  IF NOT v_enabled THEN RETURN jsonb_build_object('within', false, 'limit', v_limit, 'current_value', p_current_value, 'remaining', 0, 'blocked_reason', 'DISABLED'); END IF;
  IF v_limit IS NULL THEN RETURN jsonb_build_object('within', true, 'limit', null, 'current_value', p_current_value, 'remaining', null, 'blocked_reason', null); END IF;
  v_remaining := GREATEST(0, v_limit - p_current_value);
  v_within := p_current_value < v_limit;
  RETURN jsonb_build_object('within', v_within, 'limit', v_limit, 'current_value', p_current_value, 'remaining', v_remaining, 'blocked_reason', CASE WHEN NOT v_within THEN 'PLAN_LIMIT' ELSE null END);
END; $$;

CREATE FUNCTION public.enforce_entitlement(p_workspace_id UUID, p_entitlement_key TEXT, p_current_value NUMERIC DEFAULT 0, p_action TEXT DEFAULT 'access', p_user_id UUID DEFAULT NULL) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_within JSONB; v_blocked_reason TEXT;
BEGIN
  v_within := public.within_limit(p_workspace_id, p_entitlement_key, p_current_value);
  v_blocked_reason := v_within->>'blocked_reason';
  IF v_blocked_reason IS NOT NULL THEN
    INSERT INTO public.entitlement_audit (workspace_id, user_id, entitlement_key, action, reason_code, current_value, limit_value) VALUES (p_workspace_id, COALESCE(p_user_id, auth.uid()), p_entitlement_key, p_action, v_blocked_reason, p_current_value, (v_within->>'limit')::NUMERIC);
    RAISE EXCEPTION 'ENTITLEMENT_BLOCKED: % - %', p_entitlement_key, v_blocked_reason USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END; $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_plan_key ON public.plan_entitlements(plan_key);
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_entitlement_key ON public.plan_entitlements(entitlement_key);
CREATE INDEX IF NOT EXISTS idx_workspace_entitlement_overrides_workspace ON public.workspace_entitlement_overrides(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_audit_workspace ON public.entitlement_audit(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_audit_created ON public.entitlement_audit(created_at DESC);