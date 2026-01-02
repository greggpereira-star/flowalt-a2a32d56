-- ========================================================
-- PERMISSION REGRESSION HARDENING - COMPLETE FIX
-- Create all functions FIRST, then policies
-- ========================================================

-- 1. Create SECURITY DEFINER function to check card membership WITHOUT recursion
CREATE OR REPLACE FUNCTION public.is_card_member(_user_id uuid, _card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.card_members
    WHERE user_id = _user_id
      AND card_id = _card_id
  )
$$;

-- 2. Create function to check checklist ownership
CREATE OR REPLACE FUNCTION public.can_delete_checklist(_user_id uuid, _checklist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.checklists ch
    JOIN public.cards c ON c.id = ch.card_id
    WHERE ch.id = _checklist_id
    AND (
      -- Elevated roles can delete any checklist
      has_admin_access(_user_id, c.workspace_id)
      -- Checklist assignee can delete their own
      OR ch.assignee_id = _user_id
      -- Card owner can delete checklists
      OR c.owner_id = _user_id
    )
  )
$$;

-- 3. Create function for space access
CREATE OR REPLACE FUNCTION public.can_access_space(_user_id uuid, _space_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.id = _space_id
    AND (
      has_admin_access(_user_id, s.workspace_id)
      OR s.access_level = 'operational'
      OR (s.access_level = 'restricted' AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = _user_id
        AND ur.workspace_id = s.workspace_id
        AND ur.role = ANY(s.allowed_roles)
      ))
      OR is_super_admin_with_session(_user_id, s.workspace_id)
    )
  )
$$;

-- 4. Create function to check folder access
CREATE OR REPLACE FUNCTION public.can_access_folder(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.id = _folder_id
    AND (
      has_admin_access(_user_id, f.workspace_id)
      OR f.owner_id = _user_id
      OR COALESCE(f.is_restricted, false) = false
      OR is_folder_member(_user_id, _folder_id)
      OR is_super_admin_with_session(_user_id, f.workspace_id)
    )
  )
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_card_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_checklist(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_space(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_folder(uuid, uuid) TO authenticated;

-- ========================================================
-- NOW FIX THE POLICIES (functions exist now)
-- ========================================================

-- Drop problematic cards policies
DROP POLICY IF EXISTS "cards_select_with_visibility" ON public.cards;
DROP POLICY IF EXISTS "Card members and admins can update cards" ON public.cards;
DROP POLICY IF EXISTS "cards_select_no_recursion" ON public.cards;
DROP POLICY IF EXISTS "cards_update_no_recursion" ON public.cards;

-- Drop problematic card_members policies
DROP POLICY IF EXISTS "Members can view card members" ON public.card_members;
DROP POLICY IF EXISTS "Card owners and admins can manage card members" ON public.card_members;
DROP POLICY IF EXISTS "card_members_select_no_recursion" ON public.card_members;
DROP POLICY IF EXISTS "card_members_manage_no_recursion" ON public.card_members;

-- Recreate cards SELECT without recursion
CREATE POLICY "cards_select_no_recursion"
ON public.cards FOR SELECT
USING (
  (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      has_admin_access(auth.uid(), workspace_id)
      OR owner_id = auth.uid()
      OR created_by = auth.uid()
      OR COALESCE(visibility, 'inherit') != 'restricted'
      OR is_card_member(auth.uid(), id)
    )
  )
  OR is_super_admin_with_session(auth.uid(), workspace_id)
);

-- Recreate cards UPDATE without recursion  
CREATE POLICY "cards_update_no_recursion"
ON public.cards FOR UPDATE
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR is_card_member(auth.uid(), id)
);

-- Recreate card_members SELECT without recursion
CREATE POLICY "card_members_select_no_recursion"
ON public.card_members FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id = card_members.card_id
    AND is_workspace_member(auth.uid(), c.workspace_id)
    AND (
      has_admin_access(auth.uid(), c.workspace_id)
      OR c.owner_id = auth.uid()
      OR c.created_by = auth.uid()
    )
  )
);

-- Recreate card_members ALL without recursion
CREATE POLICY "card_members_manage_no_recursion"
ON public.card_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id = card_members.card_id
    AND (
      c.owner_id = auth.uid()
      OR has_admin_access(auth.uid(), c.workspace_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id = card_members.card_id
    AND (
      c.owner_id = auth.uid()
      OR has_admin_access(auth.uid(), c.workspace_id)
    )
  )
);

-- ========================================================
-- Fix checklists delete policy
-- ========================================================

DROP POLICY IF EXISTS "checklists_delete_ownership" ON public.checklists;
DROP POLICY IF EXISTS "checklists_delete_with_ownership" ON public.checklists;

CREATE POLICY "checklists_delete_with_ownership"
ON public.checklists FOR DELETE
USING (can_delete_checklist(auth.uid(), id));

-- ========================================================
-- Fix notifications INSERT policy
-- ========================================================

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_service_or_self" ON public.notifications;

CREATE POLICY "notifications_insert_service_or_self"
ON public.notifications FOR INSERT
WITH CHECK (
  current_setting('role', true) = 'service_role'
  OR user_id = auth.uid()
);