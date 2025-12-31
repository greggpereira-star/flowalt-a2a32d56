-- Create security definer function to check if user owns a folder
CREATE OR REPLACE FUNCTION public.is_folder_owner(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folders
    WHERE id = _folder_id
      AND owner_id = _user_id
  )
$$;

-- Create function to check if user can access folder (owner OR admin)
CREATE OR REPLACE FUNCTION public.can_access_folder(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folders f
    WHERE f.id = _folder_id
      AND (
        f.owner_id = _user_id  -- Owner can access
        OR f.owner_id IS NULL  -- Shared folder (no owner)
        OR has_admin_access(_user_id, f.workspace_id)  -- Admin can access all
      )
  )
$$;

-- Create function to get workspace_id from folder_id
CREATE OR REPLACE FUNCTION public.get_folder_workspace_id(_folder_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.folders WHERE id = _folder_id LIMIT 1
$$;

-- Drop existing folder_views policies
DROP POLICY IF EXISTS "Users can manage folder views" ON public.folder_views;
DROP POLICY IF EXISTS "Users can view folder views" ON public.folder_views;

-- Create new folder_views policies with folder ownership check
CREATE POLICY "folder_views_select_policy" ON public.folder_views
FOR SELECT USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND can_access_folder(auth.uid(), folder_id)
);

CREATE POLICY "folder_views_insert_policy" ON public.folder_views
FOR INSERT WITH CHECK (
  is_workspace_member(auth.uid(), workspace_id)
  AND can_access_folder(auth.uid(), folder_id)
);

CREATE POLICY "folder_views_update_policy" ON public.folder_views
FOR UPDATE USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND can_access_folder(auth.uid(), folder_id)
);

CREATE POLICY "folder_views_delete_policy" ON public.folder_views
FOR DELETE USING (
  is_folder_owner(auth.uid(), folder_id) 
  OR has_admin_access(auth.uid(), workspace_id)
);

-- Update folders SELECT policy to filter by ownership for non-admins
DROP POLICY IF EXISTS "Members can view folders" ON public.folders;

CREATE POLICY "folders_select_policy" ON public.folders
FOR SELECT USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    owner_id = auth.uid()  -- Owner sees their folder
    OR owner_id IS NULL    -- Everyone sees shared folders
    OR has_admin_access(auth.uid(), workspace_id)  -- Admin sees all
  )
);

-- Update card_folders policies to respect folder ownership
DROP POLICY IF EXISTS "Members can manage card folders" ON public.card_folders;
DROP POLICY IF EXISTS "Members can view card folders" ON public.card_folders;

CREATE POLICY "card_folders_select_policy" ON public.card_folders
FOR SELECT USING (
  can_access_folder(auth.uid(), folder_id)
);

CREATE POLICY "card_folders_insert_policy" ON public.card_folders
FOR INSERT WITH CHECK (
  can_access_folder(auth.uid(), folder_id)
);

CREATE POLICY "card_folders_update_policy" ON public.card_folders
FOR UPDATE USING (
  can_access_folder(auth.uid(), folder_id)
);

CREATE POLICY "card_folders_delete_policy" ON public.card_folders
FOR DELETE USING (
  is_folder_owner(auth.uid(), folder_id)
  OR has_admin_access(auth.uid(), get_folder_workspace_id(folder_id))
);

-- Create index for folder owner lookups
CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON public.folders(owner_id);

-- Create index for folder_views folder lookups
CREATE INDEX IF NOT EXISTS idx_folder_views_folder_id ON public.folder_views(folder_id);