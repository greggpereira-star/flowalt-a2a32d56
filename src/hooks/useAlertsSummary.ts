import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// ============================================================
// ALERTS SUMMARY READ MODEL - Arquitetura EDA
// ============================================================

export interface AlertsSummary {
  workspace_id: string;
  active_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  acknowledged_alerts: number;
  resolved_alerts: number;
}

/**
 * Read Model: Resumo consolidado de alertas financeiros
 * Baseado na view financial_alerts_summary
 */
export function useAlertsSummary() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['alerts-summary', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('financial_alerts_summary')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (error) {
        // No data yet - return empty summary
        if (error.code === 'PGRST116') {
          return {
            workspace_id: currentWorkspace.id,
            active_alerts: 0,
            critical_alerts: 0,
            high_alerts: 0,
            medium_alerts: 0,
            low_alerts: 0,
            acknowledged_alerts: 0,
            resolved_alerts: 0,
          } as AlertsSummary;
        }
        throw error;
      }
      return data as AlertsSummary;
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para verificar se há alertas críticos
 */
export function useHasCriticalAlerts() {
  const { data: summary, ...rest } = useAlertsSummary();
  
  return {
    hasCritical: (summary?.critical_alerts || 0) > 0,
    hasHigh: (summary?.high_alerts || 0) > 0,
    totalActive: summary?.active_alerts || 0,
    ...rest,
  };
}
