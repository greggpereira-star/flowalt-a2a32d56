-- =============================================
-- FIX: Remove auto-creation of Clientes space
-- Requirement: Workspace must start "clean" with no spaces
-- =============================================

-- Step 1: Drop the trigger that auto-creates Clientes space
DROP TRIGGER IF EXISTS on_workspace_created_create_clients_space ON public.workspaces;

-- Step 2: Keep the function but don't auto-trigger it
-- (User can call it manually via UI if they want the Clientes space template)

-- Step 3: Remove duplicate enforcement triggers (keep only one)
DROP TRIGGER IF EXISTS enforce_spaces_limit ON public.spaces;

-- Step 4: Ensure enforce_spaces_limit_trigger is the only one and uses correct logic
DROP TRIGGER IF EXISTS enforce_spaces_limit_trigger ON public.spaces;

-- Step 5: Recreate a single, correct enforcement trigger
CREATE TRIGGER enforce_spaces_limit_trigger
  BEFORE INSERT ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_spaces_limit();

-- Step 6: Update enforce_spaces_limit to handle bootstrap scenario properly
CREATE OR REPLACE FUNCTION public.enforce_spaces_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_reason_code := COALESCE(v_resolved->>'reason_code', 'OK');
  
  -- During bootstrap or if using defaults, allow with limit check
  IF v_reason_code IN ('USING_DEFAULTS', 'OK', 'OVERRIDE_ACTIVE', 'REGISTRY_DEFAULT') THEN
    -- If there's a limit, enforce it
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current
      FROM public.spaces
      WHERE workspace_id = NEW.workspace_id
        AND is_archived = false;
      
      IF v_current >= v_limit THEN
        -- Log the block
        BEGIN
          PERFORM public.log_entitlement_block(
            NEW.workspace_id,
            auth.uid(),
            'spaces_limit',
            'create_space',
            'PLAN_LIMIT',
            v_current,
            v_limit
          );
        EXCEPTION WHEN OTHERS THEN
          -- Logging should not break the flow
          RAISE NOTICE 'Failed to log block: %', SQLERRM;
        END;
        RAISE EXCEPTION 'Limite de espaços atingido (% de %). Faça upgrade do seu plano para criar mais espaços.', v_current, v_limit;
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- If not enabled, block with friendly message
  IF NOT v_enabled THEN
    BEGIN
      PERFORM public.log_entitlement_block(
        NEW.workspace_id,
        auth.uid(),
        'spaces_limit',
        'create_space',
        v_reason_code,
        0,
        v_limit
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to log block: %', SQLERRM;
    END;
    
    -- More user-friendly error message
    IF v_reason_code = 'DISABLED' OR v_reason_code = 'NO_PLAN' THEN
      RAISE EXCEPTION 'Configuração de plano pendente. Por favor, entre em contato com o suporte.';
    ELSE
      RAISE EXCEPTION 'ENTITLEMENT_BLOCKED: spaces_limit - %', v_reason_code;
    END IF;
  END IF;
  
  -- Check limit for enabled entitlements
  SELECT COUNT(*) INTO v_current
  FROM public.spaces
  WHERE workspace_id = NEW.workspace_id
    AND is_archived = false;

  IF v_limit IS NOT NULL AND v_current >= v_limit THEN
    BEGIN
      PERFORM public.log_entitlement_block(
        NEW.workspace_id,
        auth.uid(),
        'spaces_limit',
        'create_space',
        'PLAN_LIMIT',
        v_current,
        v_limit
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to log block: %', SQLERRM;
    END;
    RAISE EXCEPTION 'Limite de espaços atingido (% de %). Faça upgrade do seu plano para criar mais espaços.', v_current, v_limit;
  END IF;

  RETURN NEW;
END;
$$;