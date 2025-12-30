-- Create table to store integration credentials securely
CREATE TABLE public.integration_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  configured_by UUID,
  configured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending',
  sync_error TEXT,
  UNIQUE(workspace_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Workspace members with financial access can view integration credentials
CREATE POLICY "Workspace members can view integration credentials"
ON public.integration_credentials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = integration_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Workspace members with financial access can insert credentials
CREATE POLICY "Workspace members can insert integration credentials"
ON public.integration_credentials
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = integration_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Workspace members with financial access can update credentials
CREATE POLICY "Workspace members can update integration credentials"
ON public.integration_credentials
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = integration_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Workspace members with financial access can delete credentials
CREATE POLICY "Workspace members can delete integration credentials"
ON public.integration_credentials
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = integration_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Create indexes for faster lookups
CREATE INDEX idx_integration_credentials_workspace ON public.integration_credentials(workspace_id);
CREATE INDEX idx_integration_credentials_type ON public.integration_credentials(integration_type);