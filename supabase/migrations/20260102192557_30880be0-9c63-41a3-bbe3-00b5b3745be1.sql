-- =============================================
-- FIX: seats_limit should use members_limit from entitlement system
-- The workspace_plans.seats_limit column exists but should fall back to entitlement system
-- =============================================

-- 1. Create seats_limit in entitlement_registry to match workspace_plans column
INSERT INTO entitlement_registry (key, name, description, category, type, default_enabled, default_limit, unit, enforcement_scope, ui_visibility)
VALUES (
  'seats_limit',
  'Limite de Assentos',
  'Limite de membros do workspace (usa coluna seats_limit da tabela workspace_plans)',
  'core',
  'limit',
  true,
  3,
  'seats',
  'workspace',
  'visible'
)
ON CONFLICT (key) DO UPDATE SET
  default_limit = 3,
  default_enabled = true;

-- 2. Add plan_entitlements for seats_limit
INSERT INTO plan_entitlements (plan_key, entitlement_key, enabled, limit_value)
VALUES 
  ('free', 'seats_limit', true, 3),
  ('pro', 'seats_limit', true, 15),
  ('enterprise', 'seats_limit', true, 500)
ON CONFLICT (plan_key, entitlement_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  limit_value = EXCLUDED.limit_value;

-- 3. Update enforce_seats_limit to properly resolve from entitlement system OR workspace_plans
CREATE OR REPLACE FUNCTION public.enforce_seats_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats_limit int;
  v_seats_used int;
  v_resolved jsonb;
  v_reason_code text;
BEGIN
  -- First try to get from resolve_entitlement
  v_resolved := public.resolve_entitlement(NEW.workspace_id, 'seats_limit');
  v_seats_limit := (v_resolved->>'limit')::int;
  v_reason_code := COALESCE(v_resolved->>'reason_code', 'OK');
  
  -- If not found, try members_limit
  IF v_seats_limit IS NULL THEN
    v_resolved := public.resolve_entitlement(NEW.workspace_id, 'members_limit');
    v_seats_limit := (v_resolved->>'limit')::int;
    v_reason_code := COALESCE(v_resolved->>'reason_code', 'OK');
  END IF;
  
  -- If still null, try workspace_plans column directly
  IF v_seats_limit IS NULL THEN
    SELECT seats_limit INTO v_seats_limit
    FROM workspace_plans
    WHERE workspace_id = NEW.workspace_id AND status = 'active';
  END IF;
  
  -- Final fallback
  IF v_seats_limit IS NULL THEN
    v_seats_limit := 3; -- Free tier default
  END IF;

  -- Count current active members
  SELECT COUNT(*) INTO v_seats_used
  FROM workspace_members
  WHERE workspace_id = NEW.workspace_id AND is_active = true;

  IF v_seats_used >= v_seats_limit THEN
    BEGIN
      PERFORM log_entitlement_block(
        NEW.workspace_id,
        auth.uid(),
        'seats_limit',
        'add_member',
        'PLAN_LIMIT',
        v_seats_used,
        v_seats_limit
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to log block: %', SQLERRM;
    END;
    RAISE EXCEPTION 'Limite de membros atingido (% de %). Faça upgrade do plano.', v_seats_used, v_seats_limit;
  END IF;

  RETURN NEW;
END;
$$;