-- Drop existing restrictive update/delete policies for events
DROP POLICY IF EXISTS "Event creators and admins can update events" ON public.events;
DROP POLICY IF EXISTS "Event creators and admins can delete events" ON public.events;

-- Create new policies allowing any workspace member to update/delete events
CREATE POLICY "Members can update events in their workspace" 
ON public.events 
FOR UPDATE 
USING (
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Members can delete events in their workspace" 
ON public.events 
FOR DELETE 
USING (
  is_workspace_member(auth.uid(), workspace_id)
);

-- Drop existing restrictive policy for event participants
DROP POLICY IF EXISTS "Event creators can manage participants" ON public.event_participants;

-- Create new policy allowing any workspace member to manage participants for events in their workspace
CREATE POLICY "Members can manage participants for events in their workspace" 
ON public.event_participants 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_participants.event_id
    AND is_workspace_member(auth.uid(), e.workspace_id)
  )
);
