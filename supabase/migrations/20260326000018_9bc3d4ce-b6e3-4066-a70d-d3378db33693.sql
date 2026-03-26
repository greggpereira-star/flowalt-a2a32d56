
CREATE TABLE public.client_contract_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contract_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contract attachments in their workspace"
ON public.client_contract_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_cards cc
    JOIN public.workspace_members wm ON wm.workspace_id = cc.workspace_id
    WHERE cc.id = client_contract_attachments.client_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert contract attachments in their workspace"
ON public.client_contract_attachments
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.client_cards cc
    JOIN public.workspace_members wm ON wm.workspace_id = cc.workspace_id
    WHERE cc.id = client_contract_attachments.client_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own contract attachments"
ON public.client_contract_attachments
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
);
