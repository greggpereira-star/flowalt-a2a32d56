-- Create INSERT policy for card_history
-- This allows triggers running in the user's session context to insert records.
CREATE POLICY "Users can insert card_history" 
ON public.card_history 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cards c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = card_id 
    AND wm.user_id = auth.uid()
  )
);

-- Also ensure UPDATE/DELETE are restricted (usually history is read/append only)
-- But if there are existing problematic policies, we might need to clean up.
-- Based on the previous check, only a SELECT policy exists.
