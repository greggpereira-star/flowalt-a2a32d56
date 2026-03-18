import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ATTACHMENTS_BUCKET = 'attachments';
const SIGNED_URL_EXPIRY = 60 * 60;

const extractAttachmentPath = (value: string | null | undefined) => {
  if (!value) return null;

  if (value.startsWith('transactions/')) {
    return value;
  }

  try {
    const url = new URL(value);
    const pathMarkers = [
      '/storage/v1/object/public/attachments/',
      '/storage/v1/object/sign/attachments/',
      '/storage/v1/object/authenticated/attachments/',
    ];

    for (const marker of pathMarkers) {
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        return decodeURIComponent(url.pathname.slice(index + marker.length));
      }
    }
  } catch {
    // Ignore parse errors and fallback to string splitting below.
  }

  const parts = value.split('/attachments/');
  if (parts.length > 1) {
    return decodeURIComponent(parts[1].split('?')[0]);
  }

  return null;
};

export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  file_path: string | null;
  download_url: string | null;
}

export const useTransactionAttachments = (transactionId: string | undefined) => {
  return useQuery({
    queryKey: ['transaction-attachments', transactionId],
    queryFn: async () => {
      if (!transactionId) return [];

      const { data, error } = await (supabase as any)
        .from('transaction_attachments')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const attachments = await Promise.all(
        ((data || []) as Array<Omit<TransactionAttachment, 'file_path' | 'download_url'>>).map(async (attachment) => {
          const filePath = extractAttachmentPath(attachment.file_url);
          let downloadUrl: string | null = null;

          if (filePath) {
            const { data: signedData, error: signedUrlError } = await supabase.storage
              .from(ATTACHMENTS_BUCKET)
              .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

            if (!signedUrlError) {
              downloadUrl = signedData.signedUrl;
            }
          }

          return {
            ...attachment,
            file_path: filePath,
            download_url: downloadUrl,
          } satisfies TransactionAttachment;
        })
      );

      return attachments;
    },
    enabled: !!transactionId,
  });
};

export const useUploadTransactionAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ transaction_id, file }: { transaction_id: string; file: File }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `transactions/${transaction_id}/${user.id}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data, error } = await (supabase as any)
        .from('transaction_attachments')
        .insert({
          transaction_id,
          user_id: user.id,
          file_name: file.name,
          file_url: filePath,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) {
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove([filePath]);
        throw error;
      }

      return {
        ...(data as Omit<TransactionAttachment, 'file_path' | 'download_url'>),
        file_path: filePath,
        download_url: null,
      } as TransactionAttachment;
    },
    onSuccess: (data: TransactionAttachment) => {
      queryClient.invalidateQueries({ queryKey: ['transaction-attachments', data.transaction_id] });
    },
  });
};

export const useDeleteTransactionAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      transaction_id,
      file_url,
      file_path,
    }: {
      id: string;
      transaction_id: string;
      file_url: string;
      file_path?: string | null;
    }) => {
      const storagePath = file_path ?? extractAttachmentPath(file_url);
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
        if (storageError) throw storageError;
      }

      const { error } = await (supabase as any)
        .from('transaction_attachments')
        .delete()
        .eq('id', id);
      if (error) throw error;

      return { id, transaction_id };
    },
    onSuccess: (data: { transaction_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['transaction-attachments', data.transaction_id] });
    },
  });
};
