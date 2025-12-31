import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

// ============================================================
// DEPRECIATION HOOKS - Sprint 4 Depreciação & DRE
// ============================================================

export interface DepreciationSchedule {
  id: string;
  workspace_id: string;
  item_id?: string;
  unit_id?: string;
  month_ref: string;
  depreciation_amount: number;
  accumulated_depreciation: number;
  book_value: number;
  is_posted_to_dre?: boolean;
  financial_entry_id?: string;
  created_at: string;
  item?: any;
  unit?: any;
}

export interface DepreciationSummary {
  total_items: number;
  monthly_depreciation: number;
  total_accumulated: number;
  total_book_value: number;
  last_calculation: string;
}

export interface DRESummaryEntry {
  workspace_id: string;
  year: number;
  month: number;
  type: 'income' | 'expense';
  total_amount: number;
  non_cash_amount: number;
  cash_amount: number;
}

export function useDepreciationSchedules(monthRef?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['depreciation-schedules', currentWorkspace?.id, monthRef],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('depreciation_schedules')
        .select('*, item:inventory_items(*), unit:inventory_units(*)')
        .eq('workspace_id', currentWorkspace.id);

      if (monthRef) {
        query = query.eq('month_ref', monthRef);
      }

      const { data, error } = await query.order('month_ref', { ascending: false });

      if (error) throw error;
      return data as DepreciationSchedule[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para executar cálculo de depreciação via RPC
 */
export function useCalculateDepreciation() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (monthRef: string) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase.rpc('calculate_monthly_depreciation', {
        p_workspace_id: currentWorkspace.id,
        p_month_ref: monthRef,
      });

      if (error) throw error;
      
      // RPC returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;
      return result as { items_processed: number; total_depreciation: number; dre_entry_id: string | null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['depreciation-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dre-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['domain-events'] });
      
      if (result.items_processed > 0) {
        toast.success(`Depreciação calculada: ${result.items_processed} itens, R$ ${result.total_depreciation.toFixed(2)}`);
      } else {
        toast.info('Nenhum item para depreciar neste mês');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao calcular depreciação: ${error.message}`);
    },
  });
}

/**
 * Hook legado mantido para compatibilidade
 */
export function useGenerateDepreciation() {
  return useCalculateDepreciation();
}

/**
 * Hook para resumo de depreciação via view
 */
export function useDepreciationSummary() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['depreciation-summary', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { totalAssets: 0, totalBookValue: 0, totalAccumulated: 0, monthlyDepreciation: 0 };

      const { data, error } = await supabase
        .from('depreciation_summary_view')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        totalAssets: data?.total_items || 0,
        totalBookValue: data?.total_book_value || 0,
        totalAccumulated: data?.total_accumulated || 0,
        monthlyDepreciation: data?.monthly_depreciation || 0,
        lastCalculation: data?.last_calculation || null,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para DRE com separação caixa vs não-caixa
 */
export function useDRESummary(year?: number) {
  const { currentWorkspace } = useWorkspace();
  const currentYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['dre-summary', currentWorkspace?.id, currentYear],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('dre_summary_view')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('year', currentYear);

      if (error) throw error;
      return (data || []) as unknown as DRESummaryEntry[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para depreciação por departamento
 */
export function useDepreciationByDepartment(monthRef?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['depreciation-by-department', currentWorkspace?.id, monthRef],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('depreciation_by_department_view')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (monthRef) {
        query = query.eq('month_ref', monthRef);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Array<{
        workspace_id: string;
        department_id: string | null;
        month_ref: string;
        items_count: number;
        total_depreciation: number;
        total_book_value: number;
        total_accumulated: number;
      }>;
    },
    enabled: !!currentWorkspace?.id,
  });
}
