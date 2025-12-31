import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

// ============================================================
// STOCK OPERATIONS HOOK - Sprint 2 Almoxarifado
// ============================================================

export interface CheckoutValidation {
  valid: boolean;
  error?: string;
  warning?: string;
  message: string;
  item_name?: string;
  unit_serial?: string;
  current_status?: string;
  available?: number;
  requested?: number;
  after_checkout?: number;
  min_stock?: number;
}

export interface MovementTimelineEntry {
  id: string;
  movement_type: string;
  quantity: number;
  stock_delta: number;
  serial_number?: string;
  card_title?: string;
  department_name?: string;
  notes?: string;
  occurred_at: string;
  running_balance: number;
}

/**
 * Hook para validar disponibilidade antes de checkout
 */
export function useValidateCheckout() {
  return useMutation({
    mutationFn: async (params: {
      itemId: string;
      unitId?: string;
      quantity?: number;
    }) => {
      const { data, error } = await supabase.rpc('validate_checkout_availability', {
        p_item_id: params.itemId,
        p_unit_id: params.unitId,
        p_quantity: params.quantity || 1,
      });

      if (error) throw error;
      return data as unknown as CheckoutValidation;
    },
  });
}

/**
 * Hook para validar checkout de forma síncrona (query)
 */
export function useCheckoutAvailability(
  itemId: string | undefined,
  unitId: string | undefined,
  quantity: number = 1
) {
  return useQuery({
    queryKey: ['checkout-availability', itemId, unitId, quantity],
    queryFn: async () => {
      if (!itemId) return null;

      const { data, error } = await supabase.rpc('validate_checkout_availability', {
        p_item_id: itemId,
        p_unit_id: unitId,
        p_quantity: quantity,
      });

      if (error) throw error;
      return data as unknown as CheckoutValidation;
    },
    enabled: !!itemId,
  });
}

/**
 * Hook para timeline de movimentações de um item
 */
export function useItemMovementTimeline(itemId: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: ['item-movement-timeline', itemId, limit],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await supabase.rpc('get_item_movement_timeline', {
        p_item_id: itemId,
        p_limit: limit,
      });

      if (error) throw error;
      return data as unknown as MovementTimelineEntry[];
    },
    enabled: !!itemId,
  });
}

/**
 * Hook para movimento com validação prévia
 */
export function useValidatedMovement() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      movementType: 'IN' | 'OUT' | 'RETURN' | 'TRANSFER' | 'ADJUST';
      itemId: string;
      unitId?: string;
      quantity: number;
      departmentId?: string;
      cardId?: string;
      notes?: string;
      skipValidation?: boolean;
    }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Validate for OUT movements unless skipped
      if (params.movementType === 'OUT' && !params.skipValidation) {
        const { data: validation, error: validationError } = await supabase.rpc(
          'validate_checkout_availability',
          {
            p_item_id: params.itemId,
            p_unit_id: params.unitId,
            p_quantity: params.quantity,
          }
        );

        if (validationError) throw validationError;

        const result = validation as unknown as CheckoutValidation;

        if (!result.valid) {
          throw new Error(result.message);
        }

        // Show warning if exists
        if (result.warning) {
          toast.warning(result.message);
        }
      }

      // Create the movement
      const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
          workspace_id: currentWorkspace.id,
          movement_type: params.movementType,
          item_id: params.itemId,
          unit_id: params.unitId,
          quantity: params.quantity,
          department_id: params.departmentId,
          card_id: params.cardId,
          notes: params.notes,
          occurred_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update unit status if serialized
      if (params.unitId) {
        let newStatus: 'in_stock' | 'checked_out' | 'maintenance' = 'in_stock';
        if (params.movementType === 'OUT') newStatus = 'checked_out';
        if (params.movementType === 'RETURN') newStatus = 'in_stock';

        await supabase
          .from('inventory_units')
          .update({ current_status: newStatus })
          .eq('id', params.unitId);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['financial-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['item-movement-timeline', variables.itemId] });

      const typeLabels = {
        IN: 'Entrada registrada com sucesso',
        OUT: 'Saída registrada com sucesso',
        RETURN: 'Devolução registrada com sucesso',
        TRANSFER: 'Transferência registrada com sucesso',
        ADJUST: 'Ajuste registrado com sucesso',
      };
      toast.success(typeLabels[variables.movementType]);
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

/**
 * Hook para estatísticas de movimentação
 */
export function useMovementStats(period: 'day' | 'week' | 'month' = 'month') {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['movement-stats', currentWorkspace?.id, period],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      const { data, error } = await supabase
        .from('inventory_movements')
        .select('movement_type, quantity')
        .eq('workspace_id', currentWorkspace.id)
        .gte('occurred_at', startDate.toISOString());

      if (error) throw error;

      const stats = {
        totalMovements: data.length,
        entries: 0,
        exits: 0,
        returns: 0,
        transfers: 0,
        adjustments: 0,
        totalIn: 0,
        totalOut: 0,
      };

      data.forEach(m => {
        switch (m.movement_type) {
          case 'IN':
            stats.entries++;
            stats.totalIn += m.quantity;
            break;
          case 'OUT':
            stats.exits++;
            stats.totalOut += m.quantity;
            break;
          case 'RETURN':
            stats.returns++;
            stats.totalIn += m.quantity;
            break;
          case 'TRANSFER':
            stats.transfers++;
            break;
          case 'ADJUST':
            stats.adjustments++;
            break;
        }
      });

      return stats;
    },
    enabled: !!currentWorkspace?.id,
  });
}
