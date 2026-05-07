import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CardHistory {
  id: string;
  card_id: string;
  user_id: string | null;
  action_type: string;
  old_value: any;
  new_value: any;
  field_name: string | null;
  created_at: string;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export const useCardHistory = (cardId: string | undefined) => {
  return useQuery({
    queryKey: ['card-history', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('card_history')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for history entries
      const userIds = Array.from(new Set(data.map(h => h.user_id).filter(Boolean)));
      
      const { data: profiles } = userIds.length > 0 
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
        : { data: [] };

      return data.map(h => ({
        ...h,
        user: profiles?.find(p => p.id === h.user_id)
      })) as CardHistory[];
    },
    enabled: !!cardId,
  });
};
