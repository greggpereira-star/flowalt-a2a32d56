-- Create storage bucket for card attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav']
);

-- Storage policies for attachments bucket
CREATE POLICY "Workspace members can view attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);

CREATE POLICY "Workspace members can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);

CREATE POLICY "Attachment owners or admins can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'attachments' AND
  (
    (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND public.has_admin_access(auth.uid(), c.workspace_id)
    )
  )
);

-- Enable realtime for comments (useful for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;