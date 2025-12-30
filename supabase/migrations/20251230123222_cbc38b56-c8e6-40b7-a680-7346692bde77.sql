-- Create card_automations table for automation rules
CREATE TABLE public.card_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_status TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'change_status', 'assign_user', 'add_comment', 'send_notification', 'set_urgency'
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.card_automations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view automations"
  ON public.card_automations FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage automations"
  ON public.card_automations FOR ALL
  USING (public.has_admin_access(auth.uid(), workspace_id));

-- Create automation_logs table to track automation executions
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.card_automations(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  trigger_status TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_result JSONB,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view automation logs"
  ON public.automation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.card_automations a
      WHERE a.id = automation_id
      AND public.is_workspace_member(auth.uid(), a.workspace_id)
    )
  );

-- Function to execute automations when card status changes
CREATE OR REPLACE FUNCTION public.execute_card_automations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  automation RECORD;
  action_result JSONB;
BEGIN
  -- Only run on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Find matching automations
  FOR automation IN
    SELECT * FROM public.card_automations
    WHERE workspace_id = NEW.workspace_id
    AND trigger_status = NEW.status
    AND is_active = true
  LOOP
    action_result := jsonb_build_object(
      'previous_status', OLD.status,
      'new_status', NEW.status,
      'executed_at', now()
    );

    -- Execute based on action type
    CASE automation.action_type
      WHEN 'change_status' THEN
        UPDATE public.cards
        SET status = (automation.action_config->>'target_status')::card_status
        WHERE id = NEW.id;
        action_result := action_result || jsonb_build_object('target_status', automation.action_config->>'target_status');
      
      WHEN 'set_urgency' THEN
        UPDATE public.cards
        SET urgency = (automation.action_config->>'target_urgency')::card_urgency
        WHERE id = NEW.id;
        action_result := action_result || jsonb_build_object('target_urgency', automation.action_config->>'target_urgency');
      
      WHEN 'add_comment' THEN
        INSERT INTO public.comments (card_id, user_id, content)
        VALUES (
          NEW.id,
          COALESCE(NEW.owner_id, NEW.created_by),
          automation.action_config->>'comment_text'
        );
        action_result := action_result || jsonb_build_object('comment', automation.action_config->>'comment_text');
      
      WHEN 'send_notification' THEN
        INSERT INTO public.notifications (
          workspace_id,
          user_id,
          type,
          title,
          message,
          metadata
        )
        SELECT
          NEW.workspace_id,
          user_id,
          'automation',
          automation.action_config->>'notification_title',
          automation.action_config->>'notification_message',
          jsonb_build_object('card_id', NEW.id, 'automation_id', automation.id)
        FROM public.card_members
        WHERE card_id = NEW.id;
        action_result := action_result || jsonb_build_object('notification_sent', true);
      
      ELSE
        action_result := action_result || jsonb_build_object('action', 'unknown');
    END CASE;

    -- Log the execution
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
      NEW.status,
      automation.action_type,
      action_result,
      true
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for card status changes
CREATE TRIGGER on_card_status_change_automation
  AFTER UPDATE OF status ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.execute_card_automations();

-- Update timestamp trigger
CREATE TRIGGER update_card_automations_updated_at
  BEFORE UPDATE ON public.card_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();