
CREATE TABLE public.mind_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Mapa sem título',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mind maps in their workspace"
  ON public.mind_maps FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create mind maps in their workspace"
  ON public.mind_maps FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own mind maps"
  ON public.mind_maps FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own mind maps"
  ON public.mind_maps FOR DELETE TO authenticated
  USING (created_by = auth.uid());
