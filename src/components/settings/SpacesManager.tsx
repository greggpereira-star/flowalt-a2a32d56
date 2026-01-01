import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useSpaces,
  useReorderSpaces,
  useArchiveSpace,
  useFixSpaceOrder,
  useUpdateSpace,
  useCreateSpace,
  Space,
} from '@/hooks/useSpaces';
import { usePermissions } from '@/hooks/usePermissions';
import { IconPicker, getIconByName } from '@/components/settings/IconPicker';
import { CreateSpaceDialog } from '@/components/settings/CreateSpaceDialog';
import {
  FolderKanban,
  GripVertical,
  Pencil,
  Archive,
  Plus,
  Wrench,
  Check,
  X,
  Shield,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpaceType } from '@/lib/supabase';

// Color palette for spaces
const COLOR_OPTIONS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#64748b', // Slate
];

interface SortableSpaceItemProps {
  space: Space;
  onEdit: (space: Space) => void;
  onArchive: (space: Space) => void;
}

function SortableSpaceItem({ space, onEdit, onArchive }: SortableSpaceItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: space.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getIconByName(space.icon);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
        !isDragging && 'hover:bg-accent/50'
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Icon */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: `${space.color}20` }}
      >
        <Icon className="h-4 w-4" style={{ color: space.color }} />
      </div>

      {/* Name */}
      <span className="flex-1 font-medium text-sm">{space.name}</span>

      {/* System Badge */}
      {space.is_system && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 text-xs">
              <Shield className="h-3 w-3" />
              Sistema
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Espaços do sistema não podem ser excluídos</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(space)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Editar espaço</TooltipContent>
        </Tooltip>

        {!space.is_system && (
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Archive className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Arquivar espaço</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar espaço?</AlertDialogTitle>
                <AlertDialogDescription>
                  O espaço "{space.name}" será arquivado e não aparecerá mais na navegação.
                  Os cards associados continuarão existindo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onArchive(space)}>
                  Arquivar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

interface EditSpaceFormProps {
  space: Space | null;
  onSave: (updates: { name: string; icon: string; color: string }) => void;
  onCancel: () => void;
  isNew?: boolean;
}

function EditSpaceForm({ space, onSave, onCancel, isNew }: EditSpaceFormProps) {
  const [name, setName] = useState(space?.name || '');
  const [icon, setIcon] = useState(space?.icon || 'folder');
  const [color, setColor] = useState(space?.color || '#6366f1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), icon, color });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        <IconPicker value={icon} onChange={setIcon} color={color} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do espaço"
          className="flex-1"
          autoFocus
        />
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Cor</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                'h-7 w-7 rounded-full transition-all',
                color === c && 'ring-2 ring-offset-2 ring-primary'
              )}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={!name.trim()}>
          <Check className="h-4 w-4 mr-1" />
          {isNew ? 'Criar' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

export function SpacesManager() {
  const { canManageWorkspace } = usePermissions();
  const { data: spaces, isLoading } = useSpaces();
  const reorderSpaces = useReorderSpaces();
  const archiveSpace = useArchiveSpace();
  const fixSpaceOrder = useFixSpaceOrder();
  const updateSpace = useUpdateSpace();
  const createSpace = useCreateSpace();

  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && spaces) {
      const oldIndex = spaces.findIndex((s) => s.id === active.id);
      const newIndex = spaces.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(spaces, oldIndex, newIndex);

      // Create new sort_order mapping
      const items = reordered.map((space, index) => ({
        id: space.id,
        sort_order: index,
      }));

      reorderSpaces.mutate({ items, reason: 'drag_reorder' });
    }
  };

  const handleEdit = (space: Space) => {
    setEditingSpace(space);
  };

  const handleArchive = (space: Space) => {
    archiveSpace.mutate(space.id);
  };

  const handleSaveEdit = async (updates: { name: string; icon: string; color: string }) => {
    if (editingSpace) {
      await updateSpace.mutateAsync({ id: editingSpace.id, ...updates });
      setEditingSpace(null);
    }
  };

  const handleCreate = async (data: { name: string; icon: string; color: string; type: SpaceType }) => {
    await createSpace.mutateAsync({
      name: data.name,
      icon: data.icon,
      color: data.color,
      type: data.type,
    });
    setIsCreateDialogOpen(false);
  };

  if (!canManageWorkspace) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Apenas administradores podem gerenciar espaços
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Gerenciador de Espaços</CardTitle>
              <CardDescription>
                Espaços organizam o trabalho por contexto
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fixSpaceOrder.mutate()}
                  disabled={fixSpaceOrder.isPending}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Corrigir Ordem
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Normaliza a ordenação sequencial dos espaços</p>
              </TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              onClick={() => {
                setIsCreateDialogOpen(true);
                setEditingSpace(null);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Espaço
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Arraste os espaços para reorganizar. A ordem aqui reflete diretamente no menu lateral.
            Espaços marcados como "Sistema" são essenciais e não podem ser arquivados.
          </p>
        </div>

        {/* Create Space Dialog */}
        <CreateSpaceDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreate}
          isLoading={createSpace.isPending}
        />

        {/* Edit Form */}
        {editingSpace && (
          <EditSpaceForm
            space={editingSpace}
            onSave={handleSaveEdit}
            onCancel={() => setEditingSpace(null)}
          />
        )}

        {/* Spaces List */}
        {spaces && spaces.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={spaces.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {spaces.map((space) => (
                  <SortableSpaceItem
                    key={space.id}
                    space={space}
                    onEdit={handleEdit}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum espaço encontrado</p>
            <p className="text-sm mt-1">Crie seu primeiro espaço para começar</p>
          </div>
        )}

        {/* Stats */}
        {spaces && spaces.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>{spaces.length} espaço(s)</span>
            <span>
              {spaces.filter((s) => s.is_system).length} sistêmico(s)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
