import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCorrelationId, getSessionId } from '@/lib/correlationId';

export interface SystemMetric {
  id: string;
  workspace_id: string;
  metric_type: string;
  metric_name: string;
  metric_value: number;
  dimensions: Record<string, unknown>;
  correlation_id: string | null;
  created_at: string;
}

export interface DashboardSnapshot {
  id: string;
  workspace_id: string;
  snapshot_type: string;
  snapshot_date: string;
  metrics: Record<string, unknown>;
  computed_at: string;
}

export interface ApplicationLog {
  id: string;
  workspace_id: string | null;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  message: string;
  context: Record<string, unknown>;
  correlation_id: string | null;
  session_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface AggregatedMetric {
  metric_name: string;
  metric_type: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  count: number;
  last_value: number;
}

/**
 * Hook para métricas do sistema
 */
export function useSystemMetrics(metricType?: string, limit = 100) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['system-metrics', currentWorkspace?.id, metricType, limit],
    queryFn: async () => {
      let query = supabase
        .from('system_metrics')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
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
}

/**
 * Hook para snapshots de dashboard
 */
export function useDashboardSnapshots(snapshotType?: string, days = 30) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dashboard-snapshots', currentWorkspace?.id, snapshotType, days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = supabase
        .from('dashboard_snapshots')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
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
}

/**
 * Hook para logs da aplicação
 */
export function useApplicationLogs(level?: string, service?: string, limit = 100) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['application-logs', currentWorkspace?.id, level, service, limit],
    queryFn: async () => {
      let query = supabase
        .from('application_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (currentWorkspace?.id) {
        query = query.or(`workspace_id.eq.${currentWorkspace.id},workspace_id.is.null`);
      }

      if (level) {
        query = query.eq('level', level);
      }

      if (service) {
        query = query.eq('service', service);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationLog[];
    },
    enabled: true,
  });
}

/**
 * Hook para registrar métricas
 */
export function useRecordMetric() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      metricType,
      metricName,
      metricValue,
      dimensions = {},
    }: {
      metricType: string;
      metricName: string;
      metricValue: number;
      dimensions?: Record<string, unknown>;
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.rpc('record_metric', {
        p_workspace_id: currentWorkspace.id,
        p_metric_type: metricType,
        p_metric_name: metricName,
        p_metric_value: metricValue,
        p_dimensions: dimensions as unknown as Record<string, never>,
        p_correlation_id: getCurrentCorrelationId(),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] });
    },
  });
}

/**
 * Hook para computar snapshot diário
 */
export function useComputeDailySnapshot() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.rpc('compute_daily_snapshot', {
        p_workspace_id: currentWorkspace.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-snapshots'] });
    },
  });
}

/**
 * Hook para métricas agregadas
 */
export function useAggregatedMetrics(metricType?: string, days = 7) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['aggregated-metrics', currentWorkspace?.id, metricType, days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase.rpc('get_aggregated_metrics', {
        p_workspace_id: currentWorkspace!.id,
        p_metric_type: metricType || null,
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString(),
      });

      if (error) throw error;
      return data as AggregatedMetric[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para logs por correlation ID
 */
export function useLogsByCorrelation(correlationId: string | null) {
  return useQuery({
    queryKey: ['logs-by-correlation', correlationId],
    queryFn: async () => {
      if (!correlationId) return [];

      const { data, error } = await supabase
        .from('application_logs')
        .select('*')
        .eq('correlation_id', correlationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ApplicationLog[];
    },
    enabled: !!correlationId,
  });
}

/**
 * Hook para registrar logs estruturados
 */
export function useLogWriter() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const writeLog = async (
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    service: string,
    message: string,
    context: Record<string, unknown> = {}
  ) => {
    try {
      await supabase.from('application_logs').insert({
        workspace_id: currentWorkspace?.id,
        level,
        service,
        message,
        context: context as unknown as Record<string, never>,
        correlation_id: getCurrentCorrelationId(),
        session_id: getSessionId(),
        user_id: user?.id,
      });
    } catch (error) {
      console.debug('Failed to write log:', error);
    }
  };

  return {
    debug: (service: string, message: string, context?: Record<string, unknown>) =>
      writeLog('debug', service, message, context),
    info: (service: string, message: string, context?: Record<string, unknown>) =>
      writeLog('info', service, message, context),
    warn: (service: string, message: string, context?: Record<string, unknown>) =>
      writeLog('warn', service, message, context),
    error: (service: string, message: string, context?: Record<string, unknown>) =>
      writeLog('error', service, message, context),
    fatal: (service: string, message: string, context?: Record<string, unknown>) =>
      writeLog('fatal', service, message, context),
  };
}

/**
 * Hook para health check do sistema
 */
export function useSystemHealth() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['system-health', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_health_view')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000, // Atualiza a cada minuto
  });
}
