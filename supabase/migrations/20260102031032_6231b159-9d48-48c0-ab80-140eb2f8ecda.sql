-- Create helper function to check if user is member of workspace via folder
CREATE OR REPLACE FUNCTION is_workspace_member_for_folder(p_user_id uuid, p_folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM workspace_members wm
    JOIN folders f ON f.workspace_id = wm.workspace_id
    WHERE wm.user_id = p_user_id 
    AND f.id = p_folder_id
  )
$$;

-- Create SELECT policy for card_folders
CREATE POLICY "card_folders_select_policy"
ON public.card_folders
FOR SELECT
USING (
  is_workspace_member_for_folder(auth.uid(), folder_id)
);

-- Create INSERT policy for card_folders  
CREATE POLICY "card_folders_insert_policy"
ON public.card_folders
FOR INSERT
WITH CHECK (
  is_workspace_member_for_folder(auth.uid(), folder_id)
);

-- Create UPDATE policy for card_folders
CREATE POLICY "card_folders_update_policy"
ON public.card_folders
FOR UPDATE
USING (
  is_workspace_member_for_folder(auth.uid(), folder_id)
);