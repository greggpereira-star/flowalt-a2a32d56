-- Create storage bucket for social media content
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  true,
  52428800, -- 50MB limit for videos
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
);

-- Storage policies for social-media bucket
-- Anyone can view (public bucket for Meta API to access)
CREATE POLICY "Social media files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-media');

-- Authenticated users can upload to their workspace folder
CREATE POLICY "Users can upload social media files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'social-media' 
  AND auth.uid() IS NOT NULL
);

-- Users can update their own uploads
CREATE POLICY "Users can update their social media files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'social-media' 
  AND auth.uid() IS NOT NULL
);

-- Users can delete their own uploads
CREATE POLICY "Users can delete their social media files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'social-media' 
  AND auth.uid() IS NOT NULL
);