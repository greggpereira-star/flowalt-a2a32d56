import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  notify_authentication: boolean;
  notify_workspace: boolean;
  notify_cards: boolean;
  notify_governance: boolean;
  notify_gamification: boolean;
  notify_system: boolean;
  created_at: string;
  updated_at: string;
}

// Categorias de notificação com descrições
export const NOTIFICATION_CATEGORIES = [
  {
    key: 'notify_authentication' as const,
    label: 'Autenticação',
    description: 'Emails sobre confirmação de conta, reset e alteração de senha.',
    icon: '🔐',
    critical: true, // Não pode ser desativado
  },
  {
    key: 'notify_workspace' as const,
    label: 'Workspace',
    description: 'Convites para workspaces, confirmações de aceite e notificações de equipe.',
    icon: '🏢',
    critical: false,
  },
  {
    key: 'notify_cards' as const,
    label: 'Cards & Tarefas',
    description: 'Convites para colaborar em cards, atualizações e remoções.',
    icon: '📋',
    critical: false,
  },
  {
    key: 'notify_governance' as const,
    label: 'Governança',
    description: 'Alterações de função, transferência de propriedade e permissões.',
    icon: '👑',
    critical: false,
  },
  {
    key: 'notify_gamification' as const,
    label: 'Gamificação',
    description: 'Metas concluídas, badges desbloqueadas e subida de nível.',
    icon: '🎮',
    critical: false,
  },
  {
    key: 'notify_system' as const,
    label: 'Sistema',
    description: 'Alertas de cards atrasados, falhas de webhooks e outras notificações do sistema.',
    icon: '⚙️',
    critical: false,
  },
] as const;

export type NotificationCategoryKey = typeof NOTIFICATION_CATEGORIES[number]['key'];

/**
 * Hook para buscar preferências de notificação do usuário
 */
export function useNotificationPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async (): Promise<NotificationPreferences | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as NotificationPreferences | null;
    },
    enabled: !!user?.id,
  });
}

/**
 * Hook para atualizar preferências de notificação
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Verificar se já existe registro
      const { data: existing } = await supabase
        .from('user_notification_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('user_notification_preferences')
          .update(preferences)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('user_notification_preferences')
          .insert({
            user_id: user.id,
            ...preferences,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferências salvas');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar preferências');
    },
  });
}

/**
 * Hook para alternar uma categoria específica
 */
export function useToggleNotificationCategory() {
  const { data: preferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  return useMutation({
    mutationFn: async ({ category, enabled }: { category: NotificationCategoryKey; enabled: boolean }) => {
      return updatePreferences.mutateAsync({ [category]: enabled });
    },
  });
}
