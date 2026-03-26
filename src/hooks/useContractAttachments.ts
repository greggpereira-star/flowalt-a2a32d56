import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ATTACHMENTS_BUCKET = 'attachments';
const SIGNED_URL_EXPIRY = 60 * 60;

export interface ContractAttachment {
  id: string;
  client_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  download_url: string | null;
}

export const useContractAttachments = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['contract-attachments', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await (supabase as any)
        .from('client_contract_attachments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const attachments = await Promise.all(
        (data || []).map(async (att: any) => {
          let downloadUrl: string | null = null;
          const filePath = att.file_url;

          if (filePath) {
            const { data: signedData } = await supabase.storage
              .from(ATTACHMENTS_BUCKET)
              .createSignedUrl(filePath, SIGNED_URL_EXPIRY);
            if (signedData) downloadUrl = signedData.signedUrl;
          }

          return { ...att, download_url: downloadUrl } as ContractAttachment;
        })
      );

      return attachments;
    },
    enabled: !!clientId,
  });
};

export const useUploadContractAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ client_id, file }: { client_id: string; file: File }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `contracts/${client_id}/${user.id}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data, error } = await (supabase as any)
        .from('client_contract_attachments')
        .insert({
          client_id,
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

      return { ...data, download_url: null } as ContractAttachment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract-attachments', data.client_id] });
    },
  });
};

export const useDeleteContractAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, client_id, file_url }: { id: string; client_id: string; file_url: string }) => {
      if (file_url) {
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove([file_url]);
      }

      const { error } = await (supabase as any)
        .from('client_contract_attachments')
        .delete()
        .eq('id', id);
      if (error) throw error;

      return { id, client_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract-attachments', data.client_id] });
    },
  });
};
