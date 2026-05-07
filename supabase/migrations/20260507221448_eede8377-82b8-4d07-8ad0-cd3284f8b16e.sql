-- Remove problematic policies
DROP POLICY IF EXISTS "Users can view card_spaces for accessible spaces" ON public.card_spaces;
DROP POLICY IF EXISTS "Users can insert card_spaces" ON public.card_spaces;
DROP POLICY IF EXISTS "Users can delete card_spaces" ON public.card_spaces;
DROP POLICY IF EXISTS "Users can view cards shared with their spaces" ON public.cards;

-- Create simplified card_spaces policies that don't depend on 'cards' SELECT
CREATE POLICY "card_spaces_select_simplified" 
ON public.card_spaces 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces s
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE s.id = card_spaces.space_id 
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "card_spaces_insert_simplified" 
ON public.card_spaces 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.spaces s
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE s.id = space_id 
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "card_spaces_delete_simplified" 
ON public.card_spaces 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces s
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE s.id = space_id 
    AND wm.user_id = auth.uid()
  )
);

-- Create simplified cards SELECT policy that doesn't depend on 'card_spaces' triggering its own recursion
-- This policy allows viewing cards that are linked to a space the user has access to.
-- We use a direct check that avoids triggering the 'card_spaces' RLS if possible, 
-- but since 'card_spaces' now has a simple policy, it should be fine.
CREATE POLICY "cards_view_via_spaces" 
ON public.cards 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.card_spaces cs
    JOIN public.spaces s ON s.id = cs.space_id
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE cs.card_id = cards.id 
    AND wm.user_id = auth.uid()
  )
);
