-- Add time_alert to the categories if it's used by any preference check (handled in Edge Function logic)

-- Create a table for folder audit logs if we want something specific, 
-- but we already have audit_logs table. Let's ensure it's easy to use.

-- Create a trigger function to audit folder changes
CREATE OR REPLACE FUNCTION public.audit_folder_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_workspace_id UUID;
BEGIN
    -- Try to get current user from auth.uid()
    v_user_id := auth.uid();
    
    IF (TG_OP = 'UPDATE') THEN
        -- Only audit if name changed
        IF (OLD.name IS DISTINCT FROM NEW.name) THEN
            INSERT INTO public.audit_logs (
                workspace_id,
                user_id,
                action,
                entity_type,
                entity_id,
                old_data,
                new_data,
                metadata
            ) VALUES (
                NEW.workspace_id,
                v_user_id,
                'rename',
                'folder',
                NEW.id,
                jsonb_build_object('name', OLD.name),
                jsonb_build_object('name', NEW.name),
                jsonb_build_object('reason', 'User renamed folder')
            );
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (
            workspace_id,
            user_id,
            action,
            entity_type,
            entity_id,
            old_data,
            metadata
        ) VALUES (
            OLD.workspace_id,
            v_user_id,
            'delete',
            'folder',
            OLD.id,
            jsonb_build_object('name', OLD.name, 'space_id', OLD.space_id),
            jsonb_build_object('reason', 'User deleted folder')
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for folders
DROP TRIGGER IF EXISTS audit_folder_update ON public.folders;
CREATE TRIGGER audit_folder_update
AFTER UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.audit_folder_changes();

DROP TRIGGER IF EXISTS audit_folder_delete ON public.folders;
CREATE TRIGGER audit_folder_delete
AFTER DELETE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.audit_folder_changes();
