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
