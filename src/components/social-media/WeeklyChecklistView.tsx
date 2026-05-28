import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Circle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyChecklistViewProps {
  folderId: string;
  viewId: string;
}

interface WeeklyTask {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  assignee_id: string | null;
  created_at: string;
  sort_order: number;
  workspace_id: string;
  folder_id: string;
}

export const WeeklyChecklistView: React.FC<WeeklyChecklistViewProps> = ({
  folderId,
}) => {
  const { currentWorkspace } = useWorkspace();
  const { data: members } = useWorkspaceMembers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['weekly-tasks', folderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_tasks')
        .select('*')
        .eq('folder_id', folderId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WeeklyTask[];
    },
    enabled: !!folderId && !!currentWorkspace,
  });

  const createTask = useMutation({
    mutationFn: async (title: string) => {
      if (!currentWorkspace) throw new Error('Workspace ausente');
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error } = await supabase
        .from('weekly_tasks')
        .insert({
          workspace_id: currentWorkspace.id,
          folder_id: folderId,
          title,
          is_completed: false,
          sort_order: (tasks?.length || 0),
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-tasks', folderId] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao adicionar tarefa', description: e.message, variant: 'destructive' });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WeeklyTask> }) => {
      const payload: any = { ...updates };
      if (typeof updates.is_completed === 'boolean') {
        payload.completed_at = updates.is_completed ? new Date().toISOString() : null;
      }
      const { error } = await supabase.from('weekly_tasks').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-tasks', folderId] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao atualizar tarefa', description: e.message, variant: 'destructive' });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-tasks', folderId] });
    },
  });

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync(newTaskTitle.trim());
    setNewTaskTitle('');
    setIsAdding(false);
  };

  const handleToggleComplete = async (task: WeeklyTask) => {
    await updateTask.mutateAsync({ id: task.id, updates: { is_completed: !task.is_completed } });
  };

  const handleRename = async (task: WeeklyTask) => {
    if (!editingTitle.trim()) return;
    await updateTask.mutateAsync({ id: task.id, updates: { title: editingTitle.trim() } });
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDelete = async (task: WeeklyTask) => {
    await deleteTask.mutateAsync(task.id);
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

  const completedCount = tasks?.filter(t => t.is_completed).length || 0;
  const totalCount = tasks?.length || 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Checklist Semanal</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Semana de {format(weekStart, "dd 'de' MMMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {completedCount}/{totalCount}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {Math.round(progressPercent)}% concluído
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {tasks?.map(task => (
          <Card key={task.id} className={cn('transition-all', task.is_completed && 'opacity-60')}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={() => handleToggleComplete(task)}
                  className="h-5 w-5"
                />
                {editingId === task.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(task);
                        if (e.key === 'Escape') { setEditingId(null); setEditingTitle(''); }
                      }}
                      autoFocus
                      className="h-8"
                    />
                    <Button size="sm" onClick={() => handleRename(task)}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingTitle(''); }}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium', task.is_completed && 'line-through text-muted-foreground')}>
                        {task.title}
                      </p>
                      {task.completed_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Concluído {format(new Date(task.completed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    {task.assignee_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={getAssigneeAvatar(task.assignee_id) || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {(getAssigneeName(task.assignee_id) || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{getAssigneeName(task.assignee_id)}</TooltipContent>
                      </Tooltip>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingId(task.id); setEditingTitle(task.title); }}>
                          <Edit className="h-4 w-4 mr-2" /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(task)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!tasks || tasks.length === 0) && !isAdding && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Circle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">Nenhuma tarefa nesta semana</p>
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar primeira tarefa
              </Button>
            </CardContent>
          </Card>
        )}

        {isAdding ? (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Checkbox disabled className="h-5 w-5" />
                <Input
                  placeholder="O que precisa ser feito?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask();
                    if (e.key === 'Escape') { setIsAdding(false); setNewTaskTitle(''); }
                  }}
                  autoFocus
                  className="h-9"
                />
                <Button size="sm" onClick={handleAddTask} disabled={!newTaskTitle.trim() || createTask.isPending}>
                  {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewTaskTitle(''); }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : tasks && tasks.length > 0 && (
          <Button variant="outline" className="w-full border-dashed" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova tarefa
          </Button>
        )}
      </div>
    </div>
  );
};
