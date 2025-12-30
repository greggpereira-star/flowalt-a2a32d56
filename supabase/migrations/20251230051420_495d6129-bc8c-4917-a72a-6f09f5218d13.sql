-- Create sprints table
CREATE TABLE public.sprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  goal TEXT,
  capacity_hours NUMERIC DEFAULT 0,
  allocated_hours NUMERIC DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sprint_cards junction table
CREATE TABLE public.sprint_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sprint_id UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_by UUID REFERENCES auth.users(id),
  UNIQUE(sprint_id, card_id)
);

-- Enable RLS
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for sprints
CREATE POLICY "Members can view sprints"
ON public.sprints FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage sprints"
ON public.sprints FOR ALL
USING (has_admin_access(auth.uid(), workspace_id));

-- RLS policies for sprint_cards
CREATE POLICY "Members can view sprint cards"
ON public.sprint_cards FOR SELECT
USING (EXISTS (
  SELECT 1 FROM sprints s
  WHERE s.id = sprint_cards.sprint_id
  AND is_workspace_member(auth.uid(), s.workspace_id)
));

CREATE POLICY "Admins can manage sprint cards"
ON public.sprint_cards FOR ALL
USING (EXISTS (
  SELECT 1 FROM sprints s
  WHERE s.id = sprint_cards.sprint_id
  AND has_admin_access(auth.uid(), s.workspace_id)
));

-- Trigger for updated_at
CREATE TRIGGER update_sprints_updated_at
BEFORE UPDATE ON public.sprints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_sprints_workspace ON public.sprints(workspace_id);
CREATE INDEX idx_sprints_status ON public.sprints(status);
CREATE INDEX idx_sprint_cards_sprint ON public.sprint_cards(sprint_id);
CREATE INDEX idx_sprint_cards_card ON public.sprint_cards(card_id);