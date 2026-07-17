import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ProposalDocumentModel } from '@/lib/proposalDocument';

export type ProposalDocStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'declined';

export interface ProposalDoc {
  id: string;
  workspace_id: string;
  created_by: string;
  seller_name?: string | null;
  client_name: string;
  client_email?: string | null;
  client_id?: string | null;
  title?: string | null;
  document: ProposalDocumentModel;
  status: ProposalDocStatus;
  public_token: string | null;
  valid_until?: string | null;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  view_count: number;
  selected_option_id?: string | null;
  signed_at?: string | null;
  signer_name?: string | null;
  signer_document?: string | null;
  signer_email?: string | null;
  contract_id?: string | null;
  onboarding_card_id?: string | null;
  created_at: string;
  updated_at: string;
}

function genToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
}

// Lista de documentos de proposta do workspace
export const useProposalDocs = () => {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['proposal-docs', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('altcontrol_proposal_docs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProposalDoc[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useProposalDoc = (id: string | undefined) => {
  return useQuery({
    queryKey: ['proposal-doc', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('altcontrol_proposal_docs')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ProposalDoc | null;
    },
    enabled: !!id,
  });
};

export const useCreateProposalDoc = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      clientName: string;
      clientEmail?: string;
      title?: string;
      sellerName?: string;
      document: ProposalDocumentModel;
    }) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('altcontrol_proposal_docs')
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          seller_name: input.sellerName || null,
          client_name: input.clientName,
          client_email: input.clientEmail || null,
          title: input.title || `Proposta — ${input.clientName}`,
          document: input.document as any,
          status: 'draft',
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as ProposalDoc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-docs'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Falha ao criar proposta.');
    },
  });
};

export const useUpdateProposalDoc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{
      clientName: string; clientEmail: string; title: string;
      document: ProposalDocumentModel; status: ProposalDocStatus; validUntil: string | null;
    }> }) => {
      const payload: Record<string, any> = {};
      if (updates.clientName !== undefined) payload.client_name = updates.clientName;
      if (updates.clientEmail !== undefined) payload.client_email = updates.clientEmail;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.document !== undefined) payload.document = updates.document;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.validUntil !== undefined) payload.valid_until = updates.validUntil;

      const { data, error } = await supabase
        .from('altcontrol_proposal_docs')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as ProposalDoc;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-docs'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-doc', data.id] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Falha ao salvar proposta.');
    },
  });
};

export const useDeleteProposalDoc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('altcontrol_proposal_docs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-docs'] });
      toast.success('Proposta removida.');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Falha ao remover proposta.');
    },
  });
};

// Gera (ou reaproveita) o link público, marcando status "sent"
export const useGeneratePublicLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, validUntil }: { id: string; validUntil?: string | null }) => {
      // Só gera novo token se ainda não existir
      const { data: existing, error: fetchErr } = await supabase
        .from('altcontrol_proposal_docs')
        .select('public_token,status')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const token = existing?.public_token || genToken();
      const payload: Record<string, any> = { public_token: token };
      if (existing?.status === 'draft') payload.status = 'sent';
      if (validUntil !== undefined) payload.valid_until = validUntil;

      const { data, error } = await supabase
        .from('altcontrol_proposal_docs')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as ProposalDoc;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-docs'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-doc', data.id] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Falha ao gerar link.');
    },
  });
};

export function publicProposalUrl(token: string): string {
  return `${window.location.origin}/p/${token}`;
}
