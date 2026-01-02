-- =============================================
-- FIX: Consolidate duplicate enforcement triggers
-- =============================================

-- 1. Drop duplicate triggers on api_keys (keep only one)
DROP TRIGGER IF EXISTS enforce_api_keys_limit ON public.api_keys;

-- 2. Drop duplicate triggers on workspace_members (keep only one)
DROP TRIGGER IF EXISTS enforce_members_limit ON public.workspace_members;

-- 3. Update enforce_seats_limit to use resolve_entitlement for consistency
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
  -- Get resolved entitlement (uses proper fallback logic)
  v_resolved := public.resolve_entitlement(NEW.workspace_id, 'seats_limit');
  v_seats_limit := (v_resolved->>'limit')::int;
  v_reason_code := COALESCE(v_resolved->>'reason_code', 'OK');
  
  -- If using defaults during bootstrap, allow with limit check
  IF v_reason_code IN ('USING_DEFAULTS', 'OK', 'OVERRIDE_ACTIVE') THEN
    IF v_seats_limit IS NULL THEN
      v_seats_limit := 3; -- Free tier default
    END IF;
  ELSE
    v_seats_limit := 3; -- Fallback
  END IF;

  -- Count current members
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

-- 4. Update enforce_api_keys_limit to use resolve_entitlement
CREATE OR REPLACE FUNCTION public.enforce_api_keys_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_resolved jsonb;
  v_reason_code text;
  v_enabled boolean;
BEGIN
  -- Get resolved entitlement
  v_resolved := public.resolve_entitlement(NEW.workspace_id, 'api_keys_limit');
  v_enabled := COALESCE((v_resolved->>'enabled')::boolean, false);
  v_limit := (v_resolved->>'limit')::integer;
  v_reason_code := COALESCE(v_resolved->>'reason_code', 'NO_PLAN');
  
  -- During bootstrap, apply limit if present
  IF v_reason_code IN ('USING_DEFAULTS', 'OK', 'OVERRIDE_ACTIVE') THEN
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current
      FROM api_keys
      WHERE workspace_id = NEW.workspace_id AND is_active = true;

      IF v_current >= v_limit THEN
        BEGIN
          PERFORM log_entitlement_block(
            NEW.workspace_id,
            auth.uid(),
            'api_keys_limit',
            'create_api_key',
            'PLAN_LIMIT',
            v_current,
            v_limit
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Failed to log block: %', SQLERRM;
        END;
        RAISE EXCEPTION 'Limite de API Keys atingido (% de %). Faça upgrade do plano.', v_current, v_limit;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  -- If not enabled, block with friendly message
  IF NOT v_enabled THEN
    BEGIN
      PERFORM log_entitlement_block(
        NEW.workspace_id,
        auth.uid(),
        'api_keys_limit',
        'create_api_key',
        v_reason_code,
        0,
        v_limit
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to log block: %', SQLERRM;
    END;
    RAISE EXCEPTION 'API Keys não está habilitado no seu plano. Faça upgrade para usar esta funcionalidade.';
  END IF;

  -- Count current API keys
  SELECT COUNT(*) INTO v_current
  FROM api_keys
  WHERE workspace_id = NEW.workspace_id AND is_active = true;

  IF v_limit IS NOT NULL AND v_current >= v_limit THEN
    BEGIN
      PERFORM log_entitlement_block(
        NEW.workspace_id,
        auth.uid(),
        'api_keys_limit',
        'create_api_key',
        'PLAN_LIMIT',
        v_current,
        v_limit
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to log block: %', SQLERRM;
    END;
    RAISE EXCEPTION 'Limite de API Keys atingido (% de %). Faça upgrade do plano.', v_current, v_limit;
  END IF;

  RETURN NEW;
END;
$$;