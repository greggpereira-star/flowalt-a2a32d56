import { useState, useCallback, useEffect } from 'react';
import type { CardStatus } from '@/lib/supabase';
import { CARD_STATUS_LABELS } from '@/lib/cards/cardStatusLabels';
import { useStatusLabels } from '@/hooks/useStatusLabels';

export interface KanbanColumn {
  id: CardStatus;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', label: CARD_STATUS_LABELS.backlog, visible: true, order: 0 },
  { id: 'briefing', label: CARD_STATUS_LABELS.briefing, visible: false, order: 1 },
  { id: 'todo', label: CARD_STATUS_LABELS.todo, visible: true, order: 2 },
  { id: 'in_progress', label: CARD_STATUS_LABELS.in_progress, visible: true, order: 3 },
  { id: 'review', label: CARD_STATUS_LABELS.review, visible: true, order: 4 },
  { id: 'approved', label: CARD_STATUS_LABELS.approved, visible: true, order: 5 },
  { id: 'delivered', label: CARD_STATUS_LABELS.delivered, visible: true, order: 6 },
];

const STORAGE_KEY_PREFIX = 'kanban-columns-';

/**
 * Hook for managing Kanban columns per view
 * Columns are saved per viewId in localStorage
 */
export function useKanbanColumns(viewId: string | null) {
  const storageKey = viewId ? `${STORAGE_KEY_PREFIX}${viewId}` : null;

  // Os rótulos vêm do workspace, nunca do que está salvo no navegador.
  //
  // A configuração de colunas mora no localStorage, por visão e por navegador.
  // Na prática isso fez a mesma coluna ganhar nomes diferentes em cada máquina:
  // o card com status 'todo' aparecia como "A Fazer" para uma pessoa e
  // "Backlog" para outra, no mesmo espaço e no mesmo card.
  //
  // Ordem e visibilidade continuam locais — são preferências de quem olha. O
  // nome da etapa é vocabulário compartilhado, então vive na tabela
  // workspace_status_labels e vale para o time inteiro.
  const { labels: columnLabels, renameStatus, isRenaming } = useStatusLabels();
  
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

  const renameColumn = useCallback(
    (columnId: CardStatus, newLabel: string) => {
      renameStatus({ status: columnId, label: newLabel });
    },
    [renameStatus],
  );

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
    .sort((a, b) => a.order - b.order)
    .map(col => ({ ...col, label: columnLabels[col.id] ?? col.label }));

  // Get visible statuses for KanbanBoard
  const visibleStatuses = visibleColumns.map(col => col.id);


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
    isRenaming,
  };
}

export type { CardStatus };
