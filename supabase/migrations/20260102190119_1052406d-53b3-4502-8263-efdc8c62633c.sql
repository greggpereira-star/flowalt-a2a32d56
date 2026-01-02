
-- =====================================================
-- FIX: AUTO-SEED WORKSPACE PLAN ON WORKSPACE CREATION
-- =====================================================
-- Root cause: workspace_entitlements_effective requires workspace_plans
-- to exist. Without it, resolve_entitlement returns NO_PLAN -> DISABLED
-- which blocks all entitlement checks including spaces_limit.

-- 1. Create function to seed default plan for new workspaces
CREATE OR REPLACE FUNCTION public.seed_workspace_default_plan()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a default 'free' plan for the new workspace
  INSERT INTO public.workspace_plans (
    workspace_id,
    plan_tier,
    status,
    provider,
    seats_limit,
    spaces_limit,
    storage_mb_limit,
    api_keys_limit,
    webhooks_limit,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'free',
    'active',
    'manual',
    3,   -- seats_limit for free tier
    3,   -- spaces_limit for free tier  
    500, -- storage_mb_limit for free tier
    0,   -- api_keys_limit for free tier
    0,   -- webhooks_limit for free tier
    now(),
    now() + interval '1 month'
  )
  ON CONFLICT (workspace_id) DO NOTHING; -- Avoid duplicates if re-run
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create trigger on workspace insert
DROP TRIGGER IF EXISTS trigger_seed_workspace_plan ON public.workspaces;

CREATE TRIGGER trigger_seed_workspace_plan
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_workspace_default_plan();

-- 3. Fix resolve_entitlement to be more explicit about NO_PLAN case
-- and provide a graceful fallback during workspace creation
CREATE OR REPLACE FUNCTION public.resolve_entitlement(
  p_workspace_id UUID,
  p_entitlement_key TEXT
)
RETURNS JSONB AS $$
DECLARE 
  v_result JSONB; 
  v_effective RECORD;
  v_registry RECORD;
BEGIN
  -- First check if the entitlement key exists in registry
  SELECT * INTO v_registry 
  FROM public.entitlement_registry 
  WHERE key = p_entitlement_key;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'enabled', false, 
      'limit', null, 
      'plan_key', null, 
      'source', 'unknown', 
      'ui_visibility', 'hidden', 
      'reason_code', 'ENTITLEMENT_NOT_FOUND'
    );
  END IF;
  
  -- Try to get from effective view
  SELECT * INTO v_effective 
  FROM public.workspace_entitlements_effective 
  WHERE workspace_id = p_workspace_id 
    AND entitlement_key = p_entitlement_key;
  
  IF NOT FOUND THEN
    -- Check if workspace has a plan
    IF NOT EXISTS (SELECT 1 FROM public.workspace_plans WHERE workspace_id = p_workspace_id) THEN
      -- NO PLAN: Return registry defaults to allow bootstrapping
      -- This is critical for workspace creation flow
      RETURN jsonb_build_object(
        'enabled', COALESCE(v_registry.default_enabled, true),
        'limit', v_registry.default_limit,
        'plan_key', 'free',
        'source', 'registry_default',
        'ui_visibility', v_registry.ui_visibility,
        'reason_code', 'USING_DEFAULTS'
      );
    END IF;
    
    -- Plan exists but no effective entitlement - use registry defaults
    RETURN jsonb_build_object(
      'enabled', COALESCE(v_registry.default_enabled, true),
      'limit', v_registry.default_limit,
      'plan_key', 'unknown',
      'source', 'registry_default',
      'ui_visibility', v_registry.ui_visibility,
      'reason_code', 'USING_DEFAULTS'
    );
  END IF;
  
  -- Normal case: effective entitlement found
  v_result := jsonb_build_object(
    'enabled', COALESCE(v_effective.enabled, true),
    'limit', v_effective.limit_value,
    'plan_key', v_effective.plan_key,
    'source', v_effective.source,
    'ui_visibility', v_effective.ui_visibility,
    'reason_code', CASE 
      WHEN v_effective.enabled = false THEN 'DISABLED'
      WHEN v_effective.source = 'override' AND v_effective.override_expires_at IS NOT NULL THEN 'OVERRIDE_ACTIVE'
      ELSE 'OK' 
    END,
    'type', v_effective.type,
    'unit', v_effective.unit
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Update the spaces enforcement trigger to be more resilient
CREATE OR REPLACE FUNCTION public.enforce_spaces_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_enabled boolean;
  v_resolved jsonb;
  v_reason_code text;
BEGIN
  -- Get the resolved entitlement
  v_resolved := public.resolve_entitlement(NEW.workspace_id, 'spaces_limit');
  v_enabled := COALESCE((v_resolved->>'enabled')::boolean, true);
  v_limit := (v_resolved->>'limit')::integer;
  v_reason_code := v_resolved->>'reason_code';
  
  -- If using defaults during bootstrap, allow creation
  IF v_reason_code IN ('USING_DEFAULTS', 'OK', 'OVERRIDE_ACTIVE') THEN
    -- Check if within limit
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current
      FROM spaces
      WHERE workspace_id = NEW.workspace_id;
      
      IF v_current >= v_limit THEN
        -- Log the block before raising exception
        PERFORM log_entitlement_block(
          NEW.workspace_id,
          auth.uid(),
          'spaces_limit',
          'create_space',
          'PLAN_LIMIT',
          v_current,
          v_limit
        );
        RAISE EXCEPTION 'Limite de espaços atingido. Limite: %, Atual: %', v_limit, v_current;
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- If not enabled, block
  IF NOT v_enabled THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'spaces_limit',
      'create_space',
      v_reason_code,
      0,
      v_limit
    );
    RAISE EXCEPTION 'ENTITLEMENT_BLOCKED: spaces_limit - %', v_reason_code;
  END IF;
  
  -- Check limit
  SELECT COUNT(*) INTO v_current
  FROM spaces
  WHERE workspace_id = NEW.workspace_id;

  IF v_limit IS NOT NULL AND v_current >= v_limit THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'spaces_limit',
      'create_space',
      'PLAN_LIMIT',
      v_current,
      v_limit
    );
    RAISE EXCEPTION 'Limite de espaços atingido. Limite: %, Atual: %', v_limit, v_current;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Seed missing plans for existing workspaces that don't have one
INSERT INTO public.workspace_plans (
  workspace_id,
  plan_tier,
  status,
  provider,
  seats_limit,
  spaces_limit,
  storage_mb_limit,
  api_keys_limit,
  webhooks_limit,
  current_period_start,
  current_period_end
)
SELECT 
  w.id,
  'free',
  'active',
  'manual',
  3,
  3,
  500,
  0,
  0,
  now(),
  now() + interval '1 month'
FROM public.workspaces w
LEFT JOIN public.workspace_plans wp ON wp.workspace_id = w.id
WHERE wp.id IS NULL;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.seed_workspace_default_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_entitlement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_spaces_limit() TO authenticated;
