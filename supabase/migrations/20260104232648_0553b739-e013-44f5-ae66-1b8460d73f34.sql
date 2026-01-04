-- Add asset_token_encrypted column to social_platforms table
-- This column stores the page access token selected during asset selection
ALTER TABLE public.social_platforms 
ADD COLUMN IF NOT EXISTS asset_token_encrypted TEXT;