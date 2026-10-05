-- O upload de avatar usa upsert (INSERT ... ON CONFLICT DO UPDATE ... RETURNING), que exige permissao de SELECT
-- sobre a propria linha. Sem ela o storage responde "new row violates row-level security policy".
-- Escopo minimo: cada pessoa so enxerga (via API) os objetos da propria pasta. A leitura publica das
-- fotos continua pelo endereco /object/public, que nao passa por RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can read their own avatar objects'
  ) THEN
    CREATE POLICY "Users can read their own avatar objects"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
END $$;
-- Mesmo defeito do avatar: upload com upsert (INSERT ... ON CONFLICT ... RETURNING) exige SELECT na linha.
-- Cada politica abaixo espelha o escopo da politica de INSERT que ja existe no bucket (nada mais amplo).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can read client logos') THEN
    CREATE POLICY "Users can read client logos" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'client-logos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can read social media files') THEN
    CREATE POLICY "Users can read social media files" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'social-media' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can read own mindmap attachments') THEN
    CREATE POLICY "Users can read own mindmap attachments" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'mindmap-attachments' AND (storage.foldername(name))[1] = (auth.uid())::text);
  END IF;
END $$;
