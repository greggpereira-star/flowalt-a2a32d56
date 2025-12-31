import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface DepreciationSchedule {
  id: string;
  workspace_id: string;
  item_id?: string;
  unit_id?: string;
  month_ref: string;
  depreciation_amount: number;
  accumulated_depreciation: number;
  book_value: number;
  created_at: string;
  item?: any;
  unit?: any;
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

export function useGenerateDepreciation() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (monthRef: string) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Fetch all depreciable items (assets with useful_life_months > 0)
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('category', 'asset')
        .gt('useful_life_months', 0);

      if (itemsError) throw itemsError;

      const schedules: Partial<DepreciationSchedule>[] = [];
      let totalDepreciation = 0;

      for (const item of items || []) {
        const purchaseValue = item.purchase_value || 0;
        const residualValue = item.residual_value || 0;
        const usefulLife = item.useful_life_months || 1;
        
        // Straight-line depreciation
        const depreciableBase = purchaseValue - residualValue;
        const monthlyDepreciation = depreciableBase / usefulLife;

        // Get accumulated depreciation
        const { data: previousSchedules } = await supabase
          .from('depreciation_schedules')
          .select('accumulated_depreciation')
          .eq('item_id', item.id)
          .order('month_ref', { ascending: false })
          .limit(1);

        const previousAccumulated = previousSchedules?.[0]?.accumulated_depreciation || 0;
        const newAccumulated = previousAccumulated + monthlyDepreciation;
        const bookValue = purchaseValue - newAccumulated;

        // Only generate if there's still value to depreciate
        if (bookValue > residualValue) {
          // Insert schedule
          const { error: scheduleError } = await supabase
            .from('depreciation_schedules')
            .insert({
              workspace_id: currentWorkspace.id,
              item_id: item.id,
              month_ref: monthRef,
              depreciation_amount: monthlyDepreciation,
              accumulated_depreciation: newAccumulated,
              book_value: Math.max(bookValue, residualValue),
            });

          if (!scheduleError) {
            totalDepreciation += monthlyDepreciation;
            schedules.push({ item_id: item.id } as Partial<DepreciationSchedule>);
          }
        }
      }

      // Create DRE entry (non-cash adjustment)
      if (totalDepreciation > 0) {
        const dateStr = format(endOfMonth(new Date(monthRef + '-01')), 'yyyy-MM-dd');
        const txData = {
          workspace_id: currentWorkspace.id,
          type: 'expense' as const,
          amount: totalDepreciation,
          description: `Depreciação - ${monthRef}`,
          due_date: dateStr,
          date: dateStr,
          status: 'paid' as const,
        };
        await supabase.from('transactions').insert([txData]);
      }

      return { schedulesCreated: schedules.length, totalDepreciation };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['depreciation-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`Depreciação gerada: ${result.schedulesCreated} itens, R$ ${result.totalDepreciation.toFixed(2)}`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar depreciação: ${error.message}`);
    },
  });
}

export function useDepreciationSummary() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['depreciation-summary', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { totalAssets: 0, totalBookValue: 0, totalAccumulated: 0, monthlyDepreciation: 0 };

      // Get latest schedules for each item
      const { data: schedules, error } = await supabase
        .from('depreciation_schedules')
        .select('item_id, depreciation_amount, accumulated_depreciation, book_value, month_ref')
        .eq('workspace_id', currentWorkspace.id)
        .order('month_ref', { ascending: false });

      if (error) throw error;

      // Get unique items with their latest values
      const itemMap = new Map<string, DepreciationSchedule>();
      schedules?.forEach(s => {
        if (!itemMap.has(s.item_id)) {
          itemMap.set(s.item_id, s as DepreciationSchedule);
        }
      });

      let totalBookValue = 0;
      let totalAccumulated = 0;
      let monthlyDepreciation = 0;

      itemMap.forEach(schedule => {
        totalBookValue += schedule.book_value;
        totalAccumulated += schedule.accumulated_depreciation;
        monthlyDepreciation += schedule.depreciation_amount;
      });

      return {
        totalAssets: itemMap.size,
        totalBookValue,
        totalAccumulated,
        monthlyDepreciation,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useDepreciationByDepartment() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['depreciation-by-department', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('depreciation_schedules')
        .select(`
          depreciation_amount,
          item:inventory_items(department_id, name)
        `)
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      // Group by department
      const deptMap = new Map<string, { departmentId: string; total: number; items: string[] }>();
      
      data?.forEach((s: any) => {
        const deptId = s.item?.department_id || 'sem-departamento';
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { departmentId: deptId, total: 0, items: [] });
        }
        const entry = deptMap.get(deptId)!;
        entry.total += s.depreciation_amount || 0;
        if (s.item?.name && !entry.items.includes(s.item.name)) {
          entry.items.push(s.item.name);
        }
      });

      return Array.from(deptMap.values()).sort((a, b) => b.total - a.total);
    },
    enabled: !!currentWorkspace?.id,
  });
}
