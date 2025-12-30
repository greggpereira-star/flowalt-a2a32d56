import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface SystemMetric {
  id: string;
  workspace_id: string | null;
  metric_type: string;
  metric_name: string;
  metric_value: number;
  dimensions: Record<string, any> | null;
  correlation_id: string | null;
  created_at: string;
}

export interface DashboardSnapshot {
  id: string;
  workspace_id: string;
  snapshot_type: string;
  snapshot_date: string;
  metrics: Record<string, number>;
  computed_at: string;
}

export const useSystemMetrics = (metricType?: string, limit = 100) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['system-metrics', currentWorkspace?.id, metricType, limit],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('system_metrics')
        .select('*')
        .or(`workspace_id.eq.${currentWorkspace.id},workspace_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (metricType) {
        query = query.eq('metric_type', metricType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SystemMetric[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useDashboardSnapshots = (snapshotType?: string, days = 30) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dashboard-snapshots', currentWorkspace?.id, snapshotType, days],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = supabase
        .from('dashboard_snapshots')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('snapshot_date', startDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: false });

      if (snapshotType) {
        query = query.eq('snapshot_type', snapshotType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DashboardSnapshot[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useLatestSnapshot = (snapshotType: string) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dashboard-snapshot-latest', currentWorkspace?.id, snapshotType],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('dashboard_snapshots')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('snapshot_type', snapshotType)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as DashboardSnapshot | null;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useAuditLogs = (entityType?: string, limit = 50) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['audit-logs', currentWorkspace?.id, entityType, limit],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });
};
