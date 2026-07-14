
CREATE OR REPLACE FUNCTION public.list_workspace_spaces_for_duplication(_workspace_id UUID)
RETURNS TABLE(id UUID, name TEXT, icon TEXT, color TEXT, sort_order INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.name, s.icon, s.color, s.sort_order
  FROM public.spaces s
  WHERE s.workspace_id = _workspace_id
    AND s.is_archived = false
    AND public.is_workspace_member(auth.uid(), s.workspace_id)
  ORDER BY s.sort_order ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_workspace_spaces_for_duplication(UUID) TO authenticated;
