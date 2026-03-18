-- Harden transaction attachment access through SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.can_access_transaction_attachment(_user_id uuid, _transaction_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = _transaction_id
      AND (
        public.has_admin_access(_user_id, t.workspace_id)
        OR public.has_finance_access(_user_id, t.workspace_id)
        OR EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = t.workspace_id
            AND wm.user_id = _user_id
            AND wm.is_active = true
            AND wm.can_view_financials = true
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_delete_transaction_attachment(_user_id uuid, _transaction_id uuid, _attachment_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _attachment_owner_id
    AND public.can_access_transaction_attachment(_user_id, _transaction_id);
$$;

-- Replace fragile storage policies that depended on direct joins under RLS
DROP POLICY IF EXISTS "Workspace members can upload transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can view transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own transaction attachments" ON storage.objects;

CREATE POLICY "Users can upload transaction attachments v2"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'transactions'
  AND public.can_access_transaction_attachment(
    auth.uid(),
    ((storage.foldername(name))[2])::uuid
  )
);

CREATE POLICY "Users can view transaction attachments v2"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'transactions'
  AND public.can_access_transaction_attachment(
    auth.uid(),
    ((storage.foldername(name))[2])::uuid
  )
);

CREATE POLICY "Users can delete own transaction attachments v2"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'transactions'
  AND public.can_delete_transaction_attachment(
    auth.uid(),
    ((storage.foldername(name))[2])::uuid,
    ((storage.foldername(name))[3])::uuid
  )
);

-- Harden table RLS as well to avoid nested-policy edge cases
DROP POLICY IF EXISTS "Users can view transaction attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Users can insert transaction attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Users can delete own transaction attachments" ON public.transaction_attachments;

CREATE POLICY "Users can view transaction attachments v2"
ON public.transaction_attachments
FOR SELECT
TO authenticated
USING (
  public.can_access_transaction_attachment(auth.uid(), transaction_id)
);

CREATE POLICY "Users can insert transaction attachments v2"
ON public.transaction_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_transaction_attachment(auth.uid(), transaction_id)
);

CREATE POLICY "Users can delete own transaction attachments v2"
ON public.transaction_attachments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND public.can_access_transaction_attachment(auth.uid(), transaction_id)
);