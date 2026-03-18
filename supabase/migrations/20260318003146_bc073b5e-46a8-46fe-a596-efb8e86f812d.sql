
-- Allow workspace members to upload transaction attachments
-- Path format: transactions/{transaction_id}/{user_id}/{filename}
CREATE POLICY "Workspace members can upload transaction attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'transactions'
  AND EXISTS (
    SELECT 1
    FROM public.transactions t
    JOIN public.workspace_members wm ON wm.workspace_id = t.workspace_id
    WHERE t.id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
  )
);

-- Allow reading transaction attachments
CREATE POLICY "Workspace members can view transaction attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'transactions'
  AND EXISTS (
    SELECT 1
    FROM public.transactions t
    JOIN public.workspace_members wm ON wm.workspace_id = t.workspace_id
    WHERE t.id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
  )
);

-- Allow deleting own transaction attachments
CREATE POLICY "Users can delete own transaction attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'transactions'
  AND (storage.foldername(name))[3] = auth.uid()::text
);
