-- =========================================================================
-- Storage bucket privado para PDFs do Painel Executivo (envio por e-mail)
-- Mesmo padrão do bucket idea-references: privado, path prefixado por
-- workspace_id, RLS via user_has_workspace_access.
-- =========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('financial-reports', 'financial-reports', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "financial_reports_storage_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'financial-reports' AND public.user_has_workspace_access(
      NULLIF((storage.foldername(name))[1], '')::uuid
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "financial_reports_storage_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'financial-reports' AND public.user_has_workspace_access(
      NULLIF((storage.foldername(name))[1], '')::uuid
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "financial_reports_storage_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'financial-reports' AND public.user_has_workspace_access(
      NULLIF((storage.foldername(name))[1], '')::uuid
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
