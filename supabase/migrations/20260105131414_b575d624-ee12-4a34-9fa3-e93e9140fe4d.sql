-- Add engagement fields to social_posts table
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS location_id TEXT,
ADD COLUMN IF NOT EXISTS location_name TEXT,
ADD COLUMN IF NOT EXISTS user_tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS alt_text TEXT;

-- Add comments explaining the fields
COMMENT ON COLUMN public.social_posts.location_id IS 'Facebook Places ID for location tagging';
COMMENT ON COLUMN public.social_posts.location_name IS 'Display name for the location';
COMMENT ON COLUMN public.social_posts.user_tags IS 'Array of user tags with username and x,y coordinates';
COMMENT ON COLUMN public.social_posts.alt_text IS 'Alternative text for accessibility on images';