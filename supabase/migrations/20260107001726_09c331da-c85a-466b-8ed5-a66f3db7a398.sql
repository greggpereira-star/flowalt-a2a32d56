-- Add card_type column to distinguish quick cards from full briefing cards
-- 'quick' = simplified flow without briefing requirements
-- 'full' = complete flow with briefing, checklist, and validation gates

ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS card_type text NOT NULL DEFAULT 'full' 
CHECK (card_type IN ('quick', 'full'));

-- Add comment explaining the column
COMMENT ON COLUMN public.cards.card_type IS 'Card type: quick (no briefing/validation) or full (complete process with briefing)';

-- Update due_date column comment to clarify it stores datetime (it already stores timestamp with time zone)
COMMENT ON COLUMN public.cards.due_date IS 'Deadline datetime (date + time) for the card. Cards are considered overdue when current time exceeds this value.';

-- Add birthday column to profiles table for birthday tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birthday date;

COMMENT ON COLUMN public.profiles.birthday IS 'User birthday (day/month/year) for anniversary tracking';