-- ========================================================
-- FIX PLATFORM_SUPER_ADMINS RECURSION
-- ========================================================

-- Create SECURITY DEFINER function to check if user is platform super admin
CREATE OR REPLACE FUNCTION public.is_platform_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_super_admins
    WHERE user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_super_admin(uuid) TO authenticated;

-- Fix the recursive policy
DROP POLICY IF EXISTS "super_admins_select" ON public.platform_super_admins;

-- Recreate without recursion: super admins can see themselves
CREATE POLICY "super_admins_select_no_recursion"
ON public.platform_super_admins FOR SELECT
USING (
  -- Each user can see their own record
  user_id = auth.uid()
);

-- Also add policy for service role to manage
CREATE POLICY "super_admins_service_manage"
ON public.platform_super_admins FOR ALL
USING (
  current_setting('role', true) = 'service_role'
)
WITH CHECK (
  current_setting('role', true) = 'service_role'
);