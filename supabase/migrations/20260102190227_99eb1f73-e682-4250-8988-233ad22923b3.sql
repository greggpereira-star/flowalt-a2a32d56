
-- Remove duplicate trigger (keep only the new one)
DROP TRIGGER IF EXISTS seed_workspace_plan_trigger ON public.workspaces;

-- Also drop old function if it exists
DROP FUNCTION IF EXISTS public.seed_workspace_plan();
