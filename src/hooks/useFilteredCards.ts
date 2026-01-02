import { useQuery } from '@tanstack/react-query';
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
          estimated_hours, actual_hours, client_id,
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
        filteredData = filteredData.filter(c => c.owner_id && query.people!.assignee!.includes(c.owner_id));
      }

      if (query.context?.client_id?.length) {
        filteredData = filteredData.filter(c => c.client_id && query.context!.client_id!.includes(c.client_id));
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
