import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLogWriter } from './useObservability';
import { getErrorMessage, generateId } from '@/lib/utils';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import type { Json } from '@/integrations/supabase/types';
import { triggerWebhook } from '@/lib/webhookTrigger';
import { toast } from 'sonner';


export type CardType = 'quick' | 'full';

export interface Card {
  id: string;
  workspace_id: string;
  space_id: string;
  display_space_id?: string; // Virtual field for UI logic
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
  duplicate_to_space_id?: string; // Add this to handle duplication atomically
  duplication_mode?: 'mirror' | 'copy'; // mirror = share same card across spaces; copy = independent card in target space
}

export const useCards = (spaceId: string | undefined) => {
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;

  return useQuery({
    queryKey: ['cards', 'space', spaceId],
    queryFn: async () => {
      if (!spaceId || !currentWorkspace?.id) return [];

      console.log(`[useCards] Fetching cards for space: ${spaceId}`);

      // Query cards using a join with card_spaces for maximum reliability
      // Note: We use the join to find which cards belong to this space.
      // But the card itself also has a 'space_id' field which usually points to its "primary" space.
      const { data, error } = await supabase
        .from('cards')
        .select(`
          *,
          card_spaces!inner(space_id),
          card_custom_fields(field_key, field_value)
        `)
        .eq('card_spaces.space_id', spaceId)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('[useCards] Error fetching cards:', error);
        throw error;
      }

      // Ensure each card returned has the spaceId we're looking for, 
      // even if its internal space_id differs (due to sharing/mirroring)
      const mappedData = data?.map(card => {
        const customFields = ((card as any).card_custom_fields || []).reduce(
          (acc: Record<string, string | null>, field: { field_key: string; field_value: string | null }) => {
            acc[field.field_key] = field.field_value;
            return acc;
          },
          {}
        );

        const { card_custom_fields, ...cardData } = card as any;

        return {
          ...cardData,
          custom_fields: customFields,
          display_space_id: spaceId // Virtual field for UI logic
        };
      }) || [];

      console.log(`[useCards] Found ${mappedData.length} cards for space ${spaceId}`);
      return mappedData as Card[];
    },
    enabled: !!spaceId && !!currentWorkspace?.id,
  });
};

export const useAllCards = () => {
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;

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
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;

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
        .select('*, card_custom_fields(field_key, field_value)')
        .in('id', cardIds)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []).map(card => {
        const customFields = ((card as any).card_custom_fields || []).reduce(
          (acc: Record<string, string | null>, field: { field_key: string; field_value: string | null }) => {
            acc[field.field_key] = field.field_value;
            return acc;
          },
          {}
        );

        const { card_custom_fields, ...cardData } = card as any;
        return { ...cardData, custom_fields: customFields };
      }) as Card[];
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

export const useCreateCard = (currentSpaceId?: string) => {
  const queryClient = useQueryClient();
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;
  const { user } = useAuth();
  const { info, error: logError } = useLogWriter();

  return useMutation({
    mutationFn: async (input: CreateCardInput) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      // "Copy" mode: create an independent card directly in the target space,
      // skipping the mirror (card_spaces) linking that "mirror" mode uses.
      if (input.duplicate_to_space_id && input.duplication_mode === 'copy') {
        input = {
          ...input,
          space_id: input.duplicate_to_space_id,
          folder_id: undefined, // folder belongs to source space; let user re-file if needed
          duplicate_to_space_id: undefined,
          duplication_mode: undefined,
        };
      }

      // Evita depender de RETURNING/SELECT (pode falhar por políticas de leitura)
      // gerando o ID no cliente.
      const cardId = generateId();

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
        logError('cards-hook', 'Falha ao inserir card na tabela cards', { 
          cardId, 
          workspaceId: currentWorkspace.id,
          error: cardError 
        });
        throw new Error(getErrorMessage(cardError, 'Falha ao criar card.'));
      }

      await info('cards-hook', 'Card criado com sucesso', { cardId, title: input.title, spaceId: input.space_id });

      // Add to junction table card_spaces
      const { error: spaceError } = await supabase
        .from('card_spaces')
        .insert({
          card_id: cardId,
          space_id: input.space_id,
        });

      if (spaceError) {
        console.error('useCreateCard: insert into card_spaces failed', spaceError);
        logError('cards-hook', 'Falha ao vincular card ao espaço primário', { 
          cardId, 
          spaceId: input.space_id, 
          error: spaceError 
        });
        throw new Error(getErrorMessage(spaceError, 'Falha ao vincular espaço.'));
      }

      await info('cards-hook', 'Vínculo card_spaces criado para espaço primário', { cardId, spaceId: input.space_id });

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
          logError('cards-hook', 'Falha ao vincular card à pasta primária', { 
            cardId, 
            folderId: input.folder_id, 
            error: folderError 
          });
          throw new Error(getErrorMessage(folderError, 'Falha ao vincular pasta.'));
        }

        await info('cards-hook', 'Vínculo card_folders criado para pasta primária', { cardId, folderId: input.folder_id });
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

      // Handle atomic mirror duplication if requested (server-side RPC bypasses
      // per-space/folder ACL so the mirrored card is always visible in the target space).
      if (input.duplicate_to_space_id) {
        const targetSpaceId = input.duplicate_to_space_id;
        console.log(`[useCreateCard] Mirroring card ${cardId} to space ${targetSpaceId}`);
        await info('cards-hook', 'Iniciando espelhamento via RPC', { cardId, targetSpaceId });

        const { error: mirrorError } = await supabase.rpc('mirror_card_to_space', {
          _card_id: cardId,
          _target_space_id: targetSpaceId,
        });

        if (mirrorError) {
          console.error('[useCreateCard] mirror_card_to_space failed:', mirrorError);
          logError('cards-hook', 'Falha no espelhamento (RPC)', { cardId, targetSpaceId, error: mirrorError });
          throw new Error(getErrorMessage(mirrorError, 'Falha ao espelhar card no espaço destino.'));
        }

        await info('cards-hook', 'Espelhamento concluído', { cardId, targetSpaceId });
      }

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
      // Step 1: Invalidate and refetch all active card lists
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      
      // Step 2: Specifically target the spaces involved
      if (variables.space_id) {
        queryClient.invalidateQueries({ queryKey: ['cards', 'space', variables.space_id] });
      }

      if (variables.duplicate_to_space_id) {
        queryClient.invalidateQueries({ queryKey: ['cards', 'space', variables.duplicate_to_space_id] });
      }

      // Step 3: If we have the current space from the hook parameter, refresh it too
      if (currentSpaceId && currentSpaceId !== variables.space_id && currentSpaceId !== variables.duplicate_to_space_id) {
        queryClient.invalidateQueries({ queryKey: ['cards', 'space', currentSpaceId] });
      }

      // Step 4: Force refetch of all active space boards to ensure the UI updates everywhere
      queryClient.refetchQueries({ 
        queryKey: ['cards', 'space'],
        type: 'active'
      });

      if (variables.folder_id) {
        queryClient.invalidateQueries({ queryKey: ['cards', 'folder', variables.folder_id] });
      }
    },
  });
};

/**
 * Espelha um card EXISTENTE em outro espaço (sincronizado).
 *
 * Diferente de useCreateCard com duplicate_to_space_id, este hook NÃO cria um
 * novo card: ele apenas vincula o próprio card (mesma linha em `cards`) ao
 * espaço destino via a RPC `mirror_card_to_space`. Assim o card aparece nos
 * dois espaços e qualquer edição é vista por ambos (é a mesma linha).
 */
export const useMirrorCardToSpace = (currentSpaceId?: string) => {
  const queryClient = useQueryClient();
  const { info, error: logError } = useLogWriter();

  return useMutation({
    mutationFn: async ({ cardId, targetSpaceId }: { cardId: string; targetSpaceId: string }) => {
      await info('cards-hook', 'Espelhando card existente via RPC', { cardId, targetSpaceId });

      const { error: mirrorError } = await supabase.rpc('mirror_card_to_space', {
        _card_id: cardId,
        _target_space_id: targetSpaceId,
      });

      if (mirrorError) {
        console.error('[useMirrorCardToSpace] mirror_card_to_space failed:', mirrorError);
        logError('cards-hook', 'Falha ao espelhar card existente (RPC)', { cardId, targetSpaceId, error: mirrorError });
        throw new Error(getErrorMessage(mirrorError, 'Falha ao espelhar card no espaço destino.'));
      }

      await info('cards-hook', 'Espelhamento de card existente concluído', { cardId, targetSpaceId });
      return { cardId, targetSpaceId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['cards', 'space', variables.targetSpaceId] });
      if (currentSpaceId) {
        queryClient.invalidateQueries({ queryKey: ['cards', 'space', currentSpaceId] });
      }
      queryClient.refetchQueries({ queryKey: ['cards', 'space'], type: 'active' });
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
      start_date?: string | null;
      due_date?: string | null;
      client_id?: string | null;
      owner_id?: string | null;
      briefing_completed?: boolean;
      briefing_data?: any;
      traffic_briefing_data?: any;
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
      console.log(`[useShareCardAcrossSpaces] Starting share for cardId: ${cardId}, spaceId: ${spaceId}`);
      
      try {
        // Link the card to the new space
        const { error: insertError } = await supabase
          .from('card_spaces')
          .insert({
            card_id: cardId,
            space_id: spaceId,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            console.log(`[useShareCardAcrossSpaces] Card ${cardId} already exists in space ${spaceId}`);
            return { cardId, spaceId }; // Not an error if already shared
          }
          throw insertError;
        }

        // Verification check: ensure the record actually exists
        const { data: verifyData, error: verifyError } = await supabase
          .from('card_spaces')
          .select('id')
          .eq('card_id', cardId)
          .eq('space_id', spaceId)
          .maybeSingle();

        if (verifyError || !verifyData) {
          console.error(`[useShareCardAcrossSpaces] Verification failed for card ${cardId} in space ${spaceId}`);
          throw new Error('Falha na verificação de vínculo do card com o setor de destino.');
        }

        console.log(`[useShareCardAcrossSpaces] Success and Verified: Card ${cardId} linked to space ${spaceId}`);

        // Step 2: Mirro folder mapping if applicable
        const { data: currentMappings } = await supabase
          .from('card_folders')
          .select('folder_id, folders(name, icon, color, description, workspace_id)')
          .eq('card_id', cardId);

        if (currentMappings && currentMappings.length > 0) {
          for (const mapping of currentMappings) {
            const sourceFolder = mapping.folders as any;
            if (!sourceFolder) continue;

            // Try to find a folder with same name in the target space
            let { data: targetFolder } = await supabase
              .from('folders')
              .select('id')
              .eq('space_id', spaceId)
              .eq('name', sourceFolder.name)
              .eq('is_archived', false)
              .maybeSingle();

            // If not exists, create it
            if (!targetFolder) {
              const { data: newFolder, error: createError } = await supabase
                .from('folders')
                .insert({
                  workspace_id: sourceFolder.workspace_id,
                  space_id: spaceId,
                  name: sourceFolder.name,
                  icon: sourceFolder.icon,
                  color: sourceFolder.color,
                  description: sourceFolder.description
                })
                .select('id')
                .single();
              
              if (!createError) targetFolder = newFolder;
            }

            if (targetFolder) {
              await supabase
                .from('card_folders')
                .insert({
                  card_id: cardId,
                  folder_id: targetFolder.id
                });

              // ENHANCEMENT: Also link to the primary folder of the target space for visibility
              const { data: primaryFolders } = await supabase
                .from('folders')
                .select('id, name')
                .eq('space_id', spaceId)
                .eq('is_archived', false)
                .neq('id', targetFolder.id)
                .order('sort_order', { ascending: true })
                .limit(1);

              if (primaryFolders && primaryFolders.length > 0) {
                await supabase
                  .from('card_folders')
                  .insert({
                    card_id: cardId,
                    folder_id: primaryFolders[0].id
                  });
              }
            }
          }
        }

        return { cardId, spaceId };
      } catch (err: any) {
        console.error(`[useShareCardAcrossSpaces] Mutation failed:`, err);
        throw err;
      }
    },
    onSuccess: (data) => {
      // Step 1: Invalidate the general cards key
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      
      // Step 2: Force refetch of all space boards to ensure the duplicated card appears
      // We use refetch instead of just invalidate to trigger an immediate network request
      queryClient.refetchQueries({ 
        queryKey: ['cards', 'space'],
        type: 'active'
      });

      // Step 3: Specifically invalidate the target space and the single card
      queryClient.invalidateQueries({ queryKey: ['cards', 'space', data.spaceId] });
      queryClient.invalidateQueries({ queryKey: ['card', data.cardId] });
      
      toast.success('Card compartilhado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao compartilhar card.');
    },
  });
};
