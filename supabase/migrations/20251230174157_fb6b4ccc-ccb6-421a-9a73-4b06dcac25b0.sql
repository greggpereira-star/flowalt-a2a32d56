-- Fix card creation failing: audit_cards_function was calling a trigger-only function directly
-- ("trigger functions can only be called as triggers").
-- We inline the audit logging logic for cards.

CREATE OR REPLACE FUNCTION public.audit_cards_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_old_data jsonb;
  v_new_data jsonb;
  v_action text;
BEGIN
  v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);

  -- If we can't resolve workspace_id, skip auditing.
  IF v_workspace_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- For UPDATE, only audit critical changes.
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.briefing_data IS DISTINCT FROM NEW.briefing_data OR
      OLD.owner_id IS DISTINCT FROM NEW.owner_id
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Determine action + payload
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    workspace_id,
    user_id,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data,
    metadata
  ) VALUES (
    v_workspace_id,
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_data,
    v_new_data,
    jsonb_build_object(
      'trigger_name', TG_NAME,
      'trigger_when', TG_WHEN,
      'timestamp', now()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;