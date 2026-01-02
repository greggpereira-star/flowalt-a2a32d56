-- Remove the duplicate function with uuid parameter to resolve ambiguity
DROP FUNCTION IF EXISTS public.accept_workspace_invite(uuid);

-- The remaining function with text parameter handles the conversion internally