import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

import type { Json } from '@/integrations/supabase/types';

export type WorkflowStatus = 'captured' | 'reviewed' | 'ap_created' | 'awaiting_payment' | 'paid_reconciled' | 'ignored';

export interface DDABoleto {
  id: string;
  workspace_id: string;
  external_id: string | null;
  pluggy_item_id: string | null;
  pluggy_bill_id: string | null;
  barcode: string | null;
  digitable_line: string | null;
  cedente_nome: string;
  cedente_documento: string | null;
  cedente_banco: string | null;
  cedente_agencia: string | null;
  cedente_conta: string | null;
  sacado_nome: string | null;
  sacado_documento: string | null;
  valor_original: number;
  valor_atualizado: number | null;
  valor_desconto: number;
  valor_abatimento: number;
  data_emissao: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  data_baixa: string | null;
  status: 'pending' | 'scheduled' | 'paid' | 'expired' | 'cancelled' | 'ignored';
  workflow_status: WorkflowStatus;
  transaction_id: string | null;
  linked_ap_id: string | null;
  category_id: string | null;
  notes: string | null;
  metadata: Json | null;
  raw_payload: Json | null;
  source: string;
  synced_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DDASyncLog {
  id: string;
  workspace_id: string;
  source: string;
  status: 'success' | 'error' | 'partial';
  boletos_found: number;
  boletos_new: number;
  boletos_updated: number;
  error_message: string | null;
  synced_at: string;
  synced_by: string | null;
}

export interface DDASyncStatus {
  is_configured: boolean;
  last_sync: DDASyncLog | null;
  pending_boletos: number;
  overdue_boletos: number;
}

// Fetch all boletos
export function useDDABoletos(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dda-boletos', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('dda_boletos')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('data_vencimento', { ascending: true });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.gte('data_vencimento', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('data_vencimento', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DDABoleto[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Fetch sync status with fallback to direct DB query
export function useDDASyncStatus() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dda-sync-status', currentWorkspace?.id],
    queryFn: async (): Promise<DDASyncStatus> => {
      if (!currentWorkspace?.id) {
        return {
          is_configured: false,
          last_sync: null,
          pending_boletos: 0,
          overdue_boletos: 0,
        };
      }

      // Skip edge function for status check - use direct DB query for reliability
      // This avoids JWT issues and is faster for status checks

      // Fallback: query database directly
      const [integrationResult, syncLogResult, pendingResult, overdueResult] = await Promise.all([
        supabase
          .from('integration_credentials')
          .select('is_active, last_sync_at, sync_status')
          .eq('workspace_id', currentWorkspace.id)
          .eq('integration_type', 'pluggy')
          .maybeSingle(),
        supabase
          .from('dda_sync_logs')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('synced_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('dda_boletos')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('status', 'pending')
          .is('deleted_at', null),
        supabase
          .from('dda_boletos')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('status', 'pending')
          .is('deleted_at', null)
          .lt('data_vencimento', new Date().toISOString().split('T')[0]),
      ]);

      return {
        is_configured: !!integrationResult.data?.is_active,
        last_sync: syncLogResult.data as DDASyncLog | null,
        pending_boletos: pendingResult.count || 0,
        overdue_boletos: overdueResult.count || 0,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

// Sync boletos from Pluggy
export function useSyncDDA() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Ensure we have a valid session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const { data, error } = await supabase.functions.invoke('dda-sync', {
        body: {
          action: 'sync',
          workspace_id: currentWorkspace.id,
        },
      });

      if (error) {
        // Check if it's an auth error
        if (error.message?.includes('401') || error.message?.includes('JWT')) {
          throw new Error('Sessão expirada. Recarregue a página e tente novamente.');
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dda-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
      
      if (data.boletos_new > 0) {
        toast.success(`${data.boletos_new} novos boletos encontrados`);
      } else {
        toast.info('Nenhum boleto novo encontrado');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sincronizar boletos');
    },
  });
}

// Update boleto status
export function useUpdateBoletoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      boletoId, 
      status, 
      notes 
    }: { 
      boletoId: string; 
      status: DDABoleto['status']; 
      notes?: string;
    }) => {
      const updateData: Partial<DDABoleto> = { status };
      
      if (status === 'paid') {
        updateData.data_pagamento = new Date().toISOString().split('T')[0];
      }
      
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('dda_boletos')
        .update(updateData)
        .eq('id', boletoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dda-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
      toast.success('Status do boleto atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar boleto');
    },
  });
}

// Link boleto to transaction
export function useLinkBoletoToTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      boletoId, 
      transactionId 
    }: { 
      boletoId: string; 
      transactionId: string | null;
    }) => {
      const { error } = await supabase
        .from('dda_boletos')
        .update({ 
          transaction_id: transactionId,
          status: transactionId ? 'paid' : 'pending'
        })
        .eq('id', boletoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dda-boletos'] });
      toast.success('Boleto vinculado à transação');
    },
    onError: () => {
      toast.error('Erro ao vincular boleto');
    },
  });
}

// Add manual boleto
export function useAddManualBoleto() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (boletoData: Partial<DDABoleto>) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase.functions.invoke('dda-sync', {
        body: {
          action: 'manual_add',
          workspace_id: currentWorkspace.id,
          boleto_data: boletoData,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dda-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
      toast.success('Boleto adicionado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar boleto');
    },
  });
}

// Delete boleto
export function useDeleteBoleto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (boletoId: string) => {
      const { error } = await supabase
        .from('dda_boletos')
        .delete()
        .eq('id', boletoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dda-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
      toast.success('Boleto removido');
    },
    onError: () => {
      toast.error('Erro ao remover boleto');
    },
  });
}
