import { useState, useCallback, useEffect } from 'react';
import type { CardStatus } from '@/lib/supabase';

export interface KanbanColumn {
  id: CardStatus;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', label: 'Backlog', visible: true, order: 0 },
  { id: 'briefing', label: 'Briefing', visible: false, order: 1 },
  { id: 'todo', label: 'A Fazer', visible: true, order: 2 },
  { id: 'in_progress', label: 'Em Produção', visible: true, order: 3 },
  { id: 'review', label: 'Revisão', visible: true, order: 4 },
  { id: 'approved', label: 'Aprovado', visible: true, order: 5 },
  { id: 'delivered', label: 'Entregue', visible: true, order: 6 },
];

const STORAGE_KEY_PREFIX = 'kanban-columns-';

/**
 * Hook for managing Kanban columns per view
 * Columns are saved per viewId in localStorage
 */
export function useKanbanColumns(viewId: string | null) {
  const storageKey = viewId ? `${STORAGE_KEY_PREFIX}${viewId}` : null;
  
  const [columns, setColumns] = useState<KanbanColumn[]>(() => {
    if (!storageKey) return DEFAULT_COLUMNS;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_COLUMNS;
  });

  // Persist to localStorage when columns change
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(columns));
  }, [columns, storageKey]);

  // Reset when viewId changes
  useEffect(() => {
    if (!storageKey) {
      setColumns(DEFAULT_COLUMNS);
      return;
    }
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setColumns(JSON.parse(saved));
      } else {
        setColumns(DEFAULT_COLUMNS);
      }
    } catch {
      setColumns(DEFAULT_COLUMNS);
    }
  }, [storageKey]);

  const updateColumn = useCallback((columnId: CardStatus, updates: Partial<KanbanColumn>) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, ...updates } : col
    ));
  }, []);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const newColumns = [...prev];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      // Update order values
      return newColumns.map((col, idx) => ({ ...col, order: idx }));
    });
  }, []);

  const toggleVisibility = useCallback((columnId: CardStatus) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  }, []);

  const renameColumn = useCallback((columnId: CardStatus, newLabel: string) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, label: newLabel } : col
    ));
  }, []);

  const addColumn = useCallback((columnId: CardStatus) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, visible: true } : col
    ));
  }, []);

  const resetToDefaults = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
  }, []);

  // Get only visible columns sorted by order
  const visibleColumns = columns
    .filter(col => col.visible)
    .sort((a, b) => a.order - b.order);

  // Get visible statuses for KanbanBoard
  const visibleStatuses = visibleColumns.map(col => col.id);

  // Get column labels map
  const columnLabels = columns.reduce((acc, col) => {
    acc[col.id] = col.label;
    return acc;
  }, {} as Record<CardStatus, string>);

  return {
    columns,
    visibleColumns,
    visibleStatuses,
    columnLabels,
    updateColumn,
    reorderColumns,
    toggleVisibility,
    renameColumn,
    addColumn,
    resetToDefaults,
  };
}

export type { CardStatus };
