-- =============================================
-- ENFORCEMENT TRIGGERS (Server-side blocking)
-- =============================================

-- C1.1) Trigger para workspace_members (limite de membros)
CREATE OR REPLACE FUNCTION public.check_members_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_workspace_id UUID;
BEGIN
  v_workspace_id := NEW.workspace_id;
  
  -- Count current members
  SELECT COUNT(*) INTO v_current_count
  FROM public.workspace_members
  WHERE workspace_id = v_workspace_id;

  -- Enforce entitlement
  PERFORM public.enforce_entitlement(
    v_workspace_id, 
    'members_limit', 
    v_current_count::NUMERIC,
    'invite_member',
    auth.uid()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_members_limit ON public.workspace_members;
CREATE TRIGGER enforce_members_limit
  BEFORE INSERT ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_members_limit();

-- C1.2) Trigger para spaces (limite de espaços)
CREATE OR REPLACE FUNCTION public.check_spaces_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_workspace_id UUID;
BEGIN
  v_workspace_id := NEW.workspace_id;
  
  -- Count current spaces
  SELECT COUNT(*) INTO v_current_count
  FROM public.spaces
  WHERE workspace_id = v_workspace_id;

  -- Enforce entitlement
  PERFORM public.enforce_entitlement(
    v_workspace_id, 
    'spaces_limit', 
    v_current_count::NUMERIC,
    'create_space',
    auth.uid()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_spaces_limit ON public.spaces;
CREATE TRIGGER enforce_spaces_limit
  BEFORE INSERT ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.check_spaces_limit();

-- C1.3) Trigger para api_keys (limite de API keys + acesso a integrações)
CREATE OR REPLACE FUNCTION public.check_api_keys_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_workspace_id UUID;
BEGIN
  v_workspace_id := NEW.workspace_id;
  
  -- First check if integrations_access is enabled
  PERFORM public.enforce_entitlement(
    v_workspace_id, 
    'integrations_access', 
    0,
    'create_api_key',
    auth.uid()
  );
  
  -- Count current API keys
  SELECT COUNT(*) INTO v_current_count
  FROM public.api_keys
  WHERE workspace_id = v_workspace_id;

  -- Enforce limit
  PERFORM public.enforce_entitlement(
    v_workspace_id, 
    'api_keys_limit', 
    v_current_count::NUMERIC,
    'create_api_key',
    auth.uid()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_api_keys_limit ON public.api_keys;
CREATE TRIGGER enforce_api_keys_limit
  BEFORE INSERT ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.check_api_keys_limit();

-- C1.4) Trigger para webhook_subscriptions (limite de webhooks)
CREATE OR REPLACE FUNCTION public.check_webhooks_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_workspace_id UUID;
BEGIN
  v_workspace_id := NEW.workspace_id;
  
  -- First check if integrations_access is enabled
  PERFORM public.enforce_entitlement(
    v_workspace_id, 
    'integrations_access', 
    0,
    'create_webhook',
    auth.uid()
  );
  
  -- Count current webhooks
  SELECT COUNT(*) INTO v_current_count
  FROM public.webhook_subscriptions
  WHERE workspace_id = v_workspace_id;

  -- Enforce limit
  PERFORM public.enforce_entitlement(
    v_workspace_id, 
    'webhooks_limit', 
    v_current_count::NUMERIC,
    'create_webhook',
    auth.uid()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_webhooks_limit ON public.webhook_subscriptions;
CREATE TRIGGER enforce_webhooks_limit
  BEFORE INSERT ON public.webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_webhooks_limit();

-- C1.5) RPC para webhook replay (feature enterprise)
CREATE OR REPLACE FUNCTION public.request_webhook_replay(
  p_workspace_id UUID,
  p_delivery_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery RECORD;
BEGIN
  -- Enforce webhook_replay entitlement
  PERFORM public.enforce_entitlement(
    p_workspace_id, 
    'webhook_replay', 
    0,
    'replay_webhook',
    auth.uid()
  );

  -- Verify delivery exists and belongs to workspace
  SELECT wd.*, ws.url, ws.secret
  INTO v_delivery
  FROM public.webhook_deliveries wd
  JOIN public.webhook_subscriptions ws ON ws.id = wd.subscription_id
  WHERE wd.id = p_delivery_id
  AND ws.workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found or access denied';
  END IF;

  -- Return delivery info for frontend to process
  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', v_delivery.id,
    'event_type', v_delivery.event_type,
    'url', v_delivery.url,
    'payload', v_delivery.payload
  );
END;
$$;