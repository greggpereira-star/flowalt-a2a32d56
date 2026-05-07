-- Create junction table for many-to-many relationship between cards and spaces
CREATE TABLE IF NOT EXISTS public.card_spaces (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(card_id, space_id)
);

-- Enable RLS
ALTER TABLE public.card_spaces ENABLE ROW LEVEL SECURITY;

-- Policies for card_spaces
CREATE POLICY "Users can view card_spaces in their workspace"
ON public.card_spaces
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.cards c
        JOIN public.spaces s ON s.id = c.space_id
        WHERE c.id = card_spaces.card_id
    )
);

CREATE POLICY "Users can insert card_spaces"
ON public.card_spaces
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.cards c
        WHERE c.id = card_id
    )
);

CREATE POLICY "Users can delete card_spaces"
ON public.card_spaces
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.cards c
        WHERE c.id = card_id
    )
);

-- Migrate existing cards to the junction table
INSERT INTO public.card_spaces (card_id, space_id)
SELECT id, space_id FROM public.cards
ON CONFLICT (card_id, space_id) DO NOTHING;
