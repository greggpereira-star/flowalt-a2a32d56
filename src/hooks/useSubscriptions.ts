import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type BillingCycle = 'monthly' | 'yearly' | 'custom';
export type SubscriptionStatus = 'active' | 'expiring' | 'expired' | 'cancelled';

export interface SubscriptionLicense {
  id: string;
  workspace_id: string;
  vendor: string;
  product_name: string;
  plan?: string;
  billing_cycle: BillingCycle;
  renewal_date: string;
  auto_renew: boolean;
  seats_total?: number;
  seats_used?: number;
  cost_per_cycle: number;
  payment_method?: string;
  department_id?: string;
  owner_user_id?: string;
  cancellation_terms_url?: string;
  status: SubscriptionStatus;
  linked_financial_entry_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function useSubscriptions() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['subscriptions', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('subscription_licenses')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('renewal_date');

      if (error) throw error;
      return data as SubscriptionLicense[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useExpiringSubscriptions(daysAhead: number = 30) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['expiring-subscriptions', currentWorkspace?.id, daysAhead],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('subscription_licenses')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['active', 'expiring'])
        .lte('renewal_date', futureDate.toISOString().split('T')[0])
        .gte('renewal_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;
      return data as SubscriptionLicense[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useUnderutilizedSubscriptions() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['underutilized-subscriptions', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('subscription_licenses')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'active')
        .not('seats_total', 'is', null);

      if (error) throw error;

      // Filter where seats_used < 50% of seats_total
      return (data as SubscriptionLicense[]).filter(sub => {
        const utilization = (sub.seats_used || 0) / (sub.seats_total || 1);
        return utilization < 0.5;
      });
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (subscription: Partial<SubscriptionLicense>) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase
        .from('subscription_licenses')
        .insert({
          workspace_id: currentWorkspace.id,
          vendor: subscription.vendor || '',
          product_name: subscription.product_name || '',
          plan: subscription.plan,
          billing_cycle: subscription.billing_cycle || 'monthly',
          renewal_date: subscription.renewal_date || new Date().toISOString().split('T')[0],
          auto_renew: subscription.auto_renew ?? true,
          seats_total: subscription.seats_total,
          seats_used: subscription.seats_used,
          cost_per_cycle: subscription.cost_per_cycle || 0,
          payment_method: subscription.payment_method,
          department_id: subscription.department_id,
          owner_user_id: subscription.owner_user_id,
          cancellation_terms_url: subscription.cancellation_terms_url,
          status: subscription.status || 'active',
          notes: subscription.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Licença/assinatura criada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar licença: ${error.message}`);
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SubscriptionLicense> & { id: string }) => {
      const { data, error } = await supabase
        .from('subscription_licenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Licença atualizada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

export function useRenewSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newRenewalDate }: { id: string; newRenewalDate: string }) => {
      const { data, error } = await supabase
        .from('subscription_licenses')
        .update({
          renewal_date: newRenewalDate,
          status: 'active',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Licença renovada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao renovar: ${error.message}`);
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('subscription_licenses')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Licença cancelada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar: ${error.message}`);
    },
  });
}

export function useSubscriptionCostSummary() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['subscription-cost-summary', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { monthly: 0, yearly: 0, total: 0 };

      const { data, error } = await supabase
        .from('subscription_licenses')
        .select('cost_per_cycle, billing_cycle')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'active');

      if (error) throw error;

      let monthlyTotal = 0;
      let yearlyTotal = 0;

      (data as SubscriptionLicense[]).forEach(sub => {
        if (sub.billing_cycle === 'monthly') {
          monthlyTotal += sub.cost_per_cycle;
          yearlyTotal += sub.cost_per_cycle * 12;
        } else if (sub.billing_cycle === 'yearly') {
          monthlyTotal += sub.cost_per_cycle / 12;
          yearlyTotal += sub.cost_per_cycle;
        }
      });

      return {
        monthly: monthlyTotal,
        yearly: yearlyTotal,
        total: yearlyTotal,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
