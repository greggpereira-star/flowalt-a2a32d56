-- Allow workspace members to update cards that are mirrored into any space they belong to.
-- Fixes: users viewing a mirrored card via card_spaces couldn't save briefing edits
-- because the previous UPDATE policy required ownership/admin/card membership only.

DROP POLICY IF EXISTS cards_update_no_recursion ON public.cards;

CREATE POLICY cards_update_no_recursion
ON public.cards
FOR UPDATE
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR is_card_member(auth.uid(), id)
  OR EXISTS (
    SELECT 1
    FROM public.card_spaces cs
    JOIN public.spaces s ON s.id = cs.space_id
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE cs.card_id = cards.id
      AND wm.user_id = auth.uid()
  )
);
