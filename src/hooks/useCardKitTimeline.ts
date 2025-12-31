import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CardKitTimelineEntry {
  id: string;
  type: 'kit_added' | 'checkout' | 'return' | 'removed' | 'maintenance';
  timestamp: string;
  itemName: string;
  unitSerial?: string;
  quantity?: number;
  userName?: string;
  notes?: string;
}

export function useCardKitTimeline(cardId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['card-kit-timeline', cardId, currentWorkspace?.id],
    queryFn: async (): Promise<CardKitTimelineEntry[]> => {
      if (!currentWorkspace?.id || !cardId) return [];

      // Fetch movements for this card
      const { data: movements, error } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          movement_type,
          occurred_at,
          quantity,
          notes,
          item:inventory_items(name, code),
          unit:inventory_units(serial_number),
          responsible_user_id
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('card_id', cardId)
        .order('occurred_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set(movements?.map(m => m.responsible_user_id).filter(Boolean))] as string[];
      let profiles: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        profilesData?.forEach(p => {
          profiles[p.id] = p.full_name || 'Usuário';
        });
      }

      // Map to timeline entries
      const timeline: CardKitTimelineEntry[] = (movements || []).map(m => {
        let type: CardKitTimelineEntry['type'] = 'kit_added';
        if (m.movement_type === 'OUT') type = 'checkout';
        if (m.movement_type === 'RETURN') type = 'return';

        return {
          id: m.id,
          type,
          timestamp: m.occurred_at,
          itemName: (m.item as any)?.name || 'Item',
          unitSerial: (m.unit as any)?.serial_number,
          quantity: m.quantity,
          userName: m.responsible_user_id ? profiles[m.responsible_user_id] : undefined,
          notes: m.notes,
        };
      });

      return timeline;
    },
    enabled: !!currentWorkspace?.id && !!cardId,
  });
}
