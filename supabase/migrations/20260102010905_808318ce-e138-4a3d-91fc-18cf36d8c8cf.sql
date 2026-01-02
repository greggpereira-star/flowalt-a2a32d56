-- Fix SECURITY DEFINER view warning by using security_invoker
DROP VIEW IF EXISTS public.workspace_entitlements_effective;

CREATE VIEW public.workspace_entitlements_effective 
WITH (security_invoker = true) AS
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