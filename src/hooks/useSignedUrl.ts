import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SignedUrlOptions {
  bucket: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

interface UploadWithSignedUrlOptions extends SignedUrlOptions {
  cardId: string;
  file: File;
  onProgress?: (progress: number) => void;
}

export const useSignedUrl = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get a signed URL for downloading a file
  const getDownloadUrl = useCallback(async (
    bucket: string,
    filePath: string,
    expiresIn = 3600
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return null;
    }
  }, []);

  // Upload a file directly to storage with signed URL
  const uploadFile = useCallback(async ({
    bucket,
    cardId,
    file,
    onProgress,
  }: UploadWithSignedUrlOptions): Promise<{ path: string; url: string } | null> => {
    if (!user?.id) {
      setError('Not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${cardId}/${user.id}/${timestamp}-${sanitizedName}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the signed URL for immediate use
      const signedUrl = await getDownloadUrl(bucket, filePath);
      
      if (!signedUrl) {
        throw new Error('Failed to get signed URL after upload');
      }

      onProgress?.(100);

      return {
        path: filePath,
        url: signedUrl,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      console.error('Upload error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, getDownloadUrl]);

  // Delete a file from storage
  const deleteFile = useCallback(async (
    bucket: string,
    filePath: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Delete error:', err);
      return false;
    }
  }, []);

  // Get multiple signed URLs at once
  const getMultipleDownloadUrls = useCallback(async (
    bucket: string,
    filePaths: string[],
    expiresIn = 3600
  ): Promise<Record<string, string>> => {
    const urlMap: Record<string, string> = {};

    await Promise.all(
      filePaths.map(async (path) => {
        const url = await getDownloadUrl(bucket, path, expiresIn);
        if (url) {
          urlMap[path] = url;
        }
      })
    );

    return urlMap;
  }, [getDownloadUrl]);

  return {
    uploadFile,
    getDownloadUrl,
    getMultipleDownloadUrls,
    deleteFile,
    isLoading,
    error,
  };
};
