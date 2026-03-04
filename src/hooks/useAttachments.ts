import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerWebhook, getCardWorkspaceId } from '@/lib/webhookTrigger';

export interface Attachment {
  id: string;
  card_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export const useAttachments = (cardId: string | undefined) => {
  return useQuery({
    queryKey: ['attachments', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!cardId,
  });
};

export const useUploadAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      card_id,
      file,
    }: {
      card_id: string;
      file: File;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Upload file to storage - sanitize filename to avoid special char issues
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${card_id}/${user.id}/${Date.now()}-${sanitizedName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // Create attachment record
      const { data, error } = await supabase
        .from('attachments')
        .insert({
          card_id,
          user_id: user.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger webhook
      const workspaceId = await getCardWorkspaceId(card_id);
      if (workspaceId) {
        triggerWebhook(workspaceId, 'attachment.uploaded', {
          id: data.id,
          card_id: data.card_id,
          file_name: data.file_name,
          file_type: data.file_type,
          file_size: data.file_size,
          uploaded_by: user.id,
        });
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', data.card_id] });
    },
  });
};

export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, card_id, file_url }: { id: string; card_id: string; file_url: string }) => {
      // Extract path from URL for deletion
      const urlParts = file_url.split('/attachments/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('attachments').remove([filePath]);
      }

      const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Trigger webhook
      const workspaceId = await getCardWorkspaceId(card_id);
      if (workspaceId) {
        triggerWebhook(workspaceId, 'attachment.deleted', {
          id,
          card_id,
          file_url,
        });
      }

      return { id, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', data.card_id] });
    },
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
