import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

// ============================================================
// MAINTENANCE COSTS HOOK - Sprint 3 Manutenção & Garantias
// ============================================================

export interface MaintenanceCostEntry {
  id: string;
  workspace_id: string;
  item_id: string;
  unit_id: string | null;
  item_name: string;
  serial_number: string | null;
  maintenance_type: string | null;
  problem_description: string;
  solution_description: string | null;
  cost: number | null;
  status: string;
  is_resolved: boolean;
  is_warranty_claim: boolean;
  scheduled_date: string | null;
  completed_date: string | null;
  performed_by: string | null;
  vendor: string | null;
  created_at: string;
  month: number;
  year: number;
}

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Hook para buscar manutenções com custos
 */
export function useMaintenanceCosts(filters?: {
  status?: MaintenanceStatus;
  itemId?: string;
  year?: number;
  month?: number;
}) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['maintenance-costs', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('maintenance_costs_view')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.itemId) {
        query = query.eq('item_id', filters.itemId);
      }
      if (filters?.year) {
        query = query.eq('year', filters.year);
      }
      if (filters?.month) {
        query = query.eq('month', filters.month);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MaintenanceCostEntry[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para atualizar status de manutenção
 */
export function useUpdateMaintenanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      maintenanceId: string;
      status: MaintenanceStatus;
      completedDate?: string;
      solutionDescription?: string;
      cost?: number;
    }) => {
      const updateData: Record<string, unknown> = {
        status: params.status,
        updated_at: new Date().toISOString(),
      };

      if (params.status === 'completed') {
        updateData.is_resolved = true;
        updateData.completed_date = params.completedDate || new Date().toISOString().split('T')[0];
      }

      if (params.solutionDescription) {
        updateData.solution_description = params.solutionDescription;
      }

      if (params.cost !== undefined) {
        updateData.cost = params.cost;
      }

      const { data, error } = await supabase
        .from('maintenance_records')
        .update(updateData)
        .eq('id', params.maintenanceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-costs'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['domain-events'] });
      toast.success('Status da manutenção atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

/**
 * Hook para estatísticas de manutenção
 */
export function useMaintenanceStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['maintenance-stats', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('maintenance_costs_view')
        .select('status, cost, is_warranty_claim')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        scheduled: 0,
        inProgress: 0,
        completed: 0,
        totalCost: 0,
        warrantyClaims: 0,
        avgCost: 0,
      };

      data?.forEach(item => {
        const record = item as { status: string; cost: number | null; is_warranty_claim: boolean };
        if (record.status === 'scheduled') stats.scheduled++;
        if (record.status === 'in_progress') stats.inProgress++;
        if (record.status === 'completed') {
          stats.completed++;
          if (record.cost) stats.totalCost += record.cost;
        }
        if (record.is_warranty_claim) stats.warrantyClaims++;
      });

      if (stats.completed > 0) {
        stats.avgCost = stats.totalCost / stats.completed;
      }

      return stats;
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para custos de manutenção por período
 */
export function useMaintenanceCostsByPeriod(year?: number) {
  const { currentWorkspace } = useWorkspace();
  const currentYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['maintenance-costs-by-period', currentWorkspace?.id, currentYear],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('maintenance_costs_view')
        .select('month, cost')
        .eq('workspace_id', currentWorkspace.id)
        .eq('year', currentYear)
        .eq('status', 'completed');

      if (error) throw error;

      // Agregar por mês
      const monthlyData: Record<number, number> = {};
      data?.forEach(item => {
        const record = item as { month: number; cost: number | null };
        if (!monthlyData[record.month]) {
          monthlyData[record.month] = 0;
        }
        monthlyData[record.month] += record.cost || 0;
      });

      // Converter para array ordenado
      return Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: new Date(2024, i, 1).toLocaleDateString('pt-BR', { month: 'short' }),
        cost: monthlyData[i + 1] || 0,
      }));
    },
    enabled: !!currentWorkspace?.id,
  });
}
