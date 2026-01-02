-- Fix security warnings: set search_path on trigger functions
CREATE OR REPLACE FUNCTION public.update_user_saved_views_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_single_default_view()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_saved_views
    SET is_default = false
    WHERE workspace_id = NEW.workspace_id AND user_id = NEW.user_id AND scope_type = NEW.scope_type
      AND COALESCE(scope_id, '00000000-0000-0000-0000-000000000000') = COALESCE(NEW.scope_id, '00000000-0000-0000-0000-000000000000')
      AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;