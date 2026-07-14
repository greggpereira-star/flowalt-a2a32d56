
DROP POLICY IF EXISTS card_members_manage_no_recursion ON public.card_members;

CREATE POLICY card_members_manage_no_recursion
ON public.card_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id = card_members.card_id
      AND (
        c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR public.has_admin_access(auth.uid(), c.workspace_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id = card_members.card_id
      AND (
        c.owner_id = auth.uid()
        OR c.created_by = auth.uid()
        OR public.has_admin_access(auth.uid(), c.workspace_id)
        OR (card_members.user_id = auth.uid() AND public.is_workspace_member(auth.uid(), c.workspace_id))
      )
  )
);
