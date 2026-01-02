-- FIX: All functions with entity_id type mismatch (uuid vs text)

-- 1. Fix audit_support_session_changes
CREATE OR REPLACE FUNCTION public.audit_support_session_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data, actor_type)
    VALUES (NEW.workspace_id, NEW.super_admin_user_id, 'support_session_started', 'support_session', NEW.id,
      jsonb_build_object('reason', NEW.reason, 'mode', NEW.mode, 'expires_at', NEW.expires_at), 'super_admin');
  ELSIF TG_OP = 'UPDATE' AND NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, new_data, actor_type)
    VALUES (NEW.workspace_id, NEW.super_admin_user_id, 'support_session_ended', 'support_session', NEW.id,
      jsonb_build_object('reason', NEW.reason, 'mode', NEW.mode, 'ended_at', NEW.ended_at), 'super_admin');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Fix audit_trigger_func
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.workspace_id, OLD.workspace_id) IS NOT NULL THEN
    INSERT INTO public.audit_logs (workspace_id, user_id, entity_type, entity_id, action, old_data, new_data, actor_type)
    VALUES (
      COALESCE(NEW.workspace_id, OLD.workspace_id), 
      auth.uid(), 
      TG_TABLE_NAME, 
      COALESCE(NEW.id, OLD.id), -- Already UUID, no cast needed
      TG_OP,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END, 
      'user'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Don't block operations due to audit failures
  RAISE NOTICE 'Audit log failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;