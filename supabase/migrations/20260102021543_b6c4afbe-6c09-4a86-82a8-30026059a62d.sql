-- Fix: allow workspace members to read and manage folder views (missing RLS policies)

ALTER TABLE public.folder_views ENABLE ROW LEVEL SECURITY;

-- Read folder views only when the user can see the parent folder
DROP POLICY IF EXISTS "folder_views_select_via_folder" ON public.folder_views;
CREATE POLICY "folder_views_select_via_folder" 
ON public.folder_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.folders f
    WHERE f.id = folder_views.folder_id
  )
);

-- Create folder views: only workspace members that either own the folder or have admin access
DROP POLICY IF EXISTS "folder_views_insert_manage" ON public.folder_views;
CREATE POLICY "folder_views_insert_manage"
ON public.folder_views
FOR INSERT
WITH CHECK (
  is_workspace_member(auth.uid(), workspace_id)
  AND (is_folder_owner(auth.uid(), folder_id) OR has_admin_access(auth.uid(), workspace_id))
  AND workspace_id = (
    SELECT f.workspace_id
    FROM public.folders f
    WHERE f.id = folder_views.folder_id
    LIMIT 1
  )
);

-- Update folder views: only folder owners or admins
DROP POLICY IF EXISTS "folder_views_update_manage" ON public.folder_views;
CREATE POLICY "folder_views_update_manage"
ON public.folder_views
FOR UPDATE
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (is_folder_owner(auth.uid(), folder_id) OR has_admin_access(auth.uid(), workspace_id))
)
WITH CHECK (
  is_workspace_member(auth.uid(), workspace_id)
  AND (is_folder_owner(auth.uid(), folder_id) OR has_admin_access(auth.uid(), workspace_id))
  AND workspace_id = (
    SELECT f.workspace_id
    FROM public.folders f
    WHERE f.id = folder_views.folder_id
    LIMIT 1
  )
);

-- Delete folder views: keep existing policy but ensure membership too
DROP POLICY IF EXISTS "folder_views_delete_policy" ON public.folder_views;
CREATE POLICY "folder_views_delete_policy"
ON public.folder_views
FOR DELETE
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (is_folder_owner(auth.uid(), folder_id) OR has_admin_access(auth.uid(), workspace_id))
);
