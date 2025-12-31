import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type InventoryCategory = 'consumable' | 'equipment' | 'asset';
export type StatusCondition = 'good' | 'fair' | 'defective' | 'maintenance';
export type UnitStatus = 'in_stock' | 'checked_out' | 'maintenance' | 'retired';
export type MovementType = 'IN' | 'OUT' | 'RETURN' | 'TRANSFER' | 'ADJUST';

export interface InventoryItem {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  manufacturer_model?: string;
  category: InventoryCategory;
  department_id?: string;
  status_condition: StatusCondition;
  min_stock?: number;
  current_stock: number;
  is_serialized: boolean;
  purchase_date?: string;
  purchase_value?: number;
  residual_value?: number;
  useful_life_months?: number;
  depreciation_method: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryUnit {
  id: string;
  item_id: string;
  workspace_id: string;
  serial_number?: string;
  tag_qr_code?: string;
  current_location_id?: string;
  current_status: UnitStatus;
  warranty_start_date?: string;
  warranty_end_date?: string;
  warranty_provider?: string;
  warranty_terms_url?: string;
  invoice_ref?: string;
  created_at: string;
  updated_at: string;
  item?: InventoryItem;
}

export interface InventoryMovement {
  id: string;
  workspace_id: string;
  movement_type: MovementType;
  item_id: string;
  unit_id?: string;
  quantity: number;
  requested_by_user_id?: string;
  responsible_user_id?: string;
  department_id?: string;
  card_id?: string;
  occurred_at: string;
  notes?: string;
  created_at: string;
  item?: InventoryItem;
  unit?: InventoryUnit;
}

// Fetch inventory items
export function useInventoryItems() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['inventory-items', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');

      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Fetch inventory units
export function useInventoryUnits(itemId?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['inventory-units', currentWorkspace?.id, itemId],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('inventory_units')
        .select('*, item:inventory_items(*)')
        .eq('workspace_id', currentWorkspace.id);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as InventoryUnit[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Fetch movements
export function useInventoryMovements(filters?: { itemId?: string; cardId?: string }) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['inventory-movements', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('inventory_movements')
        .select('*, item:inventory_items(*), unit:inventory_units(*)')
        .eq('workspace_id', currentWorkspace.id);

      if (filters?.itemId) {
        query = query.eq('item_id', filters.itemId);
      }
      if (filters?.cardId) {
        query = query.eq('card_id', filters.cardId);
      }

      const { data, error } = await query.order('occurred_at', { ascending: false });

      if (error) throw error;
      return data as InventoryMovement[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Create inventory item
export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (item: Partial<InventoryItem>) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const insertData = {
        workspace_id: currentWorkspace.id,
        code: item.code || '',
        name: item.name || '',
        category: item.category as 'consumable' | 'equipment' | 'asset',
        manufacturer_model: item.manufacturer_model,
        department_id: item.department_id,
        status_condition: item.status_condition as 'good' | 'fair' | 'defective' | 'maintenance',
        min_stock: item.min_stock,
        is_serialized: item.is_serialized,
        purchase_date: item.purchase_date,
        purchase_value: item.purchase_value,
        residual_value: item.residual_value,
        useful_life_months: item.useful_life_months,
        notes: item.notes,
      };

      const { data, error } = await supabase
        .from('inventory_items')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('Item criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar item: ${error.message}`);
    },
  });
}

// Update inventory item
export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryItem> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (updates.code !== undefined) updateData.code = updates.code;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.manufacturer_model !== undefined) updateData.manufacturer_model = updates.manufacturer_model;
      if (updates.department_id !== undefined) updateData.department_id = updates.department_id;
      if (updates.status_condition !== undefined) updateData.status_condition = updates.status_condition;
      if (updates.min_stock !== undefined) updateData.min_stock = updates.min_stock;
      if (updates.is_serialized !== undefined) updateData.is_serialized = updates.is_serialized;
      if (updates.purchase_date !== undefined) updateData.purchase_date = updates.purchase_date;
      if (updates.purchase_value !== undefined) updateData.purchase_value = updates.purchase_value;
      if (updates.residual_value !== undefined) updateData.residual_value = updates.residual_value;
      if (updates.useful_life_months !== undefined) updateData.useful_life_months = updates.useful_life_months;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { data, error } = await supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('Item atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

// Create inventory unit
export function useCreateInventoryUnit() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (unit: Partial<InventoryUnit>) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');
      if (!unit.item_id) throw new Error('Item obrigatório');

      const { data, error } = await supabase
        .from('inventory_units')
        .insert({
          workspace_id: currentWorkspace.id,
          item_id: unit.item_id,
          serial_number: unit.serial_number,
          tag_qr_code: unit.tag_qr_code,
          current_location_id: unit.current_location_id,
          current_status: unit.current_status || 'in_stock',
          warranty_start_date: unit.warranty_start_date,
          warranty_end_date: unit.warranty_end_date,
          warranty_provider: unit.warranty_provider,
          warranty_terms_url: unit.warranty_terms_url,
          invoice_ref: unit.invoice_ref,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      toast.success('Unidade criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar unidade: ${error.message}`);
    },
  });
}

// Create movement (IN/OUT/RETURN/TRANSFER/ADJUST)
export function useCreateMovement() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (movement: Partial<InventoryMovement>) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');
      if (!movement.item_id) throw new Error('Item obrigatório');
      if (!movement.movement_type) throw new Error('Tipo de movimento obrigatório');

      const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
          workspace_id: currentWorkspace.id,
          movement_type: movement.movement_type,
          item_id: movement.item_id,
          unit_id: movement.unit_id,
          quantity: movement.quantity || 1,
          requested_by_user_id: movement.requested_by_user_id,
          responsible_user_id: movement.responsible_user_id,
          department_id: movement.department_id,
          card_id: movement.card_id,
          occurred_at: movement.occurred_at || new Date().toISOString(),
          notes: movement.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Update unit status if serialized
      if (movement.unit_id) {
        let newStatus: UnitStatus = 'in_stock';
        if (movement.movement_type === 'OUT') newStatus = 'checked_out';
        if (movement.movement_type === 'RETURN') newStatus = 'in_stock';

        await supabase
          .from('inventory_units')
          .update({ current_status: newStatus })
          .eq('id', movement.unit_id);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      
      const typeLabels: Record<MovementType, string> = {
        IN: 'Entrada registrada',
        OUT: 'Saída registrada',
        RETURN: 'Devolução registrada',
        TRANSFER: 'Transferência registrada',
        ADJUST: 'Ajuste registrado',
      };
      toast.success(typeLabels[variables.movement_type as MovementType] || 'Movimento registrado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar movimento: ${error.message}`);
    },
  });
}

// Low stock items
export function useLowStockItems() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['low-stock-items', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('category', 'consumable')
        .not('min_stock', 'is', null);

      if (error) throw error;

      // Filter items where current_stock < min_stock
      return (data as InventoryItem[]).filter(
        item => item.current_stock < (item.min_stock || 0)
      );
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Expiring warranties
export function useExpiringWarranties(daysAhead: number = 30) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['expiring-warranties', currentWorkspace?.id, daysAhead],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('inventory_units')
        .select('*, item:inventory_items(*)')
        .eq('workspace_id', currentWorkspace.id)
        .not('warranty_end_date', 'is', null)
        .lte('warranty_end_date', futureDate.toISOString().split('T')[0])
        .gte('warranty_end_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;
      return data as InventoryUnit[];
    },
    enabled: !!currentWorkspace?.id,
  });
}
