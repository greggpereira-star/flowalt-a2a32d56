-- Add missing columns for Instagram linked page info
ALTER TABLE public.social_platforms
ADD COLUMN IF NOT EXISTS linked_page_id TEXT,
ADD COLUMN IF NOT EXISTS linked_page_name TEXT;

-- Add index for linked page lookups
CREATE INDEX IF NOT EXISTS idx_social_platforms_linked_page 
ON public.social_platforms(linked_page_id) 
WHERE linked_page_id IS NOT NULL;