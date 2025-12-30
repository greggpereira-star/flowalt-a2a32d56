import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type { CardUrgency } from '@/lib/supabase';

export interface KanbanViewFilter {
  urgency: CardUrgency[];
  owners: string[];
  clients: string[];
  tags: string[];
  hasDeadline: boolean | null;
  isOverdue: boolean | null;
  hasBriefing: boolean | null;
  searchQuery: string;
}

export interface KanbanView {
  id: string;
  name: string;
  filters: KanbanViewFilter;
  swimlane: string;
  is_personal: boolean;
  created_by: string;
  created_at: string;
}

const DEFAULT_FILTER: KanbanViewFilter = {
  urgency: [],
  owners: [],
  clients: [],
  tags: [],
  hasDeadline: null,
  isOverdue: null,
  hasBriefing: null,
  searchQuery: '',
};

// Local storage key for personal views
const getStorageKey = (workspaceId: string, userId: string) => 
  `kanban-views-${workspaceId}-${userId}`;

export const useKanbanViews = (spaceId?: string) => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [localViews, setLocalViews] = useState<KanbanView[]>([]);

  // Load views from localStorage
  useEffect(() => {
    if (!currentWorkspace?.id || !user?.id) return;
    
    const storageKey = getStorageKey(currentWorkspace.id, user.id);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setLocalViews(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse kanban views', e);
      }
    }
  }, [currentWorkspace?.id, user?.id]);

  // Save view
  const saveView = (name: string, filters: KanbanViewFilter, swimlane: string) => {
    if (!currentWorkspace?.id || !user?.id) return;
    
    const newView: KanbanView = {
      id: Date.now().toString(),
      name,
      filters,
      swimlane,
      is_personal: true,
      created_by: user.id,
      created_at: new Date().toISOString(),
    };

    const updatedViews = [...localViews, newView];
    setLocalViews(updatedViews);
    
    const storageKey = getStorageKey(currentWorkspace.id, user.id);
    localStorage.setItem(storageKey, JSON.stringify(updatedViews));
    
    return newView;
  };

  // Delete view
  const deleteView = (viewId: string) => {
    if (!currentWorkspace?.id || !user?.id) return;
    
    const updatedViews = localViews.filter(v => v.id !== viewId);
    setLocalViews(updatedViews);
    
    const storageKey = getStorageKey(currentWorkspace.id, user.id);
    localStorage.setItem(storageKey, JSON.stringify(updatedViews));
  };

  // Update view
  const updateView = (viewId: string, updates: Partial<KanbanView>) => {
    if (!currentWorkspace?.id || !user?.id) return;
    
    const updatedViews = localViews.map(v => 
      v.id === viewId ? { ...v, ...updates } : v
    );
    setLocalViews(updatedViews);
    
    const storageKey = getStorageKey(currentWorkspace.id, user.id);
    localStorage.setItem(storageKey, JSON.stringify(updatedViews));
  };

  return {
    views: localViews,
    saveView,
    deleteView,
    updateView,
    defaultFilter: DEFAULT_FILTER,
  };
};

// Hook for tracking card selection state across components
export const useCardSelection = () => {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleCard = (cardId: string) => {
    const newSelection = new Set(selectedCards);
    if (newSelection.has(cardId)) {
      newSelection.delete(cardId);
    } else {
      newSelection.add(cardId);
    }
    setSelectedCards(newSelection);
  };

  const selectAll = (cardIds: string[]) => {
    const newSelection = new Set(selectedCards);
    cardIds.forEach(id => newSelection.add(id));
    setSelectedCards(newSelection);
  };

  const deselectAll = (cardIds: string[]) => {
    const newSelection = new Set(selectedCards);
    cardIds.forEach(id => newSelection.delete(id));
    setSelectedCards(newSelection);
  };

  const clearSelection = () => {
    setSelectedCards(new Set());
    setIsSelectionMode(false);
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      clearSelection();
    } else {
      setIsSelectionMode(true);
    }
  };

  return {
    selectedCards,
    isSelectionMode,
    toggleCard,
    selectAll,
    deselectAll,
    clearSelection,
    toggleSelectionMode,
    selectedCount: selectedCards.size,
  };
};
