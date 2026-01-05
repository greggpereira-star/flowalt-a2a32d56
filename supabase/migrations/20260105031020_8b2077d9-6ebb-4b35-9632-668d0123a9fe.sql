-- Add is_active column to social_platform_assets
-- This allows selecting multiple assets and marking which ones are active for posting
ALTER TABLE public.social_platform_assets 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add index for efficient querying of active assets
CREATE INDEX IF NOT EXISTS idx_social_platform_assets_active 
ON public.social_platform_assets (platform_connection_id, is_active) 
WHERE is_active = true;

-- Update existing assets to be active by default
UPDATE public.social_platform_assets SET is_active = true WHERE is_active IS NULL;