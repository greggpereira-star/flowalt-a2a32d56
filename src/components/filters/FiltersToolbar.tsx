import React from 'react';
import { FiltersPanel } from './FiltersPanel';
import { SavedViewsBar } from './SavedViewsBar';
import { ActiveFiltersChips } from './ActiveFiltersChips';
import { useCardFilters, type FilterQuery } from '@/hooks/useCardFilters';
import { useSavedViews } from '@/hooks/useSavedViews';

interface FiltersToolbarProps {
  scopeType: 'space' | 'folder' | 'global';
  scopeId?: string;
  onFiltersChange: (query: FilterQuery) => void;
  className?: string;
}

export const FiltersToolbar: React.FC<FiltersToolbarProps> = ({
  scopeType,
  scopeId,
  onFiltersChange,
  className,
}) => {
  const {
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
  } = useCardFilters();

  const {
    views,
    createView,
    deleteView,
    setDefault,
    isLoading: viewsLoading,
  } = useSavedViews({ scopeType, scopeId });

  // Notify parent when filters change
  React.useEffect(() => {
    onFiltersChange(query);
  }, [query, onFiltersChange]);

  const handleRemoveFilter = (category: keyof FilterQuery, key?: string) => {
    if (category === 'search') {
      setSearch('');
      return;
    }
    
    if (category === 'status') {
      if (key === 'blocked_only') {
        setFilter('status', { ...query.status, blocked_only: undefined });
      } else if (key) {
        const current = query.status?.card_status || [];
        setFilter('status', { ...query.status, card_status: current.filter(s => s !== key) });
      }
      return;
    }

    if (category === 'priority' && key) {
      const current = query.priority?.urgency || [];
      setFilter('priority', { urgency: current.filter(u => u !== key) as any });
      return;
    }

    if (category === 'time' && key === 'due') {
      setFilter('time', { ...query.time, due: undefined });
      return;
    }

    if (category === 'people') {
      if (key === 'assignee') {
        setFilter('people', { ...query.people, assignee: undefined });
      } else if (key === 'involved') {
        setFilter('people', { ...query.people, involved: undefined });
      }
      return;
    }

    if (category === 'context') {
      if (key === 'client_id') {
        setFilter('context', { ...query.context, client_id: undefined });
      }
      return;
    }

    if (category === 'quality') {
      if (key === 'briefing_pending') {
        setFilter('quality', { ...query.quality, briefing_pending: undefined });
      }
      return;
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        <FiltersPanel
          query={query}
          onSetFilter={setFilter}
          onSetSearch={setSearch}
          onClearFilters={clearFilters}
          onApplyMyTasks={applyMyTasksPreset}
          activeFiltersCount={activeFiltersCount}
        />
        
        <SavedViewsBar
          views={views}
          currentQuery={query}
          currentSort={sort}
          onApplyView={(q, s) => hydrateFromSavedView(q, s)}
          onSaveView={(name, isDefault) => 
            createView.mutate({ name, query, sort, isDefault })
          }
          onDeleteView={(id) => deleteView.mutate(id)}
          onSetDefault={(id) => setDefault.mutate(id)}
          isLoading={viewsLoading}
          isDirty={isDirty}
        />
      </div>
      
      {activeFiltersCount > 0 && (
        <div className="mt-2">
          <ActiveFiltersChips
            query={query}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={clearFilters}
          />
        </div>
      )}
    </div>
  );
};
