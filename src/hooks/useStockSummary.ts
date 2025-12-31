import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// ============================================================
// STOCK SUMMARY READ MODEL - Arquitetura EDA
// ============================================================

export interface StockSummary {
  item_id: string;
  workspace_id: string;
  code: string;
  name: string;
  category: 'consumable' | 'equipment' | 'asset';
  department_id?: string;
  current_stock: number;
  min_stock?: number;
  status_condition: 'good' | 'fair' | 'defective' | 'maintenance';
  is_serialized: boolean;
  purchase_value?: number;
  residual_value?: number;
  useful_life_months?: number;
  stock_status: 'available' | 'low_stock' | 'out_of_stock' | 'maintenance';
  units_in_stock: number;
  units_checked_out: number;
  units_in_maintenance: number;
}

/**
 * Read Model: Resumo consolidado de estoque
 * Baseado na view inventory_stock_summary
 */
export function useStockSummary() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['stock-summary', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('inventory_stock_summary')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      return data as StockSummary[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Read Model: Itens com estoque crítico
 */
export function useCriticalStock() {
  const { data: stockSummary, ...rest } = useStockSummary();

  const criticalItems = stockSummary?.filter(
    item => item.stock_status === 'low_stock' || item.stock_status === 'out_of_stock'
  ) || [];

  return {
    data: criticalItems,
    ...rest,
  };
}

/**
 * Read Model: Itens em manutenção
 */
export function useItemsInMaintenance() {
  const { data: stockSummary, ...rest } = useStockSummary();

  const maintenanceItems = stockSummary?.filter(
    item => item.stock_status === 'maintenance' || item.units_in_maintenance > 0
  ) || [];

  return {
    data: maintenanceItems,
    ...rest,
  };
}

/**
 * Read Model: Resumo por categoria
 */
export function useStockByCategory() {
  const { data: stockSummary, ...rest } = useStockSummary();

  const byCategory = stockSummary?.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = {
        category: item.category,
        totalItems: 0,
        totalStock: 0,
        totalValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      };
    }

    acc[item.category].totalItems += 1;
    acc[item.category].totalStock += item.current_stock;
    acc[item.category].totalValue += (item.purchase_value || 0) * item.current_stock;
    
    if (item.stock_status === 'low_stock') {
      acc[item.category].lowStockCount += 1;
    }
    if (item.stock_status === 'out_of_stock') {
      acc[item.category].outOfStockCount += 1;
    }

    return acc;
  }, {} as Record<string, {
    category: string;
    totalItems: number;
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }>) || {};

  return {
    data: Object.values(byCategory),
    ...rest,
  };
}
