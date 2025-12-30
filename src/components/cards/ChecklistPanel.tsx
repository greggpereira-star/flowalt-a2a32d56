import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Trash2, Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useChecklists,
  useCreateChecklist,
  useUpdateChecklist,
  useDeleteChecklist,
  type Checklist,
} from '@/hooks/useChecklists';
import { useStartTimer, useStopTimer, useRunningTimer } from '@/hooks/useTimeEntries';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChecklistPanelProps {
  cardId: string;
}

export const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ cardId }) => {
  const { data: checklists, isLoading } = useChecklists(cardId);
  const createChecklist = useCreateChecklist();
  const updateChecklist = useUpdateChecklist();
  const deleteChecklist = useDeleteChecklist();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: runningTimer } = useRunningTimer(cardId);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const completedCount = checklists?.filter((c) => c.is_completed).length || 0;
  const totalCount = checklists?.length || 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;

    await createChecklist.mutateAsync({
      card_id: cardId,
      title: newItemTitle.trim(),
    });

    setNewItemTitle('');
    setIsAdding(false);
  };

  const handleToggleComplete = async (item: Checklist) => {
    await updateChecklist.mutateAsync({
      id: item.id,
      card_id: cardId,
      is_completed: !item.is_completed,
    });
  };

  const handleDelete = async (item: Checklist) => {
    await deleteChecklist.mutateAsync({
      id: item.id,
      card_id: cardId,
    });
  };

  const handleToggleTimer = async (item: Checklist) => {
    if (runningTimer?.checklist_id === item.id) {
      await stopTimer.mutateAsync({
        id: runningTimer.id,
        card_id: cardId,
      });
    } else {
      await startTimer.mutateAsync({
        card_id: cardId,
        checklist_id: item.id,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">
              {completedCount}/{totalCount} ({Math.round(progressPercent)}%)
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-2">
        {checklists?.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group',
              item.is_completed && 'opacity-60'
            )}
          >
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={() => handleToggleComplete(item)}
              className="flex-shrink-0"
            />

            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm',
                  item.is_completed && 'line-through text-muted-foreground'
                )}
              >
                {item.title}
              </p>
              {item.completed_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Concluído em {format(new Date(item.completed_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>

            {/* Timer Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity',
                runningTimer?.checklist_id === item.id && 'opacity-100 text-status-inProgress'
              )}
              onClick={() => handleToggleTimer(item)}
              disabled={item.is_completed}
            >
              {runningTimer?.checklist_id === item.id ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            {/* Assignee Avatar */}
            {item.assignee_id && (
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarFallback className="text-[10px]">U</AvatarFallback>
              </Avatar>
            )}

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleDelete(item)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Add Item */}
      {isAdding ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Título do item..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem();
              if (e.key === 'Escape') {
                setIsAdding(false);
                setNewItemTitle('');
              }
            }}
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleAddItem}
            disabled={!newItemTitle.trim() || createChecklist.isPending}
          >
            Adicionar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsAdding(false);
              setNewItemTitle('');
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Item
        </Button>
      )}
    </div>
  );
};
