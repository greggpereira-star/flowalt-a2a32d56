import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerWebhook, getCardWorkspaceId } from '@/lib/webhookTrigger';

const ATTACHMENTS_BUCKET = 'attachments';
const SIGNED_URL_EXPIRY = 60 * 60;

/**
 * O bucket 'attachments' é PRIVADO, então URL pública nele responde HTTP 400 —
 * era o que estava gravado aqui, deixando todo anexo de card inacessível. O
 * caminho certo é guardar só o path e assinar na leitura.
 *
 * Esta função aceita as três formas que existem no banco hoje: o path puro
 * (uploads novos), a URL pública do self-hosted, e a URL pública do projeto
 * Supabase antigo que foi desligado na migração. Mesma abordagem já usada em
 * useTransactionAttachments.ts.
 */
const extractAttachmentPath = (value: string | null | undefined): string | null => {
  if (!value) return null;

  // Uploads novos guardam o path direto, que começa com o id do card.
  if (!value.includes('://')) return value;

  const markers = [
    '/storage/v1/object/public/attachments/',
    '/storage/v1/object/sign/attachments/',
    '/storage/v1/object/authenticated/attachments/',
  ];

  try {
    const url = new URL(value);
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        return decodeURIComponent(url.pathname.slice(index + marker.length));
      }
    }
  } catch {
    // Cai no split abaixo se não for uma URL válida.
  }

  const parts = value.split('/attachments/');
  if (parts.length > 1) {
    return decodeURIComponent(parts[1].split('?')[0]);
  }

  return null;
};

export interface Attachment {
  id: string;
  card_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  /** URL assinada temporária; é o que a UI deve usar para abrir/exibir. */
  signedUrl: string | null;
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

      const rows = data ?? [];
      const paths = rows.map((row) => extractAttachmentPath(row.file_url));
      const validPaths = paths.filter((p): p is string => !!p);

      // Uma chamada só para todos os anexos, em vez de uma por arquivo.
      const signedByPath = new Map<string, string>();
      if (validPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .createSignedUrls(validPaths, SIGNED_URL_EXPIRY);

        signed?.forEach((item) => {
          if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
        });
      }

      return rows.map((row, i) => ({
        ...row,
        signedUrl: paths[i] ? signedByPath.get(paths[i]!) ?? null : null,
      })) as Attachment[];
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
        .from(ATTACHMENTS_BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Guarda o PATH, não uma URL absoluta: o bucket é privado (URL pública
      // não funciona) e URL absoluta congelaria o domínio na linha, que foi
      // exatamente o que quebrou os anexos na migração de servidor.
      const { data, error } = await supabase
        .from('attachments')
        .insert({
          card_id,
          user_id: user.id,
          file_name: file.name,
          file_url: filePath,
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
      // Mesmo extrator da leitura, para funcionar tanto com o path novo quanto
      // com as URLs absolutas legadas.
      const filePath = extractAttachmentPath(file_url);
      if (filePath) {
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove([filePath]);
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
