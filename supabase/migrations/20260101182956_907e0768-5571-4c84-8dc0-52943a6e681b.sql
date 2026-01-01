
-- Fix RLS recursion risk and ensure users can always load their own workspaces

-- workspace_members: allow users to read their own membership rows (needed to list their workspaces)
DROP POLICY IF EXISTS "Users can view own memberships and workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;

CREATE POLICY "Users can view own workspace memberships"
ON public.workspace_members
FOR SELECT
USING (user_id = auth.uid());

-- Optional: admins/owners/coordinators can view members of their workspaces
CREATE POLICY "Admins can view workspace members"
ON public.workspace_members
FOR SELECT
USING (has_admin_access(auth.uid(), workspace_id));


-- user_roles: keep admin manage policy as-is; ensure basic SELECT works for current user
DROP POLICY IF EXISTS "Users can view own role and workspace roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their workspaces" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());
