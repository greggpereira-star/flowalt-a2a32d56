-- =============================================
-- FIX: Policy accessing auth.users directly
-- Error: "permission denied for table users"
-- =============================================

-- Step 1: Create a SECURITY DEFINER function to safely get user email
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::text FROM auth.users WHERE id = _user_id;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;

-- Step 2: Drop the problematic policy
DROP POLICY IF EXISTS "workspace_members_insert_admin_v2" ON public.workspace_members;

-- Step 3: Recreate the policy using the SECURITY DEFINER function
CREATE POLICY "workspace_members_insert_admin_v2" 
ON public.workspace_members
FOR INSERT
TO public
WITH CHECK (
  -- Admin can add members
  has_admin_access(auth.uid(), workspace_id) 
  OR 
  -- User can add themselves if they have an accepted invite
  (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1
      FROM workspace_invites wi
      WHERE wi.workspace_id = workspace_members.workspace_id 
        AND wi.email = public.get_user_email(auth.uid())
        AND wi.status = 'accepted'
    )
  )
  OR
  -- User can always insert themselves (for workspace creation flow)
  (auth.uid() = user_id)
);

-- Step 4: Verify the existing "Users can insert themselves as members" policy doesn't conflict
-- Keep it simple - this policy allows self-insert during workspace creation
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.workspace_members;

CREATE POLICY "Users can insert themselves as members" 
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Step 5: Also fix any other policies that might reference auth.users directly
-- Check workspace_invites policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE (qual::text ILIKE '%auth.users%' OR with_check::text ILIKE '%auth.users%')
      AND tablename != 'workspace_members'
  LOOP
    RAISE NOTICE 'Found policy % on table % that references auth.users', pol.policyname, pol.tablename;
  END LOOP;
END $$;