-- ========================================================
-- FIX: cards.client_id should reference client_cards, not clients
-- The new client system uses client_cards table
-- ========================================================

-- 1. Drop the old FK constraint
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_client_id_fkey;

-- 2. Add new FK constraint pointing to client_cards
ALTER TABLE public.cards 
ADD CONSTRAINT cards_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES public.client_cards(id) 
ON DELETE SET NULL;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_cards_client_id ON public.cards(client_id);