import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GripVertical, Eye, EyeOff, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KanbanColumn } from '@/hooks/useKanbanColumns';
import type { CardStatus } from '@/lib/supabase';

interface KanbanColumnsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumn[];
  onToggleVisibility: (columnId: CardStatus) => void;
  onRename: (columnId: CardStatus, newLabel: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onReset: () => void;
}

interface SortableColumnItemProps {
  column: KanbanColumn;
  onToggleVisibility: (columnId: CardStatus) => void;
  onRename: (columnId: CardStatus, newLabel: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
  column,
  onToggleVisibility,
  onRename,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(column.label);

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
    if (editValue.trim()) {
      onRename(column.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(column.label);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-card border rounded-lg transition-all',
        isDragging && 'opacity-50 shadow-lg',
        !column.visible && 'opacity-60'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Column name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSave}>
              <Check className="h-4 w-4 text-primary" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel}>
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn('font-medium truncate', !column.visible && 'text-muted-foreground')}>
              {column.label}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Visibility toggle */}
      <div className="flex items-center gap-2">
        <Switch
          checked={column.visible}
          onCheckedChange={() => onToggleVisibility(column.id)}
          aria-label={column.visible ? 'Ocultar coluna' : 'Mostrar coluna'}
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

export const KanbanColumnsEditor: React.FC<KanbanColumnsEditorProps> = ({
  open,
  onOpenChange,
  columns,
  onToggleVisibility,
  onRename,
  onReorder,
  onReset,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar Colunas</SheetTitle>
          <SheetDescription>
            Arraste para reordenar, clique no nome para renomear e use o toggle para mostrar/ocultar colunas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
            <span>{visibleCount} de {columns.length} colunas visíveis</span>
            <Button variant="ghost" size="sm" onClick={onReset} className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Restaurar padrão
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {columns.map((column) => (
                  <div key={column.id} className="group">
                    <SortableColumnItem
                      column={column}
                      onToggleVisibility={onToggleVisibility}
                      onRename={onRename}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <SheetFooter className="mt-6">
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Concluído
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
