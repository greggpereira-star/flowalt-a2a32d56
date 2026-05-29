
-- Remove publicly readable invite policy and replace with a SECURITY DEFINER RPC
DROP POLICY IF EXISTS workspace_invites_select_by_token ON public.workspace_invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token uuid)
RETURNS TABLE (
  email text,
  role app_role,
  status text,
  expires_at timestamptz,
  revoked_at timestamptz,
  workspace_id uuid,
  workspace_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wi.email, wi.role, wi.status, wi.expires_at, wi.revoked_at,
         wi.workspace_id, w.name AS workspace_name
  FROM public.workspace_invites wi
  LEFT JOIN public.workspaces w ON w.id = wi.workspace_id
  WHERE wi.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;
