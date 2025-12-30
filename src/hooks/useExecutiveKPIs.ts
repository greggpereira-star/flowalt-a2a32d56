import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

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
  
  // Client metrics
  active_clients: number;
  cards_per_client: number;
  
  // Velocity metrics
  avg_completion_time_hours: number;
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
};

export const useRefreshSnapshots = () => {
  const { currentWorkspace } = useWorkspace();
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

// Hook to get KPI trends over time
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
