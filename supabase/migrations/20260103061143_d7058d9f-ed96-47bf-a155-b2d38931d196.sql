-- Create oauth_states table for storing OAuth flow state (anti-CSRF)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  code_verifier TEXT,
  return_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup of expired states
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- RLS for oauth_states (service role only - no public access)
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access this table
-- This is correct because OAuth flow is handled entirely server-side

-- Add unique constraint to social_platforms if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'social_platforms_workspace_platform_account_unique'
  ) THEN
    ALTER TABLE public.social_platforms 
    ADD CONSTRAINT social_platforms_workspace_platform_account_unique 
    UNIQUE (workspace_id, platform, account_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create function to cleanup expired OAuth states
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_states WHERE expires_at < now();
END;
$$;

-- Add processing columns to social_posts if not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'social_posts' 
    AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE public.social_posts ADD COLUMN processing_started_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'social_posts' 
    AND column_name = 'processing_completed_at'
  ) THEN
    ALTER TABLE public.social_posts ADD COLUMN processing_completed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'social_posts' 
    AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.social_posts ADD COLUMN job_id TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'social_posts' 
    AND column_name = 'last_error_code'
  ) THEN
    ALTER TABLE public.social_posts ADD COLUMN last_error_code TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'social_posts' 
    AND column_name = 'last_error_message'
  ) THEN
    ALTER TABLE public.social_posts ADD COLUMN last_error_message TEXT;
  END IF;
END $$;