import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface FilterQuery {
  search?: string;
  people?: {
    assignee?: string[];
    involved?: string[];
    checklist_assignee?: string[];
  };
  status?: {
    card_status?: string[];
    blocked_only?: boolean;
    done_only?: boolean;
  };
  time?: {
    due?: 'today' | 'week' | 'overdue' | 'none' | 'range';
    due_from?: string;
    due_to?: string;
    created?: 'today' | 'week' | 'range' | 'any';
    created_from?: string;
    created_to?: string;
  };
  context?: {
    client_id?: string[];
    project_id?: string[];
    space_id?: string[];
    folder_id?: string[];
  };
  priority?: {
    urgency?: ('low' | 'medium' | 'high' | 'critical')[];
  };
  quality?: {
    briefing_pending?: boolean;
    no_checklist?: boolean;
    no_time_entries?: boolean;
  };
  visibility?: {
    only_private?: boolean;
    only_public?: boolean;
  };
}

export interface SortConfig {
  field: 'created_at' | 'due_date' | 'title' | 'urgency';
  direction: 'asc' | 'desc';
}

const DEFAULT_QUERY: FilterQuery = {};
const DEFAULT_SORT: SortConfig = { field: 'created_at', direction: 'desc' };

export function useCardFilters() {
  const { user } = useAuth();
  const [query, setQuery] = useState<FilterQuery>(DEFAULT_QUERY);
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);

  const setFilter = useCallback(<K extends keyof FilterQuery>(
    category: K,
    value: FilterQuery[K]
  ) => {
    setQuery(prev => ({
      ...prev,
      [category]: value
    }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setQuery(prev => ({
      ...prev,
      search: search || undefined
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery(DEFAULT_QUERY);
    setSort(DEFAULT_SORT);
  }, []);

  const hydrateFromSavedView = useCallback((savedQuery: FilterQuery, savedSort?: SortConfig) => {
    setQuery(savedQuery);
    if (savedSort) {
      setSort(savedSort);
    }
  }, []);

  const applyMyTasksPreset = useCallback(() => {
    if (!user?.id) return;
    setQuery({
      people: {
        assignee: [user.id],
        involved: [user.id],
      }
    });
  }, [user?.id]);

  const isDirty = useMemo(() => {
    return JSON.stringify(query) !== JSON.stringify(DEFAULT_QUERY);
  }, [query]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (query.search) count++;
    if (query.people?.assignee?.length) count++;
    if (query.people?.involved?.length) count++;
    if (query.status?.card_status?.length) count++;
    if (query.status?.blocked_only) count++;
    if (query.time?.due) count++;
    if (query.context?.client_id?.length) count++;
    if (query.context?.space_id?.length) count++;
    if (query.context?.folder_id?.length) count++;
    if (query.priority?.urgency?.length) count++;
    if (query.quality?.briefing_pending) count++;
    return count;
  }, [query]);

  return {
    query,
    sort,
    setFilter,
    setSearch,
    setSort,
    clearFilters,
    hydrateFromSavedView,
    applyMyTasksPreset,
    isDirty,
    activeFiltersCount,
  };
}
