-- Update the UPDATE policy for folders to include folder members with can_edit permission
DROP POLICY IF EXISTS "Members can update their own folders or admins can update any" ON public.folders;
CREATE POLICY "Members can update their own folders or admins can update any" 
ON public.folders 
FOR UPDATE 
USING (
  (owner_id = auth.uid()) OR 
  has_admin_access(auth.uid(), workspace_id) OR
  EXISTS (
    SELECT 1 FROM public.folder_members 
    WHERE folder_id = folders.id 
    AND user_id = auth.uid() 
    AND can_edit = true
  )
);

-- Update the DELETE policy for folders to include folder members with can_delete permission
DROP POLICY IF EXISTS "folders_delete_with_ownership" ON public.folders;
CREATE POLICY "folders_delete_with_ownership" 
ON public.folders 
FOR DELETE 
USING (
  (is_system = false) AND (
    (has_admin_access(auth.uid(), workspace_id)) OR 
    (owner_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.folder_members 
      WHERE folder_id = folders.id 
      AND user_id = auth.uid() 
      AND can_delete = true
    )
  )
);
