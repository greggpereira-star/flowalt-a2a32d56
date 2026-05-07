-- Trigger for checklist item completion
CREATE OR REPLACE FUNCTION public.on_checklist_item_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.card_history (card_id, action_type, new_value, field_name)
        VALUES (NEW.card_id, 'checklist_change', jsonb_build_object('item_title', NEW.title, 'action', 'created'), 'checklist');
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.is_completed IS DISTINCT FROM NEW.is_completed) THEN
            INSERT INTO public.card_history (card_id, action_type, old_value, new_value, field_name)
            VALUES (NEW.card_id, 'checklist_change', 
                jsonb_build_object('is_completed', OLD.is_completed), 
                jsonb_build_object('is_completed', NEW.is_completed, 'item_title', NEW.title), 
                'is_completed');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tr_checklist_item_change ON public.checklists;
CREATE TRIGGER tr_checklist_item_change
AFTER INSERT OR UPDATE ON public.checklists
FOR EACH ROW
EXECUTE FUNCTION public.on_checklist_item_change();

-- Trigger for time entry logging
CREATE OR REPLACE FUNCTION public.on_time_entry_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.is_running IS TRUE AND NEW.is_running IS FALSE) THEN
        INSERT INTO public.card_history (card_id, action_type, new_value, field_name)
        VALUES (NEW.card_id, 'time_log', 
            jsonb_build_object('duration_seconds', NEW.duration_seconds, 'user_id', NEW.user_id), 
            'duration_seconds');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tr_time_entry_change ON public.time_entries;
CREATE TRIGGER tr_time_entry_change
AFTER UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.on_time_entry_change();
