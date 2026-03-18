import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
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
      return (data || []) as TransactionAttachment[];
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
        .from('attachments')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      const { data, error } = await (supabase as any)
        .from('transaction_attachments')
        .insert({
          transaction_id,
          user_id: user.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TransactionAttachment;
    },
    onSuccess: (data: TransactionAttachment) => {
      queryClient.invalidateQueries({ queryKey: ['transaction-attachments', data.transaction_id] });
    },
  });
};

export const useDeleteTransactionAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, transaction_id, file_url }: { id: string; transaction_id: string; file_url: string }) => {
      const urlParts = file_url.split('/attachments/');
      if (urlParts.length > 1) {
        await supabase.storage.from('attachments').remove([urlParts[1]]);
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
