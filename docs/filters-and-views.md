# Filters and Custom Views Module

## Overview

This module provides powerful filtering and saved views functionality for the Flowalt application.

## Filter Query Schema

```typescript
interface FilterQuery {
  search?: string;
  people?: {
    assignee?: string[];      // User IDs of card owners
    involved?: string[];      // User IDs in card_members
    checklist_assignee?: string[];
  };
  status?: {
    card_status?: string[];   // 'todo', 'doing', 'review', 'done', 'blocked'
    blocked_only?: boolean;
    done_only?: boolean;
  };
  time?: {
    due?: 'today' | 'week' | 'overdue' | 'none' | 'range';
    due_from?: string;        // YYYY-MM-DD
    due_to?: string;
  };
  context?: {
    client_id?: string[];
    space_id?: string[];
    folder_id?: string[];
  };
  priority?: {
    urgency?: ('low' | 'medium' | 'high' | 'critical')[];
  };
  quality?: {
    briefing_pending?: boolean;
    no_checklist?: boolean;
  };
}
```

## Usage

### Using Card Filters Hook

```tsx
import { useCardFilters } from '@/hooks/useCardFilters';

function MyComponent() {
  const {
    query,
    sort,
    setFilter,
    setSearch,
    clearFilters,
    applyMyTasksPreset,
    isDirty,
    activeFiltersCount,
  } = useCardFilters();

  // Set a search term
  setSearch('marketing campaign');

  // Set status filter
  setFilter('status', { card_status: ['todo', 'doing'] });

  // Apply "My Tasks" preset
  applyMyTasksPreset();
}
```

### Using Saved Views Hook

```tsx
import { useSavedViews } from '@/hooks/useSavedViews';

function MyComponent() {
  const { views, defaultView, createView, deleteView, setDefault } = useSavedViews({
    scopeType: 'space',
    scopeId: 'space-uuid-here',
  });

  // Create a new view
  createView.mutate({
    name: 'Urgent Tasks',
    query: { priority: { urgency: ['high', 'critical'] } },
    isDefault: true,
  });
}
```

### Using Filtered Cards Hook

```tsx
import { useFilteredCards } from '@/hooks/useFilteredCards';
import { useCardFilters } from '@/hooks/useCardFilters';

function MyComponent() {
  const { query, sort } = useCardFilters();
  
  const { data, isLoading } = useFilteredCards({
    scopeType: 'space',
    scopeId: 'space-uuid-here',
    query,
    sort,
  });

  return (
    <div>
      {data?.cards.map(card => (
        <div key={card.id}>{card.title}</div>
      ))}
    </div>
  );
}
```

## Components

### FiltersPanel

Full-featured filter panel with collapsible sections.

```tsx
<FiltersPanel
  query={query}
  onSetFilter={setFilter}
  onSetSearch={setSearch}
  onClearFilters={clearFilters}
  onApplyMyTasks={applyMyTasksPreset}
  activeFiltersCount={activeFiltersCount}
/>
```

### SavedViewsBar

Dropdown for managing saved views.

```tsx
<SavedViewsBar
  views={views}
  currentQuery={query}
  currentSort={sort}
  onApplyView={hydrateFromSavedView}
  onSaveView={(name, isDefault) => createView.mutate({ name, query, isDefault })}
  onDeleteView={(id) => deleteView.mutate(id)}
  onSetDefault={(id) => setDefault.mutate(id)}
  isDirty={isDirty}
/>
```

### ActiveFiltersChips

Display active filters as removable chips.

```tsx
<ActiveFiltersChips
  query={query}
  onRemoveFilter={handleRemoveFilter}
  onClearAll={clearFilters}
/>
```

## Security

- All queries respect RLS policies
- Users can only see cards they have permission to access
- Filters never reveal cards without permission
- Saved views are user-specific and workspace-scoped

## Entitlements

- Free: 3 saved views per user
- Pro: 20 saved views per user
- Enterprise: 1000 saved views per user
