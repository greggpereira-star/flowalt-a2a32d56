import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Play, Pause, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useChecklists,
  useCreateChecklist,
  useUpdateChecklist,
  useDeleteChecklist,
  type Checklist,
} from '@/hooks/useChecklists';
import { useStartTimer, useStopTimer, useRunningTimer } from '@/hooks/useTimeEntries';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { ChecklistItemActions } from './ChecklistItemActions';
import { toast } from 'sonner';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChecklistPanelProps {
  cardId: string;
}

export const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ cardId }) => {
  const { respiro: novo } = useNewUiBeta();
  const { data: checklists, isLoading } = useChecklists(cardId);
  const { data: members } = useWorkspaceMembers();
  const createChecklist = useCreateChecklist();
  const updateChecklist = useUpdateChecklist();
  const deleteChecklist = useDeleteChecklist();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: runningTimer } = useRunningTimer(cardId);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addingBelowId, setAddingBelowId] = useState<string | null>(null);
  const [addBelowTitle, setAddBelowTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const completedCount = checklists?.filter((c) => c.is_completed).length || 0;
  const totalCount = checklists?.length || 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;

    try {
      await createChecklist.mutateAsync({
        card_id: cardId,
        title: newItemTitle.trim(),
      });
    } catch (e) {
      toast.error('Não foi possível adicionar o item.', { description: (e as Error)?.message });
      return;
    }

    setNewItemTitle('');
    setIsAdding(false);
  };

  const handleAddBelow = async (afterItem: Checklist) => {
    if (!addBelowTitle.trim()) return;

    try {
      await createChecklist.mutateAsync({
        card_id: cardId,
        title: addBelowTitle.trim(),
      });
    } catch (e) {
      toast.error('Não foi possível adicionar o item.', { description: (e as Error)?.message });
      return;
    }

    setAddBelowTitle('');
    setAddingBelowId(null);
  };

  const handleToggleComplete = async (item: Checklist) => {
    try {
      await updateChecklist.mutateAsync({
        id: item.id,
        card_id: cardId,
        is_completed: !item.is_completed,
      });
    } catch (e) {
      toast.error('Não foi possível atualizar o item.', { description: (e as Error)?.message });
    }
  };

  const handleRename = async (item: Checklist, newTitle: string) => {
    try {
      await updateChecklist.mutateAsync({
        id: item.id,
        card_id: cardId,
        title: newTitle,
      });
    } catch (e) {
      toast.error('Não foi possível renomear o item.', { description: (e as Error)?.message });
      return;
    }
    setRenamingId(null);
  };

  const handleAssign = async (item: Checklist, assigneeId: string | null, functionTitle: string | null) => {
    try {
      await updateChecklist.mutateAsync({
        id: item.id,
        card_id: cardId,
        assignee_id: assigneeId,
        function_title: functionTitle,
      });
    } catch (e) {
      toast.error('Não foi possível atribuir o item.', { description: (e as Error)?.message });
    }
  };

  const handleDelete = async (item: Checklist) => {
    try {
      await deleteChecklist.mutateAsync({
        id: item.id,
        card_id: cardId,
      });
      toast.success('Item excluído.');
    } catch (e) {
      toast.error('Não foi possível excluir o item.', { description: (e as Error)?.message });
    }
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

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return null;
    const member = members?.find(m => m.user_id === assigneeId);
    return member?.profile?.full_name || member?.profile?.email || null;
  };

  const getAssigneeAvatar = (assigneeId: string | null) => {
    if (!assigneeId) return null;
    const member = members?.find(m => m.user_id === assigneeId);
    return member?.profile?.avatar_url || null;
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
        <div className={cn('space-y-2', novo && 'space-y-1.5')}>
          <div className={cn('flex items-center justify-between text-sm', novo && 'text-[12.5px]')}>
            <span className="text-muted-foreground">Progresso</span>
            <span className={cn('font-medium', novo && 'font-semibold tabular-nums')}>
              {completedCount}/{totalCount} ({Math.round(progressPercent)}%)
            </span>
          </div>
          <Progress value={progressPercent} className={cn('h-2', novo && 'h-1.5')} />
        </div>
      )}

      {/* Checklist Items */}
      <div className={cn('space-y-1', novo && 'space-y-1.5')}>
        {checklists?.map((item, index) => (
          <React.Fragment key={item.id}>
            <div
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors group',
                novo && 'gap-3 rounded-xl border-border/60 px-3 py-2.5 hover:bg-muted/40',
                item.is_completed && 'opacity-60'
              )}
            >
              {/* Drag Handle */}
              <div className={cn('opacity-0 group-hover:opacity-50 cursor-grab', novo && 'hidden')}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Checkbox */}
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={() => handleToggleComplete(item)}
                className={cn('flex-shrink-0', novo && 'h-[18px] w-[18px] rounded-full')}
              />

              {/* Content */}
              {renamingId === item.id ? (
                <ChecklistItemActions
                  item={item}
                  onRename={(newTitle) => handleRename(item, newTitle)}
                  onAddBelow={() => setAddingBelowId(item.id)}
                  onAssign={(id, fn) => handleAssign(item, id, fn)}
                  onDelete={() => handleDelete(item)}
                  isRenaming={true}
                  onStartRename={() => setRenamingId(item.id)}
                  onCancelRename={() => setRenamingId(null)}
                />
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm',
                        novo && 'text-[14px] font-medium leading-snug',
                        item.is_completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.function_title && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {item.function_title}
                        </span>
                      )}
                      {item.completed_at && (
                        <span className="text-xs text-muted-foreground">
                          Concluído {format(new Date(item.completed_at), "dd MMM", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timer Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0',
                          runningTimer?.checklist_id === item.id && 'opacity-100 text-green-500'
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
                    </TooltipTrigger>
                    <TooltipContent>
                      {runningTimer?.checklist_id === item.id ? 'Pausar timer' : 'Iniciar timer'}
                    </TooltipContent>
                  </Tooltip>

                  {/* Assignee Avatar (always visible when assigned) */}
                  {item.assignee_id && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={getAssigneeAvatar(item.assignee_id) || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {(getAssigneeName(item.assignee_id) || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        {getAssigneeName(item.assignee_id)}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Actions */}
                  <ChecklistItemActions
                    item={item}
                    onRename={(newTitle) => handleRename(item, newTitle)}
                    onAddBelow={() => setAddingBelowId(item.id)}
                    onAssign={(id, fn) => handleAssign(item, id, fn)}
                    onDelete={() => handleDelete(item)}
                    isRenaming={false}
                    onStartRename={() => setRenamingId(item.id)}
                    onCancelRename={() => setRenamingId(null)}
                  />
                </>
              )}
            </div>

            {/* Add Below Input */}
            {addingBelowId === item.id && (
              <div className="flex items-center gap-2 pl-8 py-1">
                <Input
                  placeholder="Novo item..."
                  value={addBelowTitle}
                  onChange={(e) => setAddBelowTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBelow(item);
                    if (e.key === 'Escape') {
                      setAddingBelowId(null);
                      setAddBelowTitle('');
                    }
                  }}
                  autoFocus
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => handleAddBelow(item)}
                  disabled={!addBelowTitle.trim()}
                >
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setAddingBelowId(null);
                    setAddBelowTitle('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </React.Fragment>
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
          variant="ghost"
          className={cn(
            'w-full justify-start text-muted-foreground hover:text-foreground',
            novo && 'h-11 rounded-xl border border-dashed border-border/70 px-3 font-medium hover:border-foreground/30 hover:bg-muted/30'
          )}
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo item da checklist
        </Button>
      )}
    </div>
  );
};
