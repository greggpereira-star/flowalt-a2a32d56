import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CardMember {
  id: string;
  card_id: string;
  user_id: string;
  is_owner: boolean | null;
  can_view: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
  function_title: string | null;
  hourly_rate: number | null;
  created_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export const useCardMembers = (cardId: string | undefined) => {
  return useQuery({
    queryKey: ['card_members', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('card_members')
        .select('*')
        .eq('card_id', cardId);

      if (error) throw error;

      // Get profiles for all members
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(member => ({
        ...member,
        profile: profileMap.get(member.user_id),
      })) as CardMember[];
    },
    enabled: !!cardId,
  });
};

export const useAddCardMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, userId }: { cardId: string; userId: string }) => {
      // Check if already a member
      const { data: existing } = await supabase
        .from('card_members')
        .select('id')
        .eq('card_id', cardId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        throw new Error('Usuário já é membro deste card');
      }

      const { data, error } = await supabase
        .from('card_members')
        .insert({
          card_id: cardId,
          user_id: userId,
          is_owner: false,
          can_view: true,
          can_edit: true,
          can_delete: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Avisa quem foi marcado.
      //
      // Até aqui, ser adicionado como responsável não gerava notificação
      // alguma: o card mudava de dono e a pessoa só descobria se alguém
      // avisasse por fora. As notificações de "assignment" que existiam vinham
      // apenas de menção em comentário (useComments), nunca da atribuição em si.
      //
      // Falhar em notificar não pode desfazer a atribuição, que já foi gravada
      // com sucesso — por isso o erro aqui é registrado, e não propagado.
      try {
        const { data: authData } = await supabase.auth.getUser();
        const actorId = authData?.user?.id;

        // Quem se adiciona sozinho não precisa ser avisado.
        if (actorId && actorId !== userId) {
          const { data: card } = await supabase
            .from('cards')
            .select('title, workspace_id, space_id')
            .eq('id', cardId)
            .maybeSingle();

          if (card?.workspace_id) {
            const { data: actor } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', actorId)
              .maybeSingle();

            const actorName = actor?.full_name ?? 'Alguém';

            await supabase.from('notifications').insert({
              user_id: userId,
              workspace_id: card.workspace_id,
              type: 'assignment',
              title: 'Você foi adicionado a um card',
              message: `${actorName} adicionou você em "${card.title}"`,
              // O space_id aqui é uma dica: a navegação valida esse valor
              // contra os vínculos reais antes de abrir (resolveCardSpaceId).
              metadata: { card_id: cardId, space_id: card.space_id },
            });
          }
        }
      } catch (notifyError) {
        console.error('Responsável adicionado, mas a notificação falhou:', notifyError);
      }

      return data;
    },
    onSuccess: (_, { cardId }) => {
      queryClient.invalidateQueries({ queryKey: ['card_members', cardId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Responsável adicionado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar responsável');
    },
  });
};

export const useRemoveCardMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, memberId }: { cardId: string; memberId: string }) => {
      const { error } = await supabase
        .from('card_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      return { cardId, memberId };
    },
    onSuccess: ({ cardId }) => {
      queryClient.invalidateQueries({ queryKey: ['card_members', cardId] });
      toast.success('Responsável removido');
    },
    onError: () => {
      toast.error('Erro ao remover responsável');
    },
  });
};
