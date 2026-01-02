-- ENTITLEMENT AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.entitlement_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  entitlement_key TEXT NOT NULL,
  action TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  current_value INTEGER,
  limit_value INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entitlement_audit_workspace ON public.entitlement_audit(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_audit_created ON public.entitlement_audit(created_at DESC);

ALTER TABLE public.entitlement_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all audit logs" ON public.entitlement_audit
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.platform_super_admins WHERE user_id = auth.uid()));

CREATE POLICY "Workspace admins can view their audit logs" ON public.entitlement_audit
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.workspace_id = entitlement_audit.workspace_id AND ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
  ));

-- ADD ENTITLEMENTS
INSERT INTO public.entitlement_registry (key, name, description, category, type, enforcement_scope, ui_visibility)
VALUES
  ('audit_logs', 'Logs de Auditoria', 'Acesso a logs de auditoria detalhados', 'security', 'boolean', 'workspace', 'paywall'),
  ('break_glass_support', 'Suporte Break Glass', 'Acesso a suporte emergencial', 'security', 'boolean', 'workspace', 'paywall'),
  ('advanced_rls_diagnostics', 'Diagnóstico RLS Avançado', 'Ferramentas avançadas de segurança', 'security', 'boolean', 'workspace', 'paywall'),
  ('events_stream', 'Stream de Eventos', 'Acesso ao stream de eventos', 'integrations', 'boolean', 'workspace', 'paywall')
ON CONFLICT (key) DO NOTHING;

-- PLAN ENTITLEMENTS
INSERT INTO public.plan_entitlements (plan_key, entitlement_key, enabled, limit_value)
VALUES
  ('free', 'audit_logs', false, NULL),
  ('free', 'break_glass_support', false, NULL),
  ('free', 'advanced_rls_diagnostics', false, NULL),
  ('free', 'events_stream', false, NULL),
  ('pro', 'audit_logs', false, NULL),
  ('pro', 'break_glass_support', false, NULL),
  ('pro', 'advanced_rls_diagnostics', false, NULL),
  ('pro', 'events_stream', false, NULL),
  ('enterprise', 'audit_logs', true, NULL),
  ('enterprise', 'break_glass_support', true, NULL),
  ('enterprise', 'advanced_rls_diagnostics', true, NULL),
  ('enterprise', 'events_stream', true, NULL)
ON CONFLICT (plan_key, entitlement_key) DO NOTHING;

-- HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.log_entitlement_block(
  p_workspace_id UUID, p_entitlement_key TEXT, p_action TEXT, p_reason_code TEXT,
  p_current_value INTEGER DEFAULT NULL, p_limit_value INTEGER DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.entitlement_audit (workspace_id, user_id, entitlement_key, action, reason_code, current_value, limit_value, metadata)
  VALUES (p_workspace_id, auth.uid(), p_entitlement_key, p_action, p_reason_code, p_current_value, p_limit_value, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;