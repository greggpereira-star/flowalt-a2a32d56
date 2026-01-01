import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

// Types
export type ClientStatus = 'active' | 'paused' | 'closed';
export type ClientFinancialState = 'healthy' | 'attention' | 'critical' | 'loss';

export interface ClientCard {
  id: string;
  workspace_id: string;
  legacy_client_id: string | null;
  
  // Identidade
  name: string;
  segment: string | null;
  status: ClientStatus;
  responsible_user_id: string | null;
  start_date: string | null;
  important_links: { label: string; url: string }[];
  logo_url: string | null;
  color: string | null;
  
  // Onboarding
  about_client: string | null;
  objectives: string | null;
  target_audience: string | null;
  challenges: string | null;
  competitors: string | null;
  relationship_tone: string | null;
  
  // Branding
  positioning: string | null;
  personality: string | null;
  visual_guidelines: string | null;
  brand_files: { name: string; url: string; type: string }[];
  
  // É, Faz e Fala
  brand_essence: string | null;
  products_services: string | null;
  language_style: string | null;
  keywords: string[];
  language_restrictions: string | null;
  
  // Contrato & Escopo
  contract_type: string | null;
  contracted_services: string[];
  agreed_deliverables: string | null;
  scope_limits: string | null;
  contract_notes: string | null;
  
  // Metadados
  health_score: number;
  financial_state: ClientFinancialState;
  
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ClientFinancials {
  id: string;
  client_card_id: string;
  workspace_id: string;
  contract_value: number | null;
  billing_type: string | null;
  expected_margin: number | null;
  financial_notes: string | null;
  total_revenue: number;
  total_cost: number;
  total_hours: number;
  real_margin: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientCardInput {
  name: string;
  segment?: string;
  status?: ClientStatus;
  responsible_user_id?: string;
  start_date?: string;
  color?: string;
  logo_url?: string;
}

// Fetch all client cards for the workspace
export const useClientCards = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['client-cards', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('client_cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        important_links: Array.isArray(item.important_links) ? item.important_links : [],
        brand_files: Array.isArray(item.brand_files) ? item.brand_files : [],
        keywords: item.keywords || [],
        contracted_services: item.contracted_services || [],
      })) as ClientCard[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

// Fetch client cards by status
export const useClientCardsByStatus = (status: ClientStatus) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['client-cards', currentWorkspace?.id, status],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('client_cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', status)
        .order('name', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        important_links: Array.isArray(item.important_links) ? item.important_links : [],
        brand_files: Array.isArray(item.brand_files) ? item.brand_files : [],
        keywords: item.keywords || [],
        contracted_services: item.contracted_services || [],
      })) as ClientCard[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

// Fetch single client card
export const useClientCard = (clientCardId: string | undefined) => {
  return useQuery({
    queryKey: ['client-card', clientCardId],
    queryFn: async () => {
      if (!clientCardId) return null;

      const { data, error } = await supabase
        .from('client_cards')
        .select('*')
        .eq('id', clientCardId)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        important_links: Array.isArray(data.important_links) ? data.important_links : [],
        brand_files: Array.isArray(data.brand_files) ? data.brand_files : [],
        keywords: data.keywords || [],
        contracted_services: data.contracted_services || [],
      } as ClientCard;
    },
    enabled: !!clientCardId,
  });
};

// Fetch client financials (restricted to coordinators/admins/owners)
export const useClientFinancials = (clientCardId: string | undefined) => {
  return useQuery({
    queryKey: ['client-financials', clientCardId],
    queryFn: async () => {
      if (!clientCardId) return null;

      const { data, error } = await supabase
        .from('client_financials')
        .select('*')
        .eq('client_card_id', clientCardId)
        .maybeSingle();

      if (error) {
        // RLS will block access for non-authorized users
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      
      return data as ClientFinancials | null;
    },
    enabled: !!clientCardId,
  });
};

// Create client card
export const useCreateClientCard = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (input: CreateClientCardInput) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase
        .from('client_cards')
        .insert({
          workspace_id: currentWorkspace.id,
          name: input.name,
          segment: input.segment,
          status: input.status || 'active',
          responsible_user_id: input.responsible_user_id,
          start_date: input.start_date,
          color: input.color,
          logo_url: input.logo_url,
        })
        .select()
        .single();

      if (error) throw error;

      // Create associated financials record
      const { error: financialsError } = await supabase
        .from('client_financials')
        .insert({
          client_card_id: data.id,
          workspace_id: currentWorkspace.id,
        });

      if (financialsError) console.error('Error creating financials:', financialsError);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-cards'] });
      toast.success('Cliente criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating client card:', error);
      toast.error('Erro ao criar cliente');
    },
  });
};

// Update client card
export const useUpdateClientCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClientCard> & { id: string }) => {
      const { data, error } = await supabase
        .from('client_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-cards'] });
      queryClient.invalidateQueries({ queryKey: ['client-card', data.id] });
      toast.success('Cliente atualizado');
    },
    onError: (error) => {
      console.error('Error updating client card:', error);
      toast.error('Erro ao atualizar cliente');
    },
  });
};

// Update client status (move between folders)
export const useUpdateClientStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ClientStatus }) => {
      const { data, error } = await supabase
        .from('client_cards')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-cards'] });
      toast.success('Status do cliente atualizado');
    },
    onError: (error) => {
      console.error('Error updating client status:', error);
      toast.error('Erro ao atualizar status');
    },
  });
};

// Update client financials
export const useUpdateClientFinancials = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClientFinancials> & { id: string }) => {
      const { data, error } = await supabase
        .from('client_financials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-financials', data.client_card_id] });
      toast.success('Dados financeiros atualizados');
    },
    onError: (error) => {
      console.error('Error updating client financials:', error);
      toast.error('Erro ao atualizar dados financeiros');
    },
  });
};

// Delete client card
export const useDeleteClientCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-cards'] });
      toast.success('Cliente removido');
    },
    onError: (error) => {
      console.error('Error deleting client card:', error);
      toast.error('Erro ao remover cliente');
    },
  });
};
