-- Security fix: restrict plan upgrades to billing admins (owner/admin/super_admin)

CREATE OR REPLACE FUNCTION public.has_billing_access(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role IN ('super_admin', 'owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.upgrade_workspace_plan(
  p_workspace_id uuid,
  p_new_tier plan_tier,
  p_provider billing_provider DEFAULT 'manual'::billing_provider
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seats_limit int;
  v_spaces_limit int;
  v_storage_mb_limit int;
  v_webhooks_limit int;
  v_api_keys_limit int;
  v_exists boolean;
BEGIN
  -- AuthZ: only billing admins can change plan
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  IF NOT public.has_billing_access(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to manage billing';
  END IF;

  -- Set limits based on tier
  CASE p_new_tier
    WHEN 'free' THEN
      v_seats_limit := 3;
      v_spaces_limit := 3;
      v_storage_mb_limit := 500;
      v_webhooks_limit := 0;
      v_api_keys_limit := 0;
    WHEN 'pro' THEN
      v_seats_limit := 15;
      v_spaces_limit := 30;
      v_storage_mb_limit := 5000;
      v_webhooks_limit := 10;
      v_api_keys_limit := 5;
    WHEN 'enterprise' THEN
      v_seats_limit := 999;
      v_spaces_limit := 999;
      v_storage_mb_limit := 50000;
      v_webhooks_limit := 100;
      v_api_keys_limit := 50;
  END CASE;

  -- Update plan
  UPDATE public.workspace_plans
  SET 
    plan_tier = p_new_tier,
    provider = p_provider,
    seats_limit = v_seats_limit,
    spaces_limit = v_spaces_limit,
    storage_mb_limit = v_storage_mb_limit,
    webhooks_limit = v_webhooks_limit,
    api_keys_limit = v_api_keys_limit,
    updated_at = now()
  WHERE workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace plan not found';
  END IF;

  -- Update entitlements based on tier
  IF p_new_tier = 'free' THEN
    INSERT INTO public.workspace_entitlements (workspace_id, key, value)
    VALUES 
      (p_workspace_id, 'integrations.enabled', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'templates.enabled', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'webhooks.enabled', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'webhooks.replay', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'support_sessions.enabled', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'audit.export', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'audit.retention_days', '{"value": 7}'::jsonb)
    ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value;

  ELSIF p_new_tier = 'pro' THEN
    INSERT INTO public.workspace_entitlements (workspace_id, key, value)
    VALUES 
      (p_workspace_id, 'integrations.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'templates.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'webhooks.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'webhooks.replay', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'support_sessions.enabled', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'audit.export', '{"enabled": false}'::jsonb),
      (p_workspace_id, 'audit.retention_days', '{"value": 30}'::jsonb)
    ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value;

  ELSIF p_new_tier = 'enterprise' THEN
    INSERT INTO public.workspace_entitlements (workspace_id, key, value)
    VALUES 
      (p_workspace_id, 'integrations.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'templates.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'webhooks.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'webhooks.replay', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'support_sessions.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'audit.export', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'audit.retention_days', '{"value": 365}'::jsonb)
    ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value;
  END IF;
END;
$$;