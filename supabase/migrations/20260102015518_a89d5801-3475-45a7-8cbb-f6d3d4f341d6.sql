
-- Update enforce_spaces_limit trigger function to log blocks
CREATE OR REPLACE FUNCTION public.enforce_spaces_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_enabled boolean;
BEGIN
  -- Get the effective entitlement for spaces_limit
  SELECT enabled, limit_value INTO v_enabled, v_limit
  FROM workspace_entitlements_effective
  WHERE workspace_id = NEW.workspace_id
    AND entitlement_key = 'spaces_limit';

  -- If no entitlement found or not enabled, allow (fail open for now)
  IF NOT FOUND OR v_enabled IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count current spaces
  SELECT COUNT(*) INTO v_current
  FROM spaces
  WHERE workspace_id = NEW.workspace_id;

  -- Check if within limit
  IF v_limit IS NOT NULL AND v_current >= v_limit THEN
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

  RETURN NEW;
END;
$$;

-- Update enforce_api_keys_limit trigger function to log blocks
CREATE OR REPLACE FUNCTION public.enforce_api_keys_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_enabled boolean;
BEGIN
  -- Get the effective entitlement for api_keys_limit
  SELECT enabled, limit_value INTO v_enabled, v_limit
  FROM workspace_entitlements_effective
  WHERE workspace_id = NEW.workspace_id
    AND entitlement_key = 'api_keys_limit';

  -- If no entitlement found, block for security
  IF NOT FOUND THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'api_keys_limit',
      'create_api_key',
      'ENTITLEMENT_NOT_FOUND',
      0,
      0
    );
    RAISE EXCEPTION 'Entitlement não encontrado para api_keys_limit';
  END IF;

  -- If not enabled, block
  IF NOT v_enabled THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'api_keys_limit',
      'create_api_key',
      'DISABLED',
      0,
      v_limit
    );
    RAISE EXCEPTION 'API Keys não habilitado no seu plano';
  END IF;

  -- Count current API keys
  SELECT COUNT(*) INTO v_current
  FROM api_keys
  WHERE workspace_id = NEW.workspace_id AND is_active = true;

  -- Check if within limit
  IF v_limit IS NOT NULL AND v_current >= v_limit THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'api_keys_limit',
      'create_api_key',
      'PLAN_LIMIT',
      v_current,
      v_limit
    );
    RAISE EXCEPTION 'Limite de API Keys atingido. Limite: %, Atual: %', v_limit, v_current;
  END IF;

  RETURN NEW;
END;
$$;

-- Update enforce_webhooks_limit trigger function to log blocks
CREATE OR REPLACE FUNCTION public.enforce_webhooks_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_enabled boolean;
BEGIN
  -- Get the effective entitlement for webhooks_limit
  SELECT enabled, limit_value INTO v_enabled, v_limit
  FROM workspace_entitlements_effective
  WHERE workspace_id = NEW.workspace_id
    AND entitlement_key = 'webhooks_limit';

  -- If no entitlement found, block for security
  IF NOT FOUND THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'webhooks_limit',
      'create_webhook',
      'ENTITLEMENT_NOT_FOUND',
      0,
      0
    );
    RAISE EXCEPTION 'Entitlement não encontrado para webhooks_limit';
  END IF;

  -- If not enabled, block
  IF NOT v_enabled THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'webhooks_limit',
      'create_webhook',
      'DISABLED',
      0,
      v_limit
    );
    RAISE EXCEPTION 'Webhooks não habilitado no seu plano';
  END IF;

  -- Count current webhooks
  SELECT COUNT(*) INTO v_current
  FROM webhooks
  WHERE workspace_id = NEW.workspace_id AND is_active = true;

  -- Check if within limit
  IF v_limit IS NOT NULL AND v_current >= v_limit THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'webhooks_limit',
      'create_webhook',
      'PLAN_LIMIT',
      v_current,
      v_limit
    );
    RAISE EXCEPTION 'Limite de Webhooks atingido. Limite: %, Atual: %', v_limit, v_current;
  END IF;

  RETURN NEW;
END;
$$;

-- Update enforce_members_limit trigger function to log blocks
CREATE OR REPLACE FUNCTION public.enforce_members_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_enabled boolean;
BEGIN
  -- Get the effective entitlement for members_limit
  SELECT enabled, limit_value INTO v_enabled, v_limit
  FROM workspace_entitlements_effective
  WHERE workspace_id = NEW.workspace_id
    AND entitlement_key = 'members_limit';

  -- If no entitlement found, allow (fail open)
  IF NOT FOUND OR v_enabled IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count current members
  SELECT COUNT(*) INTO v_current
  FROM workspace_members
  WHERE workspace_id = NEW.workspace_id;

  -- Check if within limit
  IF v_limit IS NOT NULL AND v_current >= v_limit THEN
    PERFORM log_entitlement_block(
      NEW.workspace_id,
      auth.uid(),
      'members_limit',
      'invite_member',
      'PLAN_LIMIT',
      v_current,
      v_limit
    );
    RAISE EXCEPTION 'Limite de membros atingido. Limite: %, Atual: %', v_limit, v_current;
  END IF;

  RETURN NEW;
END;
$$;

-- Create RPC function to check and log entitlement access (for frontend validation with logging)
CREATE OR REPLACE FUNCTION public.check_entitlement_with_log(
  p_workspace_id uuid,
  p_entitlement_key text,
  p_action text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlement record;
  v_current integer;
  v_result jsonb;
BEGIN
  -- Get the effective entitlement
  SELECT * INTO v_entitlement
  FROM workspace_entitlements_effective
  WHERE workspace_id = p_workspace_id
    AND entitlement_key = p_entitlement_key;

  IF NOT FOUND THEN
    -- Log if action provided
    IF p_action IS NOT NULL THEN
      PERFORM log_entitlement_block(
        p_workspace_id,
        auth.uid(),
        p_entitlement_key,
        p_action,
        'ENTITLEMENT_NOT_FOUND',
        0,
        0
      );
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason_code', 'ENTITLEMENT_NOT_FOUND',
      'message', 'Entitlement não encontrado'
    );
  END IF;

  -- Check if enabled
  IF NOT v_entitlement.enabled THEN
    IF p_action IS NOT NULL THEN
      PERFORM log_entitlement_block(
        p_workspace_id,
        auth.uid(),
        p_entitlement_key,
        p_action,
        'DISABLED',
        0,
        v_entitlement.limit_value
      );
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason_code', 'DISABLED',
      'message', 'Recurso indisponível no seu plano',
      'limit_value', v_entitlement.limit_value
    );
  END IF;

  -- For limit types, check current usage
  IF v_entitlement.type = 'limit' AND v_entitlement.limit_value IS NOT NULL THEN
    -- Get current usage based on entitlement key
    CASE p_entitlement_key
      WHEN 'members_limit' THEN
        SELECT COUNT(*) INTO v_current FROM workspace_members WHERE workspace_id = p_workspace_id;
      WHEN 'spaces_limit' THEN
        SELECT COUNT(*) INTO v_current FROM spaces WHERE workspace_id = p_workspace_id;
      WHEN 'api_keys_limit' THEN
        SELECT COUNT(*) INTO v_current FROM api_keys WHERE workspace_id = p_workspace_id AND is_active = true;
      WHEN 'webhooks_limit' THEN
        SELECT COUNT(*) INTO v_current FROM webhooks WHERE workspace_id = p_workspace_id AND is_active = true;
      ELSE
        v_current := 0;
    END CASE;

    IF v_current >= v_entitlement.limit_value THEN
      IF p_action IS NOT NULL THEN
        PERFORM log_entitlement_block(
          p_workspace_id,
          auth.uid(),
          p_entitlement_key,
          p_action,
          'PLAN_LIMIT',
          v_current,
          v_entitlement.limit_value
        );
      END IF;
      
      RETURN jsonb_build_object(
        'allowed', false,
        'reason_code', 'PLAN_LIMIT',
        'message', 'Limite do plano atingido',
        'current_value', v_current,
        'limit_value', v_entitlement.limit_value
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', true,
      'reason_code', 'OK',
      'current_value', v_current,
      'limit_value', v_entitlement.limit_value,
      'remaining', v_entitlement.limit_value - v_current
    );
  END IF;

  -- Boolean entitlement that is enabled
  RETURN jsonb_build_object(
    'allowed', true,
    'reason_code', 'OK'
  );
END;
$$;
