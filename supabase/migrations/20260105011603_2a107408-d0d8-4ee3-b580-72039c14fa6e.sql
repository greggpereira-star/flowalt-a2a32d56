-- Add missing column last_validated_at to social_platforms
ALTER TABLE public.social_platforms
ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;