-- ============================================
-- ENFORCEMENT TRIGGERS FOR PLAN LIMITS
-- ============================================

-- 1. Function to enforce seats limit when adding workspace members
CREATE OR REPLACE FUNCTION public.enforce_seats_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_seats_limit int;
  v_seats_used int;
BEGIN
  -- Get limit from plan
  SELECT seats_limit INTO v_seats_limit
  FROM workspace_plans
  WHERE workspace_id = NEW.workspace_id AND status = 'active';

  IF v_seats_limit IS NULL THEN
    v_seats_limit := 3; -- Free tier default
  END IF;

  -- Count current members
  SELECT COUNT(*) INTO v_seats_used
  FROM workspace_members
  WHERE workspace_id = NEW.workspace_id;

  IF v_seats_used >= v_seats_limit THEN
    RAISE EXCEPTION 'Limite de membros atingido (% de %). Faça upgrade do plano.', v_seats_used, v_seats_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on workspace_members insert
DROP TRIGGER IF EXISTS enforce_seats_limit_trigger ON workspace_members;
CREATE TRIGGER enforce_seats_limit_trigger
  BEFORE INSERT ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_seats_limit();

-- 2. Function to enforce spaces limit
CREATE OR REPLACE FUNCTION public.enforce_spaces_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_spaces_limit int;
  v_spaces_used int;
BEGIN
  -- Get limit from plan
  SELECT spaces_limit INTO v_spaces_limit
  FROM workspace_plans
  WHERE workspace_id = NEW.workspace_id AND status = 'active';

  IF v_spaces_limit IS NULL THEN
    v_spaces_limit := 3; -- Free tier default
  END IF;

  -- Count current spaces
  SELECT COUNT(*) INTO v_spaces_used
  FROM spaces
  WHERE workspace_id = NEW.workspace_id;

  IF v_spaces_used >= v_spaces_limit THEN
    RAISE EXCEPTION 'Limite de espaços atingido (% de %). Faça upgrade do plano.', v_spaces_used, v_spaces_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on spaces insert
DROP TRIGGER IF EXISTS enforce_spaces_limit_trigger ON spaces;
CREATE TRIGGER enforce_spaces_limit_trigger
  BEFORE INSERT ON spaces
  FOR EACH ROW
  EXECUTE FUNCTION enforce_spaces_limit();

-- 3. Function to enforce API keys limit
CREATE OR REPLACE FUNCTION public.enforce_api_keys_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_api_keys_limit int;
  v_api_keys_used int;
  v_integrations_enabled boolean;
BEGIN
  -- Check if integrations are enabled
  SELECT (value->>'enabled')::boolean INTO v_integrations_enabled
  FROM workspace_entitlements
  WHERE workspace_id = NEW.workspace_id AND key = 'integrations.enabled';

  IF v_integrations_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Integrações não estão habilitadas para este workspace. Faça upgrade para Pro.';
  END IF;

  -- Get limit from plan
  SELECT api_keys_limit INTO v_api_keys_limit
  FROM workspace_plans
  WHERE workspace_id = NEW.workspace_id AND status = 'active';

  IF v_api_keys_limit IS NULL THEN
    v_api_keys_limit := 0; -- Free tier default
  END IF;

  -- Count current API keys
  SELECT COUNT(*) INTO v_api_keys_used
  FROM api_keys
  WHERE workspace_id = NEW.workspace_id AND is_active = true;

  IF v_api_keys_used >= v_api_keys_limit THEN
    RAISE EXCEPTION 'Limite de API keys atingido (% de %). Faça upgrade do plano.', v_api_keys_used, v_api_keys_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on api_keys insert
DROP TRIGGER IF EXISTS enforce_api_keys_limit_trigger ON api_keys;
CREATE TRIGGER enforce_api_keys_limit_trigger
  BEFORE INSERT ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION enforce_api_keys_limit();

-- 4. Seed plans for existing workspaces that don't have one
INSERT INTO workspace_plans (workspace_id, plan_tier, status, seats_limit, spaces_limit, storage_mb_limit, webhooks_limit, api_keys_limit)
SELECT 
  w.id,
  'free'::plan_tier,
  'active'::plan_status,
  3, -- seats_limit
  3, -- spaces_limit
  500, -- storage_mb_limit
  0, -- webhooks_limit
  0  -- api_keys_limit
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_plans wp WHERE wp.workspace_id = w.id
);

-- 5. Seed default entitlements for existing workspaces
INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'integrations.enabled', '{"enabled": false}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'integrations.enabled'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'templates.enabled', '{"enabled": false}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'templates.enabled'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'audit.enabled', '{"enabled": true}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'audit.enabled'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'audit.retention_days', '{"value": 7}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'audit.retention_days'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'webhooks.enabled', '{"enabled": false}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'webhooks.enabled'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'webhooks.replay', '{"enabled": false}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'webhooks.replay'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'support_sessions.enabled', '{"enabled": false}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'support_sessions.enabled'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'client_reports.enabled', '{"enabled": true, "tier": "lite"}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'client_reports.enabled'
);

INSERT INTO workspace_entitlements (workspace_id, key, value)
SELECT w.id, 'audit.export', '{"enabled": false}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_entitlements we WHERE we.workspace_id = w.id AND we.key = 'audit.export'
);

-- 6. Create function to auto-seed plan on workspace creation
CREATE OR REPLACE FUNCTION public.seed_workspace_plan()
RETURNS TRIGGER AS $$
BEGIN
  -- Create free plan
  INSERT INTO workspace_plans (workspace_id, plan_tier, status, seats_limit, spaces_limit, storage_mb_limit, webhooks_limit, api_keys_limit)
  VALUES (NEW.id, 'free', 'active', 3, 3, 500, 0, 0);

  -- Create default entitlements for free tier
  INSERT INTO workspace_entitlements (workspace_id, key, value) VALUES
    (NEW.id, 'integrations.enabled', '{"enabled": false}'::jsonb),
    (NEW.id, 'templates.enabled', '{"enabled": false}'::jsonb),
    (NEW.id, 'audit.enabled', '{"enabled": true}'::jsonb),
    (NEW.id, 'audit.retention_days', '{"value": 7}'::jsonb),
    (NEW.id, 'webhooks.enabled', '{"enabled": false}'::jsonb),
    (NEW.id, 'webhooks.replay', '{"enabled": false}'::jsonb),
    (NEW.id, 'support_sessions.enabled', '{"enabled": false}'::jsonb),
    (NEW.id, 'client_reports.enabled', '{"enabled": true, "tier": "lite"}'::jsonb),
    (NEW.id, 'audit.export', '{"enabled": false}'::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on workspaces insert
DROP TRIGGER IF EXISTS seed_workspace_plan_trigger ON workspaces;
CREATE TRIGGER seed_workspace_plan_trigger
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION seed_workspace_plan();

-- 7. Function to upgrade workspace plan
CREATE OR REPLACE FUNCTION public.upgrade_workspace_plan(
  p_workspace_id uuid,
  p_new_tier plan_tier,
  p_provider billing_provider DEFAULT 'manual'
)
RETURNS void AS $$
DECLARE
  v_seats_limit int;
  v_spaces_limit int;
  v_storage_mb_limit int;
  v_webhooks_limit int;
  v_api_keys_limit int;
BEGIN
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
  UPDATE workspace_plans
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

  -- Update entitlements based on tier
  IF p_new_tier = 'pro' THEN
    INSERT INTO workspace_entitlements (workspace_id, key, value)
    VALUES 
      (p_workspace_id, 'integrations.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'templates.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'webhooks.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'audit.retention_days', '{"value": 30}'::jsonb)
    ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value;
  ELSIF p_new_tier = 'enterprise' THEN
    INSERT INTO workspace_entitlements (workspace_id, key, value)
    VALUES 
      (p_workspace_id, 'integrations.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'templates.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'webhooks.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'webhooks.replay', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'support_sessions.enabled', '{"enabled": true}'::jsonb),
      (p_workspace_id, 'audit.retention_days', '{"value": 365}'::jsonb),
      (p_workspace_id, 'audit.export', '{"enabled": true}'::jsonb)
    ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;