import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface CardKit {
  id: string;
  card_id: string;
  item_id: string;
  unit_id?: string;
  quantity_required?: number;
  quantity_checked_out?: number;
  responsible_user_id?: string;
  checkout_date?: string;
  expected_return_date?: string;
  actual_return_date?: string;
  status?: 'pending' | 'checked_out' | 'returned' | 'partial';
  notes?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  item?: any;
  unit?: any;
}

export function useCardKit(cardId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['card-kit', cardId, currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !cardId) return [];

      const { data, error } = await supabase
        .from('card_kits')
        .select('*, item:inventory_items(*), unit:inventory_units(*)')
        .eq('card_id', cardId)
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      return data as CardKit[];
    },
    enabled: !!currentWorkspace?.id && !!cardId,
  });
}

export function useAddItemToCardKit() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (kit: Partial<CardKit>) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');
      if (!kit.card_id || !kit.item_id) throw new Error('Card e Item são obrigatórios');

      const { data, error } = await supabase
        .from('card_kits')
        .insert({
          workspace_id: currentWorkspace.id,
          card_id: kit.card_id,
          item_id: kit.item_id,
          unit_id: kit.unit_id,
          quantity_required: kit.quantity_required || 1,
          responsible_user_id: kit.responsible_user_id,
          expected_return_date: kit.expected_return_date,
          status: 'pending',
          notes: kit.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card-kit', variables.card_id] });
      toast.success('Item adicionado ao kit');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar item: ${error.message}`);
    },
  });
}

export function useCheckoutCardKit() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ kitId, responsibleUserId }: { kitId: string; responsibleUserId: string }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Get kit details
      const { data: kit, error: kitError } = await supabase
        .from('card_kits')
        .select('*')
        .eq('id', kitId)
        .single();

      if (kitError) throw kitError;

      // Update kit status
      const { data, error } = await supabase
        .from('card_kits')
        .update({
          status: 'checked_out',
          checkout_date: new Date().toISOString(),
          responsible_user_id: responsibleUserId,
          quantity_checked_out: kit.quantity_required || 1,
        })
        .eq('id', kitId)
        .select()
        .single();

      if (error) throw error;

      // Create inventory movement (OUT)
      await supabase.from('inventory_movements').insert({
        workspace_id: currentWorkspace.id,
        movement_type: 'OUT',
        item_id: kit.item_id,
        unit_id: kit.unit_id,
        quantity: kit.quantity_required || 1,
        responsible_user_id: responsibleUserId,
        card_id: kit.card_id,
        occurred_at: new Date().toISOString(),
        notes: `Retirada para card`,
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['card-kit', data.card_id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('Retirada confirmada');
    },
    onError: (error: Error) => {
      toast.error(`Erro na retirada: ${error.message}`);
    },
  });
}

export function useReturnCardKit() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ kitId, notes }: { kitId: string; notes?: string }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Get kit details
      const { data: kit, error: kitError } = await supabase
        .from('card_kits')
        .select('*')
        .eq('id', kitId)
        .single();

      if (kitError) throw kitError;

      // Update kit status
      const { data, error } = await supabase
        .from('card_kits')
        .update({
          status: 'returned',
          actual_return_date: new Date().toISOString(),
          notes: notes || kit.notes,
        })
        .eq('id', kitId)
        .select()
        .single();

      if (error) throw error;

      // Create inventory movement (RETURN)
      await supabase.from('inventory_movements').insert({
        workspace_id: currentWorkspace.id,
        movement_type: 'RETURN',
        item_id: kit.item_id,
        unit_id: kit.unit_id,
        quantity: kit.quantity_checked_out || 1,
        responsible_user_id: kit.responsible_user_id,
        card_id: kit.card_id,
        occurred_at: new Date().toISOString(),
        notes: notes || 'Devolução de card',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['card-kit', data.card_id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('Devolução confirmada');
    },
    onError: (error: Error) => {
      toast.error(`Erro na devolução: ${error.message}`);
    },
  });
}

export function useRemoveFromCardKit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (kitId: string) => {
      const { data, error } = await supabase
        .from('card_kits')
        .delete()
        .eq('id', kitId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['card-kit', data.card_id] });
      toast.success('Item removido do kit');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
}

/**
 * Hook para calcular custo total do kit via RPC
 */
export function useCardKitCost(cardId: string) {
  return useQuery({
    queryKey: ['card-kit-cost', cardId],
    queryFn: async () => {
      if (!cardId) return { total_cost: 0, items_count: 0 };

      const { data, error } = await supabase.rpc('calculate_card_kit_cost', {
        p_card_id: cardId,
      });

      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return result as { total_cost: number; items_count: number };
    },
    enabled: !!cardId,
  });
}

/**
 * Hook para resumo financeiro do card via RPC
 */
export function useCardFinancialSummary(cardId: string) {
  return useQuery({
    queryKey: ['card-financial-summary', cardId],
    queryFn: async () => {
      if (!cardId) return null;

      const { data, error } = await supabase.rpc('get_card_financial_summary', {
        p_card_id: cardId,
      });

      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return result as {
        total_income: number;
        total_expenses: number;
        kit_estimated_cost: number;
        movements_count: number;
        transactions_count: number;
      };
    },
    enabled: !!cardId,
  });
}

/**
 * Hook para histórico de movimentos do card
 */
export function useCardMovementsHistory(cardId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['card-movements-history', cardId, currentWorkspace?.id],
    queryFn: async () => {
      if (!cardId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('card_movements_history_view')
        .select('*')
        .eq('card_id', cardId)
        .eq('workspace_id', currentWorkspace.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      return data as Array<{
        card_id: string;
        workspace_id: string;
        entry_id: string;
        entry_type: string;
        estimated_value: number;
        item_name: string;
        quantity: number;
        entry_date: string;
        notes: string | null;
        created_at: string;
      }>;
    },
    enabled: !!cardId && !!currentWorkspace?.id,
  });
}

/**
 * Hook para histórico financeiro (transações) do card
 */
export function useCardFinancialHistory(cardId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['card-financial-history', cardId, currentWorkspace?.id],
    queryFn: async () => {
      if (!cardId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('card_financial_history_view')
        .select('*')
        .eq('card_id', cardId)
        .eq('workspace_id', currentWorkspace.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      return data as Array<{
        card_id: string;
        workspace_id: string;
        entry_id: string;
        entry_type: string;
        amount: number;
        description: string;
        entry_date: string;
        entry_status: string;
        metadata: any;
        created_at: string;
        source_type: string;
      }>;
    },
    enabled: !!cardId && !!currentWorkspace?.id,
  });
}
