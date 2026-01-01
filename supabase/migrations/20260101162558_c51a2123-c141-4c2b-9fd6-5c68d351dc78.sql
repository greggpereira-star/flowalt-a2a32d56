
-- =====================================================
-- BLUEPRINT GOVERNANCE: STEP 4 - Folder-Level ACL
-- + STEP 5 - Card-Level ACL
-- =====================================================

-- STEP 4: Add is_restricted to folders
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT false;

-- STEP 4: Create folder_members table for granular access
CREATE TABLE IF NOT EXISTS public.folder_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'manage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(folder_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_folder_members_folder ON public.folder_members(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_members_user ON public.folder_members(user_id);

-- Enable RLS
ALTER TABLE public.folder_members ENABLE ROW LEVEL SECURITY;

-- RLS for folder_members
CREATE POLICY "folder_members_select"
  ON public.folder_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_members.folder_id
      AND has_admin_access(auth.uid(), f.workspace_id)
    )
  );

CREATE POLICY "folder_members_manage_admins"
  ON public.folder_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_members.folder_id
      AND (has_admin_access(auth.uid(), f.workspace_id) OR f.owner_id = auth.uid())
    )
  );

-- STEP 4: Update can_access_folder function to include folder_members and is_restricted
CREATE OR REPLACE FUNCTION public.can_access_folder(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folders f
    WHERE f.id = _folder_id
      AND (
        -- Admin can access all folders in workspace
        has_admin_access(_user_id, f.workspace_id)
        -- Owner of the folder
        OR f.owner_id = _user_id
        -- Shared folder (no owner) and not restricted
        OR (f.owner_id IS NULL AND f.is_restricted = false)
        -- Explicit member of restricted folder
        OR (f.is_restricted = true AND EXISTS (
          SELECT 1 FROM folder_members fm
          WHERE fm.folder_id = f.id AND fm.user_id = _user_id
        ))
        -- Non-restricted folder without owner
        OR (f.is_restricted = false AND f.owner_id IS NULL)
      )
  )
$$;

-- Update folders RLS to use enhanced can_access_folder
DROP POLICY IF EXISTS "folders_select_policy" ON public.folders;

CREATE POLICY "folders_select_with_acl"
  ON public.folders FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND can_access_folder(auth.uid(), id)
  );

-- STEP 5: Add visibility to cards
ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'inherit' 
  CHECK (visibility IN ('inherit', 'restricted', 'public'));

-- STEP 5: Update can_access_card function
CREATE OR REPLACE FUNCTION public.can_access_card(_user_id UUID, _card_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    WHERE c.id = _card_id
      AND (
        -- Admin can access all cards
        has_admin_access(_user_id, c.workspace_id)
        -- Owner of the card
        OR c.owner_id = _user_id
        -- Creator of the card
        OR c.created_by = _user_id
        -- Explicit card member
        OR EXISTS (
          SELECT 1 FROM card_members cm
          WHERE cm.card_id = c.id AND cm.user_id = _user_id
        )
        -- Public cards visible to all workspace members
        OR (c.visibility = 'public' AND is_workspace_member(_user_id, c.workspace_id))
        -- Inherit visibility: check folder access
        OR (c.visibility = 'inherit' AND EXISTS (
          SELECT 1 FROM card_folders cf
          WHERE cf.card_id = c.id AND can_access_folder(_user_id, cf.folder_id)
        ))
        -- Cards without folder association and inherit visibility
        OR (c.visibility = 'inherit' AND NOT EXISTS (
          SELECT 1 FROM card_folders cf WHERE cf.card_id = c.id
        ) AND is_workspace_member(_user_id, c.workspace_id))
      )
  )
$$;

-- Update cards RLS to use enhanced ACL
DROP POLICY IF EXISTS "Members can view cards" ON public.cards;

CREATE POLICY "cards_select_with_acl"
  ON public.cards FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND can_access_card(auth.uid(), id)
  );

-- STEP 6: Update DELETE policies for ownership rules

-- Cards: Owner/Admin/Coordinator can delete, OR creator can delete their own
DROP POLICY IF EXISTS "Admins can delete cards" ON public.cards;

CREATE POLICY "cards_delete_with_ownership"
  ON public.cards FOR DELETE
  USING (
    has_admin_access(auth.uid(), workspace_id)
    OR created_by = auth.uid()
    OR owner_id = auth.uid()
  );

-- Folders: Admin can delete, OR owner can delete their own folder
DROP POLICY IF EXISTS "Admins can delete folders" ON public.folders;

CREATE POLICY "folders_delete_with_ownership"
  ON public.folders FOR DELETE
  USING (
    -- Cannot delete system folders
    is_system = false
    AND (
      has_admin_access(auth.uid(), workspace_id)
      OR owner_id = auth.uid()
    )
  );

-- Checklists: Owner/Admin/Card owner/Card creator can delete
DROP POLICY IF EXISTS "Card members can manage checklists" ON public.checklists;

CREATE POLICY "checklists_manage_with_ownership"
  ON public.checklists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = checklists.card_id
      AND (
        has_admin_access(auth.uid(), c.workspace_id)
        OR c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM card_members cm
          WHERE cm.card_id = c.id AND cm.user_id = auth.uid()
        )
      )
    )
  );

-- Comments: User can delete their own, or admin can delete any
DROP POLICY IF EXISTS "Users can delete their own comments or admins" ON public.comments;

CREATE POLICY "comments_delete_with_ownership"
  ON public.comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = comments.card_id
      AND has_admin_access(auth.uid(), c.workspace_id)
    )
  );
