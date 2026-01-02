-- Fix the audit_entity_changes trigger to properly cast entity_id to uuid
CREATE OR REPLACE FUNCTION audit_entity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_action text;
BEGIN
  -- Determine action
  v_action := TG_OP;
  
  -- Get workspace_id from the record
  IF TG_OP = 'DELETE' THEN
    v_workspace_id := OLD.workspace_id;
  ELSE
    v_workspace_id := NEW.workspace_id;
  END IF;
  
  -- Skip if no workspace_id
  IF v_workspace_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Insert audit log with proper UUID casting
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    v_workspace_id, 
    auth.uid(), 
    v_action, 
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;