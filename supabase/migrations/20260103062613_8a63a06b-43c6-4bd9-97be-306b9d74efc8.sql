-- Add asset selection fields to social_platforms (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'social_platforms' AND column_name = 'platform_account_type') THEN
    ALTER TABLE public.social_platforms ADD COLUMN platform_account_type TEXT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'social_platforms' AND column_name = 'asset_selected_at') THEN
    ALTER TABLE public.social_platforms ADD COLUMN asset_selected_at TIMESTAMPTZ NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'social_platforms' AND column_name = 'last_tested_at') THEN
    ALTER TABLE public.social_platforms ADD COLUMN last_tested_at TIMESTAMPTZ NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'social_platforms' AND column_name = 'last_error_code') THEN
    ALTER TABLE public.social_platforms ADD COLUMN last_error_code TEXT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'social_platforms' AND column_name = 'last_error_message') THEN
    ALTER TABLE public.social_platforms ADD COLUMN last_error_message TEXT NULL;
  END IF;
END $$;

-- Create social_platform_assets table for storing available assets per connection
CREATE TABLE IF NOT EXISTS public.social_platform_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  platform_connection_id UUID NOT NULL REFERENCES public.social_platforms(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform_connection_id, asset_type, asset_id)
);

-- Enable RLS on social_platform_assets
ALTER TABLE public.social_platform_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_platform_assets (elevated roles only via user_roles table)
CREATE POLICY "Elevated roles can view assets" ON public.social_platform_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.workspace_id = social_platform_assets.workspace_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

CREATE POLICY "Elevated roles can insert assets" ON public.social_platform_assets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.workspace_id = social_platform_assets.workspace_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

CREATE POLICY "Elevated roles can update assets" ON public.social_platform_assets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.workspace_id = social_platform_assets.workspace_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

CREATE POLICY "Elevated roles can delete assets" ON public.social_platform_assets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.workspace_id = social_platform_assets.workspace_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_platform_assets_workspace ON public.social_platform_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_platform_assets_connection ON public.social_platform_assets(platform_connection_id);
CREATE INDEX IF NOT EXISTS idx_social_platform_assets_type ON public.social_platform_assets(asset_type);

-- Create updated_at trigger for social_platform_assets
CREATE OR REPLACE FUNCTION public.update_social_platform_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_social_platform_assets_updated_at ON public.social_platform_assets;
CREATE TRIGGER update_social_platform_assets_updated_at
  BEFORE UPDATE ON public.social_platform_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_social_platform_assets_updated_at();