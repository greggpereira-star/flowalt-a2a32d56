-- Create storage bucket for client logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to client-logos bucket
CREATE POLICY "Users can upload client logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-logos');

-- Allow anyone to view client logos (public bucket)
CREATE POLICY "Public can view client logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'client-logos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Users can update client logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Users can delete client logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'client-logos');