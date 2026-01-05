-- Add account metrics columns to social_platforms table
ALTER TABLE public.social_platforms
ADD COLUMN IF NOT EXISTS account_metrics JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS account_metrics_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for metrics sync queries
CREATE INDEX IF NOT EXISTS idx_social_platforms_metrics_sync 
ON public.social_platforms (is_active, account_metrics_updated_at)
WHERE is_active = true;

-- Comment on columns
COMMENT ON COLUMN public.social_platforms.account_metrics IS 'Account-level metrics: followers, following, posts count, etc.';
COMMENT ON COLUMN public.social_platforms.account_metrics_updated_at IS 'When account metrics were last updated';