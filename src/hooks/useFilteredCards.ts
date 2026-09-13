import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { FilterQuery, SortConfig } from './useCardFilters';

export interface FilteredCard {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  due_date: string | null;
  created_at: string;
  owner_id: string | null;
  created_by: string | null;
  space_id: string;
  space_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  client_id: string | null;
  client_name: string | null;
  visibility: string | null;
  briefing_completed: boolean | null;
  estimated_hours: number | null;
  actual_hours: number | null;
}

interface UseFilteredCardsParams {
  scopeType: 'space' | 'folder' | 'global';
  scopeId?: string;
  query: FilterQuery;
  sort: SortConfig;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useFilteredCards({
  scopeType,
  scopeId,
  query,
  sort,
  limit = 50,
  offset = 0,
  enabled = true,
}: UseFilteredCardsParams) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['filtered-cards', currentWorkspace?.id, scopeType, scopeId, query, sort, limit, offset],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { cards: [], total: 0 };

      // Use direct query instead of RPC since types may not be updated
      const { data, error } = await supabase
        .from('cards')
        .select(`
          id, title, description, status, urgency, due_date, created_at,
          owner_id, created_by, space_id, visibility, briefing_completed,
          estimated_hours, actual_hours, client_id, completed_at,
          spaces:space_id(name),
          client_cards:client_id(name)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived')
        .order(sort.field, { ascending: sort.direction === 'asc' })
        .limit(limit);

      if (error) {
        console.error('Error fetching filtered cards:', error);
        throw error;
      }

      // Apply client-side filters
      let filteredData = data || [];

      if (query.search) {
        const search = query.search.toLowerCase();
        filteredData = filteredData.filter(c => 
          c.title?.toLowerCase().includes(search) ||
          c.description?.toLowerCase().includes(search)
        );
      }

      if (query.status?.card_status?.length) {
        filteredData = filteredData.filter(c => query.status!.card_status!.includes(c.status));
      }

      if (query.priority?.urgency?.length) {
        filteredData = filteredData.filter(c => query.priority!.urgency!.includes(c.urgency as any));
      }

      if (query.people?.assignee?.length) {
        // A atribuição de responsável vive em `card_members`; `cards.owner_id`
        // é campo legado e está VAZIO na maioria dos cards (206 de 302), porque
        // atribuir alguém grava só no vínculo. Filtrar apenas por owner_id
        // escondia dois terços do trabalho ativo: 21 cards apareciam de 63 que
        // realmente têm responsável.
        const { data: memberRows } = await supabase
          .from('card_members')
          .select('card_id')
          .in('user_id', query.people.assignee)
          .in('card_id', filteredData.map((c) => c.id));

        const cardIdsComResponsavel = new Set((memberRows ?? []).map((r) => r.card_id));

        filteredData = filteredData.filter(
          (c) =>
            cardIdsComResponsavel.has(c.id) ||
            // owner_id ainda vale para os cards antigos que o têm preenchido.
            (c.owner_id && query.people!.assignee!.includes(c.owner_id)),
        );
      }

      if (query.context?.client_id?.length) {
        filteredData = filteredData.filter(c => c.client_id && query.context!.client_id!.includes(c.client_id));
      }

      // Os filtros abaixo existiam na UI (e contavam como "filtro ativo"),
      // mas não eram aplicados em lugar nenhum: selecionar "Prazo: Atrasado"
      // mostrava o chip e devolvia a lista inteira.
      const hoje = new Date();

      if (query.time?.due) {
        filteredData = filteredData.filter(c => {
          if (query.time!.due === 'none') return !c.due_date;
          if (!c.due_date) return false;

          const venc = new Date(c.due_date);
          switch (query.time!.due) {
            case 'today':
              return venc >= startOfDay(hoje) && venc <= endOfDay(hoje);
            case 'week':
              return venc >= startOfWeek(hoje, { weekStartsOn: 1 })
                && venc <= endOfWeek(hoje, { weekStartsOn: 1 });
            case 'overdue':
              // Só conta como atrasado a partir do dia seguinte ao vencimento.
              return startOfDay(venc) < startOfDay(hoje);
            case 'range': {
              const de = query.time!.due_from ? startOfDay(new Date(query.time!.due_from)) : null;
              const ate = query.time!.due_to ? endOfDay(new Date(query.time!.due_to)) : null;
              if (de && venc < de) return false;
              if (ate && venc > ate) return false;
              return true;
            }
            default:
              return true;
          }
        });
      }

      if (query.time?.created) {
        filteredData = filteredData.filter(c => {
          if (!c.created_at) return false;
          const criado = new Date(c.created_at);
          switch (query.time!.created) {
            case 'today':
              return criado >= startOfDay(hoje) && criado <= endOfDay(hoje);
            case 'week':
              return criado >= startOfWeek(hoje, { weekStartsOn: 1 })
                && criado <= endOfWeek(hoje, { weekStartsOn: 1 });
            case 'range': {
              const de = query.time!.created_from ? startOfDay(new Date(query.time!.created_from)) : null;
              const ate = query.time!.created_to ? endOfDay(new Date(query.time!.created_to)) : null;
              if (de && criado < de) return false;
              if (ate && criado > ate) return false;
              return true;
            }
            default:
              return true;
          }
        });
      }

      // "Bloqueado" não é status: é ter uma dependência aberta.
      //
      // Antes isto comparava `status === 'blocked'`, valor que não existe no
      // enum do banco. A caixa "Apenas bloqueados" sempre esvaziava a lista, e
      // quem marcasse concluiria que nada está travado — quando na verdade a
      // pergunta nunca chegou a ser feita. Agora ela é feita contra a tabela
      // `dependencies`, que é onde o bloqueio realmente mora.
      //
      // Um card está bloqueado quando algo de que ele depende ainda não foi
      // entregue. Dependência já concluída não bloqueia mais nada.
      if (query.status?.blocked_only) {
        const { data: dependencias } = await supabase
          .from('dependencies')
          .select('dependent_card_id, blocking_card_id')
          .eq('workspace_id', currentWorkspace.id)
          .not('dependent_card_id', 'is', null);

        const idsBloqueadores = [
          ...new Set((dependencias ?? []).map(d => d.blocking_card_id).filter(Boolean)),
        ] as string[];

        const concluidos = new Set<string>();
        if (idsBloqueadores.length > 0) {
          const { data: bloqueadores } = await supabase
            .from('cards')
            .select('id, status, completed_at')
            .in('id', idsBloqueadores);

          (bloqueadores ?? []).forEach(b => {
            if (b.completed_at || b.status === 'delivered' || b.status === 'archived') {
              concluidos.add(b.id);
            }
          });
        }

        const cardsBloqueados = new Set(
          (dependencias ?? [])
            .filter(d => d.blocking_card_id && !concluidos.has(d.blocking_card_id))
            .map(d => d.dependent_card_id as string),
        );

        filteredData = filteredData.filter(c => cardsBloqueados.has(c.id));
      }

      if (query.status?.done_only) {
        filteredData = filteredData.filter(c => !!c.completed_at || c.status === 'delivered');
      }

      if (query.quality?.briefing_pending) {
        filteredData = filteredData.filter(c => c.briefing_completed !== true);
      }

      // "Sem checklist" precisa de outra tabela. A consulta só acontece quando
      // o filtro está ligado, e é uma só para todos os cards da página.
      if (query.quality?.no_checklist && filteredData.length > 0) {
        const { data: comChecklist } = await supabase
          .from('checklists')
          .select('card_id')
          .in('card_id', filteredData.map(c => c.id));

        const idsComChecklist = new Set((comChecklist ?? []).map(r => r.card_id));
        filteredData = filteredData.filter(c => !idsComChecklist.has(c.id));
      }

      if (query.visibility?.only_private) {
        filteredData = filteredData.filter(c => c.visibility === 'private' || c.visibility === 'restricted');
      }

      if (query.visibility?.only_public) {
        filteredData = filteredData.filter(c => c.visibility === 'public');
      }

      if (scopeType === 'space' && scopeId) {
        filteredData = filteredData.filter(c => c.space_id === scopeId);
      }

      const cards: FilteredCard[] = filteredData.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        urgency: c.urgency,
        due_date: c.due_date,
        created_at: c.created_at,
        owner_id: c.owner_id,
        created_by: c.created_by,
        space_id: c.space_id,
        space_name: (c.spaces as any)?.name || null,
        folder_id: null,
        folder_name: null,
        client_id: c.client_id,
        client_name: (c.client_cards as any)?.name || null,
        visibility: c.visibility,
        briefing_completed: c.briefing_completed,
        estimated_hours: c.estimated_hours,
        actual_hours: c.actual_hours,
      }));

      return { cards, total: cards.length };
    },
    enabled: enabled && !!currentWorkspace?.id,
    staleTime: 30000,
  });
}
