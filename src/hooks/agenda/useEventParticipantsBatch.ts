import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventParticipantAvatar {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * Participantes (com foto) de vários eventos de uma vez.
 *
 * Duas decisões que evitam armadilhas já conhecidas nesta base:
 *
 * 1. Sem embed `profiles:user_id(...)`. As chaves estrangeiras de user_id
 *    apontam para `auth.users`, não para `public.profiles`, então o PostgREST
 *    não enxerga a relação e responde PGRST200. O nome e a foto vêm de uma
 *    segunda consulta, casada em memória.
 *
 * 2. Uma consulta para todos os eventos da tela, não uma por evento. Com 84
 *    eventos e média de 2,4 participantes, buscar por evento significaria 84
 *    idas ao servidor só para desenhar avatares.
 */
export function useEventParticipantsBatch(eventIds: string[]) {
  const idsKey = [...eventIds].sort().join(',');

  return useQuery({
    queryKey: ['event-participants-batch', idsKey],
    enabled: eventIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, EventParticipantAvatar[]>> => {
      const { data: rows, error } = await supabase
        .from('event_participants')
        .select('event_id, user_id')
        .in('event_id', eventIds);

      if (error) throw error;
      if (!rows || rows.length === 0) return {};

      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileById = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          {
            userId: p.id,
            fullName: p.full_name ?? 'Participante',
            avatarUrl: p.avatar_url ?? null,
          } as EventParticipantAvatar,
        ]),
      );

      return rows.reduce<Record<string, EventParticipantAvatar[]>>((acc, row) => {
        const person = row.user_id ? profileById.get(row.user_id) : undefined;
        if (!person) return acc;
        acc[row.event_id] = [...(acc[row.event_id] ?? []), person];
        return acc;
      }, {});
    },
  });
}
