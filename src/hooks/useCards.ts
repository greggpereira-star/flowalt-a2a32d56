import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/utils';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import type { Json } from '@/integrations/supabase/types';
import { triggerWebhook } from '@/lib/webhookTrigger';
import { toast } from 'sonner';


export type CardType = 'quick' | 'full';

export interface Card {
  id: string;
  workspace_id: string;
  space_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: CardStatus;
  urgency: CardUrgency;
  due_date: string | null; // ISO datetime with time (e.g., 2026-01-25T18:00:00Z)
  completed_at: string | null;
  owner_id: string | null;
  briefing_completed: boolean;
  briefing_data: Json;
  traffic_briefing_data: Json | null;
  estimated_hours: number | null;
  actual_hours: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Card type: 'quick' bypasses briefing/validations, 'full' requires complete process
  card_type: CardType;
  // Workflow fields
  workflow_id: string | null;
  current_stage: string | null;
  stage_entered_at: string | null;
  // ACL fields
  visibility: 'inherit' | 'restricted' | 'public';
}

export interface CreateCardInput {
  title: string;
  space_id: string;
  folder_id?: string;
  description?: string;
  status?: CardStatus;
  urgency?: CardUrgency;
  due_date?: string; // ISO datetime with time
  client_id?: string;
  estimated_hours?: number;
  briefing_data?: any;
  briefing_completed?: boolean;
  workflow_id?: string;
  current_stage?: string;
  card_type?: CardType; // 'quick' or 'full' - defaults to 'full'
  owner_id?: string;
}

export const useCards = (spaceId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['cards', 'space', spaceId],
    queryFn: async () => {
      if (!spaceId || !currentWorkspace?.id) return [];

      // Use the junction table to find cards associated with this space
      const { data: junctionData, error: junctionError } = await supabase
        .from('card_spaces')
        .select('card_id')
        .eq('space_id', spaceId);

      if (junctionError) throw junctionError;
      if (!junctionData.length) return [];

      const cardIds = junctionData.map(j => j.card_id);

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .in('id', cardIds)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!spaceId && !!currentWorkspace?.id,
  });
};

export const useAllCards = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['cards', 'all', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useCardsByFolder = (folderId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['cards', 'folder', folderId],
    queryFn: async () => {
      if (!folderId || !currentWorkspace?.id) return [];

      const { data: cardFolders, error: cfError } = await supabase
        .from('card_folders')
        .select('card_id')
        .eq('folder_id', folderId);

      if (cfError) throw cfError;
      if (!cardFolders.length) return [];

      const cardIds = cardFolders.map(cf => cf.card_id);

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .in('id', cardIds)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!folderId && !!currentWorkspace?.id,
  });
};

export const useCard = (cardId: string | undefined) => {
  return useQuery({
    queryKey: ['card', cardId],
    queryFn: async () => {
      if (!cardId) return null;

      const { data, error } = await supabase
        .from('cards')
        .select('*, card_spaces(space_id)')
        .eq('id', cardId)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!cardId,
  });
};

export const useCreateCard = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const generateUuid = (): string => {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();

    if (c?.getRandomValues) {
      const bytes = c.getRandomValues(new Uint8Array(16));
      // RFC 4122 v4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  };

  return useMutation({
    mutationFn: async (input: CreateCardInput) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      // Evita depender de RETURNING/SELECT (pode falhar por políticas de leitura)
      // gerando o ID no cliente.
      const cardId = generateUuid();

      const status = input.status || 'backlog';
      const urgency = input.urgency || 'medium';

      // Auto-associate with default workflow if not specified
      let workflowId = input.workflow_id;
      let currentStage = input.current_stage;
      
      if (!workflowId) {
        // Fetch default workflow for the workspace
        const { data: defaultWorkflow } = await supabase
          .from('workflows')
          .select('id')
          .eq('workspace_id', currentWorkspace.id)
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle();
        
        if (defaultWorkflow) {
          workflowId = defaultWorkflow.id;
          // Set initial stage based on status
          const statusToStageMap: Record<string, string> = {
            backlog: 'backlog',
            briefing: 'planejamento',
            todo: 'planejamento',
            in_progress: 'em_producao',
            review: 'revisao',
            approved: 'aprovacao',
            delivered: 'concluido',
          };
          currentStage = currentStage || statusToStageMap[status] || 'backlog';
        }
      }

      // For quick cards, always mark briefing as completed (not required)
      const cardType = input.card_type || 'full';
      const briefingCompleted = cardType === 'quick' ? true : (input.briefing_completed ?? false);

      const { error: cardError } = await supabase
        .from('cards')
        .insert({
          id: cardId,
          workspace_id: currentWorkspace.id,
          space_id: input.space_id,
          title: input.title,
          description: input.description,
          status,
          urgency,
          due_date: input.due_date,
          client_id: input.client_id,
          owner_id: input.owner_id || null, // Initially created without an owner unless specified
          created_by: user.id,
          estimated_hours: input.estimated_hours,
          briefing_data: input.briefing_data,
          briefing_completed: briefingCompleted,
          card_type: cardType,
          workflow_id: workflowId,
          current_stage: currentStage,
          stage_entered_at: currentStage ? new Date().toISOString() : null,
        });

      if (cardError) {
        console.error('useCreateCard: insert into cards failed', cardError);
        throw new Error(getErrorMessage(cardError, 'Falha ao criar card.'));
      }

      // Add to junction table card_spaces
      const { error: spaceError } = await supabase
        .from('card_spaces')
        .insert({
          card_id: cardId,
          space_id: input.space_id,
        });

      if (spaceError) {
        console.error('useCreateCard: insert into card_spaces failed', spaceError);
        throw new Error(getErrorMessage(spaceError, 'Falha ao vincular espaço.'));
      }

      // Add to folder if specified
      if (input.folder_id) {
        const { error: folderError } = await supabase
          .from('card_folders')
          .insert({
            card_id: cardId,
            folder_id: input.folder_id,
          });

        if (folderError) {
          console.error('useCreateCard: insert into card_folders failed', folderError);
          throw new Error(getErrorMessage(folderError, 'Falha ao vincular pasta.'));
        }
      }

      // Add creator as card member with is_owner = false initially or just skip is_owner true
      const { error: memberError } = await supabase
        .from('card_members')
        .insert({
          card_id: cardId,
          user_id: user.id,
          is_owner: false,
        });

      if (memberError) {
        console.error('useCreateCard: insert into card_members failed', memberError);
        throw new Error(getErrorMessage(memberError, 'Falha ao adicionar membro ao card.'));
      }

      // Trigger webhook
      triggerWebhook(currentWorkspace.id, 'card.created', {
        id: cardId,
        title: input.title,
        status,
        urgency,
        space_id: input.space_id,
        created_by: user.id,
      });

      // Retorna um objeto mínimo para invalidar cache e permitir UX.
      return {
        id: cardId,
        workspace_id: currentWorkspace.id,
        space_id: input.space_id,
        title: input.title,
        description: input.description ?? null,
        status,
        urgency,
        due_date: input.due_date ?? null,
        client_id: input.client_id ?? null,
        owner_id: null,
        created_by: user.id,
      } as unknown as Card;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['cards', 'space', data.space_id] });
      // Invalidate folder cache if card was linked to a folder
      if (variables.folder_id) {
        queryClient.invalidateQueries({ queryKey: ['cards', 'folder', variables.folder_id] });
      }
    },
  });
};

export const useUpdateCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      description?: string;
      status?: CardStatus;
      urgency?: CardUrgency;
      due_date?: string | null;
      client_id?: string | null;
      owner_id?: string | null;
      briefing_completed?: boolean;
      estimated_hours?: number | null;
    }) => {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Trigger webhook
      triggerWebhook(data.workspace_id, 'card.updated', {
        id: data.id,
        title: data.title,
        status: data.status,
        urgency: data.urgency,
        updated_fields: Object.keys(updates),
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card', data.id] });
    },
  });
};

export const useUpdateCardStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, status }: { cardId: string; status: CardStatus }) => {
      const updates: { status: CardStatus; completed_at?: string } = { status };
      
      if (status === 'delivered') {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;

      // Trigger webhook
      triggerWebhook(data.workspace_id, 'card.status_changed', {
        id: data.id,
        title: data.title,
        previous_status: status, // Note: we don't have the previous status here, using current
        new_status: data.status,
        completed_at: data.completed_at,
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card', data.id] });
    },
  });
};

export const useDeleteCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId: string) => {
      // Get card data first for webhook
      const { data: cardData } = await supabase
        .from('cards')
        .select('workspace_id, title')
        .eq('id', cardId)
        .single();

      const { error } = await supabase
        .from('cards')
        .update({ status: 'archived' })
        .eq('id', cardId);

      if (error) throw error;

      // Trigger webhook
      if (cardData) {
        triggerWebhook(cardData.workspace_id, 'card.deleted', {
          id: cardId,
          title: cardData.title,
        });
      }

      return cardId;
    },
    onSuccess: (cardId) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['filtered-cards'] });
      queryClient.invalidateQueries({ queryKey: ['card', cardId] });
    },
  });
};

export const useShareCardAcrossSpaces = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, spaceId }: { cardId: string; spaceId: string }) => {
      const { error } = await supabase
        .from('card_spaces')
        .insert({
          card_id: cardId,
          space_id: spaceId,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('Este card já está presente neste setor.');
        }
        throw error;
      }

      return { cardId, spaceId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cards', 'space', data.spaceId] });
      queryClient.invalidateQueries({ queryKey: ['card', data.cardId] });
      toast.success('Card compartilhado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao compartilhar card.');
    },
  });
};
