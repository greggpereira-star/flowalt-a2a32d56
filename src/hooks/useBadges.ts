import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface Badge {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedAt?: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  workspace_id: string;
  badge_type: string;
  earned_at: string;
}

export const BADGE_DEFINITIONS: Record<string, Omit<Badge, 'id' | 'earnedAt'>> = {
  first_login: {
    type: 'first_login',
    name: 'Primeiro Acesso',
    description: 'Completou o primeiro login na plataforma',
    icon: '🎉',
    color: 'bg-purple-500',
  },
  onboarding_complete: {
    type: 'onboarding_complete',
    name: 'Explorador',
    description: 'Completou o tour de onboarding',
    icon: '🗺️',
    color: 'bg-blue-500',
  },
  first_card: {
    type: 'first_card',
    name: 'Primeiro Card',
    description: 'Criou o primeiro card',
    icon: '📝',
    color: 'bg-green-500',
  },
  time_tracker: {
    type: 'time_tracker',
    name: 'Pontual',
    description: 'Registrou tempo pela primeira vez',
    icon: '⏱️',
    color: 'bg-orange-500',
  },
  collaborator: {
    type: 'collaborator',
    name: 'Colaborador',
    description: 'Adicionou um membro ao card',
    icon: '🤝',
    color: 'bg-pink-500',
  },
  commenter: {
    type: 'commenter',
    name: 'Comunicador',
    description: 'Fez o primeiro comentário',
    icon: '💬',
    color: 'bg-cyan-500',
  },
  checklist_master: {
    type: 'checklist_master',
    name: 'Organizador',
    description: 'Criou uma checklist',
    icon: '✅',
    color: 'bg-teal-500',
  },
  five_cards: {
    type: 'five_cards',
    name: 'Produtivo',
    description: 'Criou 5 cards',
    icon: '🚀',
    color: 'bg-indigo-500',
  },
  ten_hours: {
    type: 'ten_hours',
    name: 'Dedicado',
    description: 'Registrou 10 horas de trabalho',
    icon: '💪',
    color: 'bg-red-500',
  },
  space_creator: {
    type: 'space_creator',
    name: 'Arquiteto',
    description: 'Criou um novo space',
    icon: '🏗️',
    color: 'bg-amber-500',
  },
  birthday_celebrated: {
    type: 'birthday_celebrated',
    name: 'Aniversariante',
    description: 'Celebrou aniversário no FlowAlt',
    icon: '🎂',
    color: 'bg-gradient-to-r from-amber-500 to-pink-500',
  },
  new_year_celebrated: {
    type: 'new_year_celebrated',
    name: 'Ano Novo',
    description: 'Celebrou o Ano Novo no FlowAlt',
    icon: '🎆',
    color: 'bg-gradient-to-r from-blue-600 to-purple-600',
  },
  christmas_celebrated: {
    type: 'christmas_celebrated',
    name: 'Natal',
    description: 'Celebrou o Natal no FlowAlt',
    icon: '🎄',
    color: 'bg-gradient-to-r from-green-600 to-red-600',
  },
  easter_celebrated: {
    type: 'easter_celebrated',
    name: 'Páscoa',
    description: 'Celebrou a Páscoa no FlowAlt',
    icon: '🐰',
    color: 'bg-gradient-to-r from-pink-400 to-purple-400',
  },
};

export function useBadges() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: userBadges = [], isLoading } = useQuery({
    queryKey: ['user-badges', user?.id, currentWorkspace?.id],
    queryFn: async () => {
      if (!user?.id || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      return data as UserBadge[];
    },
    enabled: !!user?.id && !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const earnedBadges: Badge[] = userBadges.map(ub => ({
    id: ub.id,
    ...BADGE_DEFINITIONS[ub.badge_type],
    earnedAt: ub.earned_at,
  })).filter(b => b.name);

  const allBadges: Badge[] = Object.entries(BADGE_DEFINITIONS).map(([type, def]) => {
    const earned = userBadges.find(ub => ub.badge_type === type);
    return {
      id: earned?.id || type,
      ...def,
      earnedAt: earned?.earned_at,
    };
  });

  const earnBadge = useMutation({
    mutationFn: async (badgeType: string) => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('No user or workspace');

      // Check if already earned in local cache
      const existing = userBadges.find(b => b.badge_type === badgeType);
      if (existing) return null;

      const attemptKey = `${user.id}:${currentWorkspace.id}:${badgeType}`;
      if (badgeAttempts.has(attemptKey)) return null;
      badgeAttempts.add(attemptKey);

      // Use upsert with ON CONFLICT to handle race conditions
      const { data, error } = await supabase
        .from('user_badges')
        .upsert(
          {
            user_id: user.id,
            workspace_id: currentWorkspace.id,
            badge_type: badgeType,
          },
          {
            onConflict: 'user_id,workspace_id,badge_type',
            ignoreDuplicates: true,
          }
        )
        .select()
        .maybeSingle();

      if (error) {
        badgeAttempts.delete(attemptKey);
        throw error;
      }

      // Only create notification if we actually inserted a new badge
      if (data) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          workspace_id: currentWorkspace.id,
          type: 'badge_earned',
          title: 'Nova conquista desbloqueada!',
          message: `Você ganhou o badge "${BADGE_DEFINITIONS[badgeType]?.name}"`,
          metadata: { badge_type: badgeType },
        });
      }

      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['user-badges', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      }
    },
  });

  const progress = {
    earned: earnedBadges.length,
    total: Object.keys(BADGE_DEFINITIONS).length,
    percentage: Math.round((earnedBadges.length / Object.keys(BADGE_DEFINITIONS).length) * 100),
  };

  return {
    userBadges,
    earnedBadges,
    allBadges,
    progress,
    isLoading,
    earnBadge,
    hasBadge: (type: string) => userBadges.some(b => b.badge_type === type),
  };
}
