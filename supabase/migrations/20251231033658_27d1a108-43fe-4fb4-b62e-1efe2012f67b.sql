-- Create table for card-level guest invitations
CREATE TABLE public.card_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'comment', 'edit')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, email)
);

-- Enable RLS
ALTER TABLE public.card_invites ENABLE ROW LEVEL SECURITY;

-- Policies for card_invites
CREATE POLICY "Users can view invites for cards they can access"
ON public.card_invites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = card_invites.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
  )
  OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Workspace members can create invites"
ON public.card_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = card_invites.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
  )
);

CREATE POLICY "Invite creators can update their invites"
ON public.card_invites FOR UPDATE
USING (
  invited_by = auth.uid()
  OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Invite creators can delete their invites"
ON public.card_invites FOR DELETE
USING (invited_by = auth.uid());

-- Add index for faster lookups
CREATE INDEX idx_card_invites_card_id ON public.card_invites(card_id);
CREATE INDEX idx_card_invites_email ON public.card_invites(email);
CREATE INDEX idx_card_invites_token ON public.card_invites(token);

-- Create updated_at trigger
CREATE TRIGGER update_card_invites_updated_at
BEFORE UPDATE ON public.card_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();