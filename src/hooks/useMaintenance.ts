import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface MaintenanceRecord {
  id: string;
  workspace_id: string;
  item_id?: string;
  unit_id?: string;
  service_date: string;
  problem_description: string;
  solution_description?: string;
  cost: number;
  vendor?: string;
  vendor_contact?: string;
  is_resolved: boolean;
  is_warranty_claim: boolean;
  new_warranty_until?: string;
  linked_card_id?: string;
  linked_financial_entry_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  item?: any;
  unit?: any;
}

export function useMaintenanceRecords(filters?: { itemId?: string; unitId?: string }) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['maintenance-records', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('maintenance_records')
        .select('*, item:inventory_items(*), unit:inventory_units(*)')
        .eq('workspace_id', currentWorkspace.id);

      if (filters?.itemId) {
        query = query.eq('item_id', filters.itemId);
      }
      if (filters?.unitId) {
        query = query.eq('unit_id', filters.unitId);
      }

      const { data, error } = await query.order('service_date', { ascending: false });

      if (error) throw error;
      return data as MaintenanceRecord[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateMaintenanceRecord() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (record: Partial<MaintenanceRecord>) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase
        .from('maintenance_records')
        .insert({
          workspace_id: currentWorkspace.id,
          item_id: record.item_id,
          unit_id: record.unit_id,
          service_date: record.service_date || new Date().toISOString().split('T')[0],
          problem_description: record.problem_description || '',
          solution_description: record.solution_description,
          cost: record.cost || 0,
          vendor: record.vendor,
          vendor_contact: record.vendor_contact,
          is_resolved: record.is_resolved || false,
          is_warranty_claim: record.is_warranty_claim || false,
          new_warranty_until: record.new_warranty_until,
          linked_card_id: record.linked_card_id,
          notes: record.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Create financial entry for maintenance cost
      if (record.cost && record.cost > 0) {
        const today = new Date().toISOString().split('T')[0];
        const txData = {
          workspace_id: currentWorkspace.id,
          type: 'expense' as const,
          amount: record.cost,
          description: `Manutenção: ${record.problem_description}`,
          due_date: record.service_date || today,
          date: record.service_date || today,
          status: 'completed' as const,
        };
        await supabase.from('transactions').insert([txData]);
      }

      // Update item status to maintenance if not resolved
      if (!record.is_resolved && record.item_id) {
        await supabase
          .from('inventory_items')
          .update({ status_condition: 'maintenance' })
          .eq('id', record.item_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Manutenção registrada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar manutenção: ${error.message}`);
    },
  });
}

export function useUpdateMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenanceRecord> & { id: string }) => {
      const { data, error } = await supabase
        .from('maintenance_records')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If resolved, update item status back to good
      if (updates.is_resolved && data.item_id) {
        await supabase
          .from('inventory_items')
          .update({ status_condition: 'good' })
          .eq('id', data.item_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('Manutenção atualizada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

export function useMaintenanceCostByItem() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['maintenance-cost-by-item', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('maintenance_records')
        .select('item_id, cost, item:inventory_items(name)')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      // Group by item and sum costs
      const costMap = new Map<string, { itemId: string; itemName: string; totalCost: number; count: number }>();
      
      data.forEach((record: any) => {
        const key = record.item_id;
        if (!costMap.has(key)) {
          costMap.set(key, {
            itemId: key,
            itemName: record.item?.name || 'Item removido',
            totalCost: 0,
            count: 0,
          });
        }
        const entry = costMap.get(key)!;
        entry.totalCost += record.cost || 0;
        entry.count += 1;
      });

      return Array.from(costMap.values()).sort((a, b) => b.totalCost - a.totalCost);
    },
    enabled: !!currentWorkspace?.id,
  });
}
