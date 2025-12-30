-- Create event types enum
CREATE TYPE public.event_type AS ENUM ('meeting', 'recording', 'milestone', 'deadline', 'other');

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type public.event_type NOT NULL DEFAULT 'meeting',
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  color TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event participants junction table
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for events
CREATE POLICY "Members can view events"
ON public.events FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create events"
ON public.events FOR INSERT
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Event creators and admins can update events"
ON public.events FOR UPDATE
USING (created_by = auth.uid() OR has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Event creators and admins can delete events"
ON public.events FOR DELETE
USING (created_by = auth.uid() OR has_admin_access(auth.uid(), workspace_id));

-- RLS policies for event_participants
CREATE POLICY "Members can view event participants"
ON public.event_participants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM events e
  WHERE e.id = event_participants.event_id
  AND is_workspace_member(auth.uid(), e.workspace_id)
));

CREATE POLICY "Event creators can manage participants"
ON public.event_participants FOR ALL
USING (EXISTS (
  SELECT 1 FROM events e
  WHERE e.id = event_participants.event_id
  AND (e.created_by = auth.uid() OR has_admin_access(auth.uid(), e.workspace_id))
));

CREATE POLICY "Users can update their own participation"
ON public.event_participants FOR UPDATE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_events_workspace ON public.events(workspace_id);
CREATE INDEX idx_events_start_time ON public.events(start_time);
CREATE INDEX idx_events_card ON public.events(card_id);
CREATE INDEX idx_events_space ON public.events(space_id);
CREATE INDEX idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX idx_event_participants_user ON public.event_participants(user_id);