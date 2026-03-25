ALTER TABLE public.client_cards 
ADD COLUMN IF NOT EXISTS contract_start_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contract_end_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_day integer DEFAULT NULL;