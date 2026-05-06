-- Allow members to view other members in the same workspace
CREATE POLICY "Members can view other members in same workspace" 
ON public.workspace_members 
FOR SELECT 
USING (
  is_workspace_member(auth.uid(), workspace_id)
);

-- Allow members to view other members' roles in the same workspace
CREATE POLICY "Members can view other members' roles in same workspace" 
ON public.user_roles 
FOR SELECT 
USING (
  is_workspace_member(auth.uid(), workspace_id)
);
