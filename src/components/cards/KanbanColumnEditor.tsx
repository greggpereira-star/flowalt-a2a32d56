import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GripVertical, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KanbanColumn } from '@/hooks/useKanbanColumns';
import type { CardStatus } from '@/lib/supabase';

interface KanbanColumnEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumn[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRename: (columnId: CardStatus, newLabel: string) => void;
  onToggleVisibility: (columnId: CardStatus) => void;
  onReset: () => void;
}

interface SortableColumnItemProps {
  column: KanbanColumn;
  onRename: (newLabel: string) => void;
  onToggle: () => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({ 
  column, 
  onRename, 
  onToggle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(column.label);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = () => {
    if (editLabel.trim()) {
      onRename(editLabel.trim());
    } else {
      setEditLabel(column.label);
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card',
        isDragging && 'opacity-50 shadow-lg',
        !column.visible && 'opacity-60 bg-muted/50'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Column name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setEditLabel(column.label);
                setIsEditing(false);
              }
            }}
            className="h-8"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-left w-full truncate hover:text-primary transition-colors"
          >
            {column.label}
          </button>
        )}
      </div>

      {/* Visibility toggle */}
      <div className="flex items-center gap-2">
        <Switch
          checked={column.visible}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary"
        />
        {column.visible ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
};

export const KanbanColumnEditor: React.FC<KanbanColumnEditorProps> = ({
  open,
  onOpenChange,
  columns,
  onReorder,
  onRename,
  onToggleVisibility,
  onReset,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
  const activeColumn = activeId ? columns.find(c => c.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = sortedColumns.findIndex(c => c.id === active.id);
    const newIndex = sortedColumns.findIndex(c => c.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  };

  const visibleCount = columns.filter(c => c.visible).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Colunas</DialogTitle>
          <DialogDescription>
            Arraste para reordenar, clique no nome para editar e use o toggle para mostrar/ocultar colunas.
          </DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
            <SortableContext
              items={sortedColumns.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedColumns.map((column) => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  onRename={(newLabel) => onRename(column.id, newLabel)}
                  onToggle={() => onToggleVisibility(column.id)}
                />
              ))}
            </SortableContext>
          </div>

          <DragOverlay>
            {activeColumn && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-lg">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{activeColumn.label}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{visibleCount} coluna(s) visível(is)</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Restaurar padrão
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
