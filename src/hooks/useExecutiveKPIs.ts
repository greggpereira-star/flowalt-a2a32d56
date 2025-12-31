import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface InventoryKPIs {
  total_items: number;
  total_units: number;
  total_asset_value: number;
  total_book_value: number;
  monthly_license_cost: number;
  yearly_license_cost: number;
  yearly_maintenance_cost: number;
  low_stock_count: number;
  expiring_subscriptions_count: number;
  underutilized_licenses_count: number;
  pending_maintenance_count: number;
  overdue_returns_count: number;
}

export interface ExecutiveKPIs {
  timestamp: string;
  workspace_id: string;
  
  // Card metrics
  cards_total: number;
  cards_in_progress: number;
  cards_overdue: number;
  cards_completed_week: number;
  cards_completed_month: number;
  
  // Time metrics
  hours_logged_week: number;
  hours_logged_month: number;
  
  // Team metrics
  active_members: number;
  members_with_activity_week: number;
  
  // Financial metrics
  revenue_month: number;
  expenses_month: number;
  profit_month: number;
  margin_month: number;
  
  // Client metrics
  active_clients: number;
  cards_per_client: number;
  
  // Velocity metrics
  avg_completion_time_hours: number;
  
  // Inventory metrics
  inventory: InventoryKPIs;
}

export const useExecutiveKPIs = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['executive-kpis', currentWorkspace?.id],
    queryFn: async (): Promise<ExecutiveKPIs | null> => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase.rpc('compute_executive_kpis', {
        p_workspace_id: currentWorkspace.id,
      });

      if (error) throw error;
      return data as unknown as ExecutiveKPIs;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useRefreshSnapshots = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('compute-snapshots');
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['executive-kpis'] });
    },
  });
};

export const useKPITrends = (days = 30) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['kpi-trends', currentWorkspace?.id, days],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('dashboard_snapshots')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('snapshot_date', startDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });
};
