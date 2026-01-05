-- Add title field to social_posts table for better calendar visibility
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.social_posts.title IS 'Optional title for the post, displayed in calendar view for better readability';