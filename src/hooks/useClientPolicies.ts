import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface ClientPolicy {
  id: string;
  client_card_id: string;
  workspace_id: string;
  
  // Scope limits
  max_monthly_hours: number | null;
  max_tasks_per_month: number | null;
  max_budget_per_month: number | null;
  
  // Approval rules
  requires_briefing_approval: boolean;
  briefing_approvers: string[];
  requires_delivery_approval: boolean;
  delivery_approvers: string[];
  
  // Alert thresholds
  hours_alert_threshold: number;
  budget_alert_threshold: number;
  margin_alert_threshold: number;
  
  // Auto-pause rules
  auto_pause_on_overdue_payment: boolean;
  overdue_days_to_pause: number;
  auto_pause_on_negative_margin: boolean;
  
  // Communication rules
  weekly_report_enabled: boolean;
  monthly_report_enabled: boolean;
  report_recipients: string[];
  
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsellSuggestion {
  id: string;
  client_card_id: string;
  workspace_id: string;
  suggestion_type: 'hours_increase' | 'scope_expansion' | 'new_service' | 'contract_upgrade';
  title: string;
  description: string | null;
  trigger_metric: string;
  trigger_value: number | null;
  suggested_value: number | null;
  potential_revenue_increase: number | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch client policy
export const useClientPolicy = (clientCardId: string | undefined) => {
  return useQuery({
    queryKey: ['client-policy', clientCardId],
    queryFn: async () => {
      if (!clientCardId) return null;

      const { data, error } = await supabase
        .from('client_policies')
        .select('*')
        .eq('client_card_id', clientCardId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientPolicy | null;
    },
    enabled: !!clientCardId,
  });
};

// Create or update client policy
export const useUpsertClientPolicy = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (input: Partial<ClientPolicy> & { client_card_id: string }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      // Check if policy exists
      const { data: existing } = await supabase
        .from('client_policies')
        .select('id')
        .eq('client_card_id', input.client_card_id)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('client_policies')
          .update(input)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('client_policies')
          .insert({
            ...input,
            workspace_id: currentWorkspace.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-policy', data.client_card_id] });
      toast.success('Políticas atualizadas');
    },
    onError: (error) => {
      console.error('Error updating policy:', error);
      toast.error('Erro ao atualizar políticas');
    },
  });
};

// Fetch upsell suggestions for a client
export const useClientUpsellSuggestions = (clientCardId: string | undefined) => {
  return useQuery({
    queryKey: ['client-upsell-suggestions', clientCardId],
    queryFn: async () => {
      if (!clientCardId) return [];

      const { data, error } = await supabase
        .from('client_upsell_suggestions')
        .select('*')
        .eq('client_card_id', clientCardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as UpsellSuggestion[];
    },
    enabled: !!clientCardId,
  });
};

// Fetch all pending upsell suggestions for workspace
export const useAllPendingUpsellSuggestions = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['all-upsell-suggestions', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('client_upsell_suggestions')
        .select('*, client_cards(name, color)')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending')
        .order('potential_revenue_increase', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });
};

// Update upsell suggestion status
export const useUpdateUpsellSuggestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      rejection_reason 
    }: { 
      id: string; 
      status: 'accepted' | 'rejected'; 
      rejection_reason?: string;
    }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'accepted') {
        updateData.accepted_at = new Date().toISOString();
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = rejection_reason;
      }

      const { data, error } = await supabase
        .from('client_upsell_suggestions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-upsell-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['all-upsell-suggestions'] });
      toast.success(data.status === 'accepted' ? 'Sugestão aceita!' : 'Sugestão rejeitada');
    },
    onError: (error) => {
      console.error('Error updating suggestion:', error);
      toast.error('Erro ao atualizar sugestão');
    },
  });
};

// Generate upsell suggestions based on client metrics
export const useGenerateUpsellSuggestions = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (clientCardId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      // Get client financials and report data
      const { data: clientCard } = await supabase
        .from('client_cards')
        .select('*, client_financials(*)')
        .eq('id', clientCardId)
        .single();

      if (!clientCard) throw new Error('Client not found');

      const financials = Array.isArray(clientCard.client_financials) 
        ? clientCard.client_financials[0] 
        : clientCard.client_financials;

      // Get policy to check limits
      const { data: policy } = await supabase
        .from('client_policies')
        .select('*')
        .eq('client_card_id', clientCardId)
        .maybeSingle();

      // Get cards for this client
      const { data: cards } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('client_id', clientCard.legacy_client_id || '');

      // Get time entries
      const cardIds = (cards || []).map(c => c.id);
      const { data: timeEntries } = cardIds.length > 0
        ? await supabase
            .from('time_entries')
            .select('*')
            .in('card_id', cardIds)
        : { data: [] };

      const totalHours = (timeEntries || []).reduce((acc, e) => acc + (e.duration_seconds / 3600), 0);
      const suggestions: Array<{
        client_card_id: string;
        workspace_id: string;
        suggestion_type: string;
        title: string;
        description: string;
        trigger_metric: string;
        trigger_value: number;
        suggested_value: number;
        potential_revenue_increase: number;
        status: string;
        valid_until: string;
      }> = [];

      // Check hours utilization
      if (policy?.max_monthly_hours && totalHours >= policy.max_monthly_hours * 0.9) {
        const suggestedIncrease = Math.ceil(policy.max_monthly_hours * 0.3);
        suggestions.push({
          client_card_id: clientCardId,
          workspace_id: currentWorkspace.id,
          suggestion_type: 'hours_increase',
          title: 'Ampliar pacote de horas',
          description: `Cliente está utilizando ${Math.round((totalHours / policy.max_monthly_hours) * 100)}% das horas contratadas. Sugerimos ampliar o pacote em ${suggestedIncrease}h.`,
          trigger_metric: 'hours_utilization',
          trigger_value: totalHours,
          suggested_value: policy.max_monthly_hours + suggestedIncrease,
          potential_revenue_increase: suggestedIncrease * 150, // Assuming R$150/hour
          status: 'pending',
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Check high margin - opportunity for scope expansion
      const contractValue = financials?.contract_value || 0;
      const totalRevenue = financials?.total_revenue || 0;
      if (contractValue > 0 && totalRevenue >= contractValue * 0.8) {
        suggestions.push({
          client_card_id: clientCardId,
          workspace_id: currentWorkspace.id,
          suggestion_type: 'scope_expansion',
          title: 'Expandir escopo do contrato',
          description: `O valor contratado está próximo de ser consumido. Oportunidade para renegociar e expandir escopo.`,
          trigger_metric: 'contract_consumption',
          trigger_value: totalRevenue,
          suggested_value: contractValue * 1.5,
          potential_revenue_increase: contractValue * 0.5,
          status: 'pending',
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Check task volume
      const tasksLastMonth = (cards || []).filter(c => {
        const created = new Date(c.created_at);
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return created >= monthAgo;
      }).length;

      if (policy?.max_tasks_per_month && tasksLastMonth >= policy.max_tasks_per_month * 0.9) {
        suggestions.push({
          client_card_id: clientCardId,
          workspace_id: currentWorkspace.id,
          suggestion_type: 'contract_upgrade',
          title: 'Upgrade de plano',
          description: `Cliente está no limite de tarefas mensais (${tasksLastMonth}/${policy.max_tasks_per_month}). Proponha upgrade de plano.`,
          trigger_metric: 'task_volume',
          trigger_value: tasksLastMonth,
          suggested_value: policy.max_tasks_per_month * 1.5,
          potential_revenue_increase: contractValue * 0.3,
          status: 'pending',
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Insert suggestions
      if (suggestions.length > 0) {
        const { error } = await supabase
          .from('client_upsell_suggestions')
          .insert(suggestions);

        if (error) throw error;
      }

      return suggestions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['client-upsell-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['all-upsell-suggestions'] });
      if (count > 0) {
        toast.success(`${count} sugestão(ões) de upsell gerada(s)!`);
      } else {
        toast.info('Nenhuma nova sugestão identificada');
      }
    },
    onError: (error) => {
      console.error('Error generating suggestions:', error);
      toast.error('Erro ao gerar sugestões');
    },
  });
};
