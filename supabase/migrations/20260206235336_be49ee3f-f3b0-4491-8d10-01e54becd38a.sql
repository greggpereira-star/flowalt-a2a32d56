-- Add start_date column to cards table
ALTER TABLE public.cards 
ADD COLUMN start_date TIMESTAMP WITH TIME ZONE;