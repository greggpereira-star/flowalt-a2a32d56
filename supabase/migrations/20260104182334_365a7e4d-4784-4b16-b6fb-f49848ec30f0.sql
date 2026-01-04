-- Add scopes column to oauth_states table
ALTER TABLE public.oauth_states 
ADD COLUMN IF NOT EXISTS scopes text;