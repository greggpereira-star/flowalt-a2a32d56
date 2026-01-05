-- Add platform_connection_id to social_posts to link to connected accounts
ALTER TABLE public.social_posts
ADD COLUMN platform_connection_id uuid REFERENCES public.social_platforms(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_social_posts_platform_connection ON public.social_posts(platform_connection_id);

-- Add comment for documentation
COMMENT ON COLUMN public.social_posts.platform_connection_id IS 'Reference to the connected social platform account used for publishing';