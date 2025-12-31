import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// ============================================================
// WARRANTY STATUS HOOK - Sprint 3 Manutenção & Garantias
// ============================================================

export interface WarrantyStatusEntry {
  unit_id: string;
  serial_number: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  warranty_provider: string | null;
  item_id: string;
  item_name: string;
  workspace_id: string;
  current_status: string;
  item_condition: string | null;
  days_until_expiry: number | null;
  warranty_status: 'no_warranty' | 'expired' | 'critical' | 'warning' | 'attention' | 'ok';
}

export type WarrantyFilter = 'all' | 'expired' | 'critical' | 'warning' | 'attention' | 'ok';

/**
 * Hook para buscar status de garantias
 */
export function useWarrantyStatus(filter: WarrantyFilter = 'all') {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['warranty-status', currentWorkspace?.id, filter],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('warranty_status_view')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (filter !== 'all') {
        query = query.eq('warranty_status', filter);
      }

      const { data, error } = await query.order('days_until_expiry', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as WarrantyStatusEntry[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para estatísticas de garantia
 */
export function useWarrantyStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['warranty-stats', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('warranty_status_view')
        .select('warranty_status')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        expired: 0,
        critical: 0,
        warning: 0,
        attention: 0,
        ok: 0,
        no_warranty: 0,
      };

      data?.forEach(item => {
        const status = (item as { warranty_status: string }).warranty_status as keyof typeof stats;
        if (status in stats) {
          stats[status]++;
        }
      });

      return stats;
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para unidades com garantia vencendo em X dias
 */
export function useExpiringWarrantiesSoon(daysAhead: number = 30) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['expiring-warranties-soon', currentWorkspace?.id, daysAhead],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('warranty_status_view')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .lte('days_until_expiry', daysAhead)
        .gt('days_until_expiry', 0)
        .order('days_until_expiry', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as WarrantyStatusEntry[];
    },
    enabled: !!currentWorkspace?.id,
  });
}
