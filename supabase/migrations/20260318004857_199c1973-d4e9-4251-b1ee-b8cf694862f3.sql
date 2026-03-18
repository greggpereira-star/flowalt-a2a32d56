-- Allow all file formats in the attachments bucket used by financial transaction attachments.
-- Keep the bucket private and preserve the existing size limit.
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'attachments';