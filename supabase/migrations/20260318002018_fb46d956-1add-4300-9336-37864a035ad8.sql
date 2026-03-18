
-- Table for transaction attachments
CREATE TABLE public.transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view attachments of transactions in their workspace
CREATE POLICY "Users can view transaction attachments"
  ON public.transaction_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.workspace_members wm ON wm.workspace_id = t.workspace_id
      WHERE t.id = transaction_attachments.transaction_id
        AND wm.user_id = auth.uid()
    )
  );

-- RLS: Users can insert attachments
CREATE POLICY "Users can insert transaction attachments"
  ON public.transaction_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.workspace_members wm ON wm.workspace_id = t.workspace_id
      WHERE t.id = transaction_attachments.transaction_id
        AND wm.user_id = auth.uid()
    )
  );

-- RLS: Users can delete their own attachments
CREATE POLICY "Users can delete own transaction attachments"
  ON public.transaction_attachments
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Index for faster lookups
CREATE INDEX idx_transaction_attachments_transaction_id ON public.transaction_attachments(transaction_id);
