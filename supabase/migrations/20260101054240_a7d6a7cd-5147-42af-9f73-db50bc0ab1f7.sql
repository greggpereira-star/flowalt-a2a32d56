-- Create pluggy_items table to store connected bank accounts
CREATE TABLE IF NOT EXISTS public.pluggy_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pluggy_item_id TEXT NOT NULL,
  connector_name TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  connected_by UUID,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB,
  UNIQUE(workspace_id, pluggy_item_id)
);

-- Enable RLS
ALTER TABLE public.pluggy_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view pluggy items in their workspace"
ON public.pluggy_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = pluggy_items.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

CREATE POLICY "Users can insert pluggy items in their workspace"
ON public.pluggy_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = pluggy_items.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

CREATE POLICY "Users can update pluggy items in their workspace"
ON public.pluggy_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = pluggy_items.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

CREATE POLICY "Users can delete pluggy items in their workspace"
ON public.pluggy_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = pluggy_items.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pluggy_items_workspace ON public.pluggy_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_items_status ON public.pluggy_items(status);