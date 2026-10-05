import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isToday, isTomorrow } from 'date-fns';
import { ListChecks, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { isTaskOverdue } from '@/lib/home/home-utils';
import type { CardUrgency, HomeTaskItem } from '@/lib/home/home-types';

const URGENCY_LABEL: Record<CardUrgency, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const URGENCY_STYLE: Record<CardUrgency, string> = {
  critical: 'bg-red-50 text-red-700',
  high: 'bg-amber-50 text-amber-700',
  medium: 'bg-blue-50 text-blue-700',
  low: 'bg-slate-100 text-slate-600',
};

/** Prazo em linguagem natural — "Hoje" comunica mais que "11/08". */
function deadlineLabel(task: HomeTaskItem): { text: string; isLate: boolean } | null {
  if (!task.dueDate) return null;

  const due = new Date(task.dueDate);
  if (isTaskOverdue(task)) return { text: 'Atrasada', isLate: true };
  if (isToday(due)) return { text: 'Hoje', isLate: false };
  if (isTomorrow(due)) return { text: 'Amanhã', isLate: false };

  return { text: due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), isLate: false };
}

interface MyTasksWidgetProps {
  /** Visual novo da Início (opção beta). */
  novo?: boolean;
  tasks: HomeTaskItem[];
  isLoading?: boolean;
}

export function MyTasksWidget({ tasks, isLoading, novo }: MyTasksWidgetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Some da lista assim que o usuário marca, antes da ida ao servidor.
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('cards')
        .update({ status: 'delivered', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefa concluída');
      queryClient.invalidateQueries({ queryKey: ['home', 'my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
    onError: (error: Error, taskId) => {
      // Rollback: sem isto a tarefa sumiria da tela mesmo tendo falhado,
      // e o usuário acreditaria que concluiu algo que continua pendente.
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      toast.error(error.message || 'Não foi possível concluir a tarefa');
    },
  });

  const handleComplete = (taskId: string) => {
    setCompleting((prev) => new Set(prev).add(taskId));
    completeTask.mutate(taskId);
  };

  const visible = tasks.filter((t) => !completing.has(t.id));

  return (
    <section
      aria-labelledby="my-tasks-title"
      className={cn(
        'flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]',
        novo && 'border-border/60 bg-card p-5 shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="my-tasks-title"
            className={cn('flex items-center gap-2.5 text-base font-semibold text-slate-900', novo && 'text-[15px] font-bold tracking-tight text-foreground')}
          >
            <ListChecks className={cn('h-[18px] w-[18px] text-slate-400', novo && 'h-7 w-7 rounded-lg bg-primary/10 p-1.5 text-primary')} strokeWidth={1.75} />
            Minhas Tarefas
          </h2>
          <p className={cn('mt-0.5 text-sm text-slate-500', novo && 'text-[13px] text-muted-foreground')}>Suas prioridades de hoje</p>
        </div>

        <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className={cn(novo && 'h-8 px-2 text-[13px] font-semibold text-primary hover:bg-primary/10 hover:text-primary')}>
          Ver todas{novo && ' ›'}
        </Button>
      </div>

      <div className="mt-4 flex-1">
        {isLoading && (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && visible.length === 0 && (
          <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center', novo && 'max-sm:py-5')}>
            <span className={cn('flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50', novo && 'max-sm:hidden')}>
              <ListChecks className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
            </span>
            <p className={cn('mt-3 text-sm font-medium text-slate-900', novo && 'max-sm:mt-0')}>Tudo em dia!</p>
            <p className="mt-1 text-sm text-slate-500">
              Você não tem tarefas pendentes no momento.
            </p>
          </div>
        )}

        {!isLoading && visible.length > 0 && (
          <ul className="space-y-1">
            {visible.map((task) => {
              const deadline = deadlineLabel(task);

              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => handleComplete(task.id)}
                    aria-label={`Concluir tarefa: ${task.title}`}
                    className="mt-0.5"
                  />

                  <button
                    type="button"
                    onClick={() => navigate('/tasks')}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
                  >
                    <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          URGENCY_STYLE[task.urgency],
                        )}
                      >
                        {URGENCY_LABEL[task.urgency]}
                      </span>

                      {deadline && (
                        <span
                          className={cn(
                            'text-[11px]',
                            deadline.isLate ? 'font-medium text-red-600' : 'text-slate-500',
                          )}
                        >
                          {deadline.text}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/tasks')}
        className="mt-3 inline-flex items-center gap-1.5 self-start text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
      >
        <Plus className="h-3.5 w-3.5" />
        Nova tarefa
      </button>
    </section>
  );
}
