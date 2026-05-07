-- Create card history table for auditing
CREATE TABLE IF NOT EXISTS public.card_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'created', 'updated', 'status_change', 'space_shared', 'checklist_change', 'time_log'
    old_value JSONB,
    new_value JSONB,
    field_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on card_history
ALTER TABLE public.card_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of cards they can see"
ON public.card_history
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.card_spaces cs
        WHERE cs.card_id = card_history.card_id
        AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid()
        )
    )
);

-- Function to record card space sharing history
CREATE OR REPLACE FUNCTION public.on_card_space_added()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.card_history (card_id, action_type, new_value, field_name)
    VALUES (NEW.card_id, 'space_shared', jsonb_build_object('space_id', NEW.space_id), 'space_id');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for space sharing history
DROP TRIGGER IF EXISTS tr_card_space_added ON public.card_spaces;
CREATE TRIGGER tr_card_space_added
AFTER INSERT ON public.card_spaces
FOR EACH ROW
EXECUTE FUNCTION public.on_card_space_added();

-- Policy improvement for card_spaces to ensure users only see links for spaces they have access to
DROP POLICY IF EXISTS "Users can view card_spaces in their workspace" ON public.card_spaces;
CREATE POLICY "Users can view card_spaces for accessible spaces"
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

-- Ensure policies on cards are aligned with card_spaces
DROP POLICY IF EXISTS "Users can view cards in their workspace" ON public.cards;
CREATE POLICY "Users can view cards shared with their spaces"
ON public.cards
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.card_spaces cs
        JOIN public.spaces s ON s.id = cs.space_id
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE cs.card_id = cards.id
        AND wm.user_id = auth.uid()
    )
);
