-- Fix function search path for update_social_updated_at
CREATE OR REPLACE FUNCTION public.update_social_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;