-- Fix the execute_card_automations trigger function to cast status properly
CREATE OR REPLACE FUNCTION public.execute_card_automations()
RETURNS TRIGGER AS $$
DECLARE
  automation RECORD;
  v_action_config jsonb;
BEGIN
  -- Only run on status changes
  IF OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get active automations for this status
    FOR automation IN
      SELECT * FROM public.card_automations
      WHERE workspace_id = NEW.workspace_id
      AND trigger_status = NEW.status::text
      AND is_active = true
    LOOP
      v_action_config := automation.action_config;
      
      -- Log the automation execution
      INSERT INTO public.automation_logs (
        automation_id,
        card_id,
        trigger_status,
        action_type,
        action_result,
        success
      ) VALUES (
        automation.id,
        NEW.id,
        NEW.status::text,
        automation.action_type,
        jsonb_build_object('executed_at', now()),
        true
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;