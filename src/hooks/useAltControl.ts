import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// =============================================
// Types
// =============================================
export interface AltControlLevel {
  id: string;
  workspace_id: string;
  name: string;
  display_order: number;
  min_hours: number;
  max_hours: number;
  min_cost_per_hour: number;
  max_cost_per_hour: number;
  min_monthly_price: number;
  max_monthly_price: number;
  target_margin_percent: number;
  requires_reinforced_approval: boolean;
  block_pdf_before_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AltControlService {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  requires_minimum_level: boolean;
  minimum_level_id?: string;
  minimum_level?: AltControlLevel;
  suggested_min_hours?: number;
  suggested_max_hours?: number;
  service_type: 'strategy' | 'recurring' | 'project';
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AltControlCostParams {
  id: string;
  workspace_id: string;
  name: string;
  base_hourly_cost: number;
  overhead_percent: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AltControlApprovalRule {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  min_level_order: number;
  max_level_order?: number;
  required_approvers_count: number;
  notify_by_email: boolean;
  notify_in_app: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AltControlApprover {
  id: string;
  workspace_id: string;
  user_id: string;
  is_senior: boolean;
  is_active: boolean;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export type ProposalStatus = 'draft' | 'in_review' | 'needs_adjustment' | 'approved' | 'sent' | 'won' | 'lost';

export interface AltControlProposal {
  id: string;
  workspace_id: string;
  proposal_number: number;
  client_name: string;
  client_id?: string;
  seller_id: string;
  seller_name?: string;
  status: ProposalStatus;
  calculated_level_id?: string;
  calculated_level?: AltControlLevel;
  total_hours: number;
  suggested_min_price?: number;
  suggested_max_price?: number;
  final_price?: number;
  estimated_cost?: number;
  estimated_margin_percent?: number;
  notes?: string;
  pdf_url?: string;
  pdf_generated_at?: string;
  submitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  approval_comment?: string;
  sent_at?: string;
  won_at?: string;
  lost_at?: string;
  lost_reason?: string;
  created_at: string;
  updated_at: string;
  items?: AltControlProposalItem[];
}

export interface AltControlProposalItem {
  id: string;
  proposal_id: string;
  service_id: string;
  service?: AltControlService;
  hours_per_month: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AltControlContract {
  id: string;
  workspace_id: string;
  proposal_id?: string;
  client_id?: string;
  client_name: string;
  level_id?: string;
  level?: AltControlLevel;
  contracted_hours: number;
  monthly_value: number;
  start_date: string;
  end_date?: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
  monthly_hours?: AltControlMonthlyHours[];
  services?: AltControlContractService[];
}

export interface AltControlMonthlyHours {
  id: string;
  contract_id: string;
  year_month: string;
  realized_hours: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AltControlContractService {
  id: string;
  contract_id: string;
  service_id: string;
  service?: AltControlService;
  hours_allocated: number;
  created_at: string;
}

export interface AltControlApprovalRequest {
  id: string;
  proposal_id: string;
  approver_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'adjustment_requested';
  decision?: string;
  comment?: string;
  decided_at?: string;
  created_at: string;
  approver_name?: string;
}

// =============================================
// Hooks - Levels
// =============================================
export const useAltControlLevels = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['altcontrol-levels', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('altcontrol_levels')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as AltControlLevel[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useCreateLevel = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (level: Omit<AltControlLevel, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('altcontrol_levels')
        .insert({
          ...level,
          workspace_id: currentWorkspace?.id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-levels'] });
      toast.success('Nível criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar nível: ' + error.message);
    },
  });
};

export const useUpdateLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...level }: Partial<AltControlLevel> & { id: string }) => {
      const { data, error } = await supabase
        .from('altcontrol_levels')
        .update(level)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-levels'] });
      toast.success('Nível atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar nível: ' + error.message);
    },
  });
};

export const useDeleteLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('altcontrol_levels')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-levels'] });
      toast.success('Nível excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir nível: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Services
// =============================================
export const useAltControlServices = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['altcontrol-services', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('altcontrol_services')
        .select(`
          *,
          minimum_level:altcontrol_levels(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as AltControlService[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useCreateService = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (service: Omit<AltControlService, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'created_by' | 'minimum_level'>) => {
      const { data, error } = await supabase
        .from('altcontrol_services')
        .insert({
          ...service,
          workspace_id: currentWorkspace?.id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-services'] });
      toast.success('Serviço criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar serviço: ' + error.message);
    },
  });
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...service }: Partial<AltControlService> & { id: string }) => {
      const { minimum_level, ...updateData } = service;
      const { data, error } = await supabase
        .from('altcontrol_services')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-services'] });
      toast.success('Serviço atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar serviço: ' + error.message);
    },
  });
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('altcontrol_services')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-services'] });
      toast.success('Serviço excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir serviço: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Cost Params
// =============================================
export const useAltControlCostParams = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['altcontrol-cost-params', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('altcontrol_cost_params')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data as AltControlCostParams | null;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useUpsertCostParams = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: Partial<AltControlCostParams>) => {
      // Check if default exists
      const { data: existing } = await supabase
        .from('altcontrol_cost_params')
        .select('id')
        .eq('workspace_id', currentWorkspace?.id)
        .eq('is_default', true)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('altcontrol_cost_params')
          .update(params)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('altcontrol_cost_params')
          .insert({
            ...params,
            workspace_id: currentWorkspace?.id,
            created_by: user?.id,
            is_default: true,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-cost-params'] });
      toast.success('Parâmetros de custo salvos');
    },
    onError: (error) => {
      toast.error('Erro ao salvar parâmetros: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Proposals
// =============================================
export const useAltControlProposals = (filters?: { status?: ProposalStatus; sellerId?: string }) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['altcontrol-proposals', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('altcontrol_proposals')
        .select(`
          *,
          calculated_level:altcontrol_levels(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.sellerId) {
        query = query.eq('seller_id', filters.sellerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AltControlProposal[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useAltControlProposal = (id: string) => {
  return useQuery({
    queryKey: ['altcontrol-proposal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('altcontrol_proposals')
        .select(`
          *,
          calculated_level:altcontrol_levels(*),
          items:altcontrol_proposal_items(
            *,
            service:altcontrol_services(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as AltControlProposal;
    },
    enabled: !!id,
  });
};

export const useCreateProposal = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (proposal: {
      client_name: string;
      client_id?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('altcontrol_proposals')
        .insert({
          ...proposal,
          workspace_id: currentWorkspace?.id,
          seller_id: user?.id,
          created_by: user?.id,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposals'] });
      toast.success('Proposta criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar proposta: ' + error.message);
    },
  });
};

export const useUpdateProposal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...proposal }: Partial<AltControlProposal> & { id: string }) => {
      const { calculated_level, items, ...updateData } = proposal;
      const { data, error } = await supabase
        .from('altcontrol_proposals')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposal', variables.id] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar proposta: ' + error.message);
    },
  });
};

export const useDeleteProposal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('altcontrol_proposals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposals'] });
      toast.success('Proposta excluída com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir proposta: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Proposal Items
// =============================================
export const useUpsertProposalItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ proposalId, items }: { 
      proposalId: string; 
      items: { service_id: string; hours_per_month: number; notes?: string }[] 
    }) => {
      // Delete existing items
      await supabase
        .from('altcontrol_proposal_items')
        .delete()
        .eq('proposal_id', proposalId);

      // Insert new items
      if (items.length > 0) {
        const { error } = await supabase
          .from('altcontrol_proposal_items')
          .insert(items.map(item => ({
            ...item,
            proposal_id: proposalId,
          })));

        if (error) throw error;
      }

      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposal', variables.proposalId] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar itens: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Approval Requests
// =============================================
export const usePendingApprovals = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['altcontrol-pending-approvals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('altcontrol_approval_requests')
        .select(`
          *,
          proposal:altcontrol_proposals(
            *,
            calculated_level:altcontrol_levels(*)
          )
        `)
        .eq('approver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useSubmitForApproval = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (proposalId: string) => {
      // Get approvers for the workspace
      const { data: approvers, error: approversError } = await supabase
        .from('altcontrol_approvers')
        .select('*')
        .eq('workspace_id', currentWorkspace?.id)
        .eq('is_active', true);

      if (approversError) throw approversError;

      if (!approvers || approvers.length === 0) {
        throw new Error('Nenhum aprovador configurado no workspace');
      }

      // Create approval requests for all approvers
      const { error: requestError } = await supabase
        .from('altcontrol_approval_requests')
        .insert(approvers.map(approver => ({
          proposal_id: proposalId,
          approver_id: approver.user_id,
          status: 'pending',
        })));

      if (requestError) throw requestError;

      // Update proposal status
      const { error: updateError } = await supabase
        .from('altcontrol_proposals')
        .update({
          status: 'in_review',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('altcontrol_proposal_history')
        .insert({
          proposal_id: proposalId,
          action: 'submitted_for_approval',
          from_status: 'draft',
          to_status: 'in_review',
          created_by: user?.id,
        });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['altcontrol-pending-approvals'] });
      toast.success('Proposta enviada para aprovação');
    },
    onError: (error) => {
      toast.error('Erro ao enviar para aprovação: ' + error.message);
    },
  });
};

export const useApproveProposal = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ proposalId, comment }: { proposalId: string; comment?: string }) => {
      // Update approval request
      const { error: requestError } = await supabase
        .from('altcontrol_approval_requests')
        .update({
          status: 'approved',
          comment,
          decided_at: new Date().toISOString(),
        })
        .eq('proposal_id', proposalId)
        .eq('approver_id', user?.id);

      if (requestError) throw requestError;

      // Update proposal status
      const { error: updateError } = await supabase
        .from('altcontrol_proposals')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          approval_comment: comment,
        })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('altcontrol_proposal_history')
        .insert({
          proposal_id: proposalId,
          action: 'approved',
          from_status: 'in_review',
          to_status: 'approved',
          comment,
          created_by: user?.id,
        });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['altcontrol-pending-approvals'] });
      toast.success('Proposta aprovada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao aprovar proposta: ' + error.message);
    },
  });
};

export const useRequestAdjustments = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ proposalId, comment }: { proposalId: string; comment: string }) => {
      // Update approval request
      const { error: requestError } = await supabase
        .from('altcontrol_approval_requests')
        .update({
          status: 'adjustment_requested',
          comment,
          decided_at: new Date().toISOString(),
        })
        .eq('proposal_id', proposalId)
        .eq('approver_id', user?.id);

      if (requestError) throw requestError;

      // Update proposal status
      const { error: updateError } = await supabase
        .from('altcontrol_proposals')
        .update({
          status: 'needs_adjustment',
        })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('altcontrol_proposal_history')
        .insert({
          proposal_id: proposalId,
          action: 'adjustment_requested',
          from_status: 'in_review',
          to_status: 'needs_adjustment',
          comment,
          created_by: user?.id,
        });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['altcontrol-pending-approvals'] });
      toast.success('Ajustes solicitados');
    },
    onError: (error) => {
      toast.error('Erro ao solicitar ajustes: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Contracts
// =============================================
export const useAltControlContracts = (filters?: { status?: string }) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['altcontrol-contracts', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('altcontrol_contracts')
        .select(`
          *,
          level:altcontrol_levels(*),
          services:altcontrol_contract_services(
            *,
            service:altcontrol_services(*)
          ),
          monthly_hours:altcontrol_monthly_hours(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AltControlContract[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useAltControlContract = (id: string) => {
  return useQuery({
    queryKey: ['altcontrol-contract', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('altcontrol_contracts')
        .select(`
          *,
          level:altcontrol_levels(*),
          services:altcontrol_contract_services(
            *,
            service:altcontrol_services(*)
          ),
          monthly_hours:altcontrol_monthly_hours(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as AltControlContract;
    },
    enabled: !!id,
  });
};

export const useConvertToContract = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      proposalId, 
      startDate,
      createSpace = true,
      createClientCard = false,
    }: { 
      proposalId: string; 
      startDate: string;
      createSpace?: boolean;
      createClientCard?: boolean;
    }) => {
      // Get proposal with items
      const { data: proposal, error: proposalError } = await supabase
        .from('altcontrol_proposals')
        .select(`
          *,
          items:altcontrol_proposal_items(
            *,
            service:altcontrol_services(*)
          )
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError) throw proposalError;

      let clientId = proposal.client_id;

      // Create client card if requested and doesn't exist
      if (createClientCard && !clientId) {
        const { data: newClient, error: clientError } = await supabase
          .from('client_cards')
          .insert({
            workspace_id: currentWorkspace?.id,
            name: proposal.client_name,
            status: 'active',
            created_by: user?.id,
          })
          .select()
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;

        // Update proposal with new client_id
        await supabase
          .from('altcontrol_proposals')
          .update({ client_id: clientId })
          .eq('id', proposalId);
      }

      // Create contract
      const { data: contract, error: contractError } = await supabase
        .from('altcontrol_contracts')
        .insert({
          workspace_id: currentWorkspace?.id,
          proposal_id: proposalId,
          client_id: clientId,
          client_name: proposal.client_name,
          level_id: proposal.calculated_level_id,
          contracted_hours: proposal.total_hours,
          monthly_value: proposal.final_price || proposal.suggested_max_price || 0,
          start_date: startDate,
          status: 'active',
          created_by: user?.id,
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Create contract services
      if (proposal.items && proposal.items.length > 0) {
        const { error: servicesError } = await supabase
          .from('altcontrol_contract_services')
          .insert(proposal.items.map((item: any) => ({
            contract_id: contract.id,
            service_id: item.service_id,
            hours_allocated: item.hours_per_month,
          })));

        if (servicesError) throw servicesError;
      }

      // Create Space integrated with the Flowalt model
      let spaceId: string | null = null;
      if (createSpace && currentWorkspace?.id) {
        const { data: space, error: spaceError } = await supabase
          .from('spaces')
          .insert([{
            workspace_id: currentWorkspace.id,
            name: proposal.client_name,
            type: 'custom' as const,
            icon: 'building-2',
            color: '#6366f1',
            description: `Espaço operacional do cliente ${proposal.client_name}`,
          }])
          .select()
          .single();

        if (spaceError) {
          console.error('Error creating space:', spaceError);
        } else {
          spaceId = space.id;

          // Create folders per service type
          const serviceTypeMap = new Map<string, { name: string; icon: string; color: string; hours: number }>();
          
          proposal.items?.forEach((item: any) => {
            const service = item.service;
            if (service) {
              const type = service.service_type || 'project';
              const existing = serviceTypeMap.get(type);
              if (existing) {
                existing.hours += item.hours_per_month;
              } else {
                const typeConfig = {
                  strategy: { name: 'Estratégia', icon: 'target', color: '#8b5cf6' },
                  recurring: { name: 'Recorrente', icon: 'repeat', color: '#10b981' },
                  project: { name: 'Projetos', icon: 'folder-kanban', color: '#f59e0b' },
                };
                const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.project;
                serviceTypeMap.set(type, { ...config, hours: item.hours_per_month });
              }
            }
          });

          // Also create individual service folders
          const foldersToCreate: any[] = [];
          let sortOrder = 0;

          // Add type-based folders first
          serviceTypeMap.forEach((config, type) => {
            foldersToCreate.push({
              workspace_id: currentWorkspace.id,
              space_id: spaceId,
              name: `${config.name} (${config.hours}h)`,
              icon: config.icon,
              color: config.color,
              sort_order: sortOrder++,
            });
          });

          // Add individual service folders
          proposal.items?.forEach((item: any) => {
            if (item.service) {
              foldersToCreate.push({
                workspace_id: currentWorkspace.id,
                space_id: spaceId,
                name: item.service.name,
                icon: 'file-text',
                color: '#64748b',
                description: `${item.hours_per_month}h/mês`,
                sort_order: sortOrder++,
              });
            }
          });

          if (foldersToCreate.length > 0) {
            await supabase.from('folders').insert(foldersToCreate);
          }
        }
      }

      // Update proposal status
      const { error: updateError } = await supabase
        .from('altcontrol_proposals')
        .update({
          status: 'won',
          won_at: new Date().toISOString(),
        })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      // Add history
      await supabase
        .from('altcontrol_proposal_history')
        .insert({
          proposal_id: proposalId,
          action: 'converted_to_contract',
          from_status: 'approved',
          to_status: 'won',
          metadata: { contract_id: contract.id, space_id: spaceId },
          created_by: user?.id,
        });

      return { contract, spaceId, clientId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['altcontrol-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['client-cards'] });
      toast.success('Contrato criado e espaço configurado!');
    },
    onError: (error) => {
      toast.error('Erro ao criar contrato: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Monthly Hours
// =============================================
export const useUpsertMonthlyHours = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ contractId, yearMonth, realizedHours, notes }: {
      contractId: string;
      yearMonth: string;
      realizedHours: number;
      notes?: string;
    }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from('altcontrol_monthly_hours')
        .select('id')
        .eq('contract_id', contractId)
        .eq('year_month', yearMonth)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('altcontrol_monthly_hours')
          .update({
            realized_hours: realizedHours,
            notes,
            updated_by: user?.id,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('altcontrol_monthly_hours')
          .insert({
            contract_id: contractId,
            year_month: yearMonth,
            realized_hours: realizedHours,
            notes,
            updated_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-contract', variables.contractId] });
      queryClient.invalidateQueries({ queryKey: ['altcontrol-contracts'] });
      toast.success('Horas registradas com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao registrar horas: ' + error.message);
    },
  });
};

// =============================================
// Hooks - Approvers
// =============================================
export const useAltControlApprovers = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['altcontrol-approvers', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('altcontrol_approvers')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as AltControlApprover[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useAddApprover = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, isSenior }: { userId: string; isSenior: boolean }) => {
      const { data, error } = await supabase
        .from('altcontrol_approvers')
        .insert({
          workspace_id: currentWorkspace?.id,
          user_id: userId,
          is_senior: isSenior,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-approvers'] });
      toast.success('Aprovador adicionado');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar aprovador: ' + error.message);
    },
  });
};

export const useRemoveApprover = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('altcontrol_approvers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['altcontrol-approvers'] });
      toast.success('Aprovador removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover aprovador: ' + error.message);
    },
  });
};

// =============================================
// Helper Hooks - Calculation Engine
// =============================================
export const useProposalCalculations = () => {
  const { data: levels } = useAltControlLevels();
  const { data: costParams } = useAltControlCostParams();

  const calculateLevel = (totalHours: number): AltControlLevel | null => {
    if (!levels || levels.length === 0) return null;
    
    // Find the level where totalHours fits in the range
    const matchingLevel = levels.find(
      level => level.is_active && totalHours >= level.min_hours && totalHours <= level.max_hours
    );
    
    return matchingLevel || null;
  };

  const calculateEstimates = (totalHours: number) => {
    const level = calculateLevel(totalHours);
    if (!level || !costParams) {
      return {
        level: null,
        suggestedMinPrice: 0,
        suggestedMaxPrice: 0,
        estimatedCost: 0,
        estimatedMargin: 0,
      };
    }

    const avgCostPerHour = (level.min_cost_per_hour + level.max_cost_per_hour) / 2;
    const estimatedCost = totalHours * avgCostPerHour * (1 + costParams.overhead_percent / 100);
    const suggestedMinPrice = level.min_monthly_price;
    const suggestedMaxPrice = level.max_monthly_price;
    const avgPrice = (suggestedMinPrice + suggestedMaxPrice) / 2;
    const estimatedMargin = avgPrice > 0 ? ((avgPrice - estimatedCost) / avgPrice) * 100 : 0;

    return {
      level,
      suggestedMinPrice,
      suggestedMaxPrice,
      estimatedCost,
      estimatedMargin,
    };
  };

  return { calculateLevel, calculateEstimates, levels, costParams };
};
