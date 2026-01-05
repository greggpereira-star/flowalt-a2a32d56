-- Fix the validate_social_post_transition trigger function
-- The domain_events table uses aggregate_type/aggregate_id, not entity_type/entity_id

CREATE OR REPLACE FUNCTION validate_social_post_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "draft": ["pending_approval", "scheduled", "archived"],
    "pending_approval": ["scheduled", "draft", "archived"],
    "scheduled": ["publishing", "error", "draft", "archived"],
    "publishing": ["published", "error", "failed"],
    "published": ["archived"],
    "failed": ["scheduled", "draft", "archived"],
    "error": ["scheduled", "draft", "archived"],
    "archived": []
  }'::JSONB;
  allowed_targets JSONB;
BEGIN
  -- If status didn't change, allow the update
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Check if the transition is valid
  allowed_targets := valid_transitions -> OLD.status;
  
  IF allowed_targets IS NULL OR NOT (allowed_targets ? NEW.status) THEN
    RAISE EXCEPTION 'Transição de status inválida: % -> %. Transições permitidas: %', 
      OLD.status, NEW.status, allowed_targets;
  END IF;
  
  -- Log the status change event (using correct column names for domain_events)
  INSERT INTO domain_events (workspace_id, event_type, aggregate_type, aggregate_id, payload)
  VALUES (
    NEW.workspace_id,
    'social_post.status_changed',
    'social_post',
    NEW.id,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'card_id', NEW.card_id,
      'platform', NEW.platform
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;