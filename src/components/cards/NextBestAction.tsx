import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  Play, 
  CheckSquare, 
  ArrowRight,
  Unlock,
  Clock,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import type { Card } from '@/hooks/useCards';

interface NextBestActionProps {
  card: Card;
  checklistProgress?: { completed: number; total: number };
  isBlocked?: boolean;
  blockingCards?: { id: string; title: string }[];
  onAction: (action: string) => void;
  className?: string;
}

interface SuggestedAction {
  id: string;
  priority: number;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

export const NextBestAction: React.FC<NextBestActionProps> = ({
  card,
  checklistProgress,
  isBlocked = false,
  blockingCards = [],
  onAction,
  className,
}) => {
  const actions: SuggestedAction[] = [];

  // Priority 1: Unblock dependency
  if (isBlocked && blockingCards.length > 0) {
    actions.push({
      id: 'unblock',
      priority: 1,
      icon: Unlock,
      label: 'Liberar bloqueio',
      description: `Resolver dependência: "${blockingCards[0].title}"`,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50',
    });
  }

  // Priority 2: Complete briefing
  if (!card.briefing_completed) {
    actions.push({
      id: 'complete-briefing',
      priority: 2,
      icon: FileText,
      label: 'Completar briefing',
      description: 'O briefing é essencial antes de começar a execução',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50',
    });
  }

  // Priority 3: Set due date for high priority cards
  if (!card.due_date && ['high', 'critical'].includes(card.urgency)) {
    actions.push({
      id: 'set-deadline',
      priority: 3,
      icon: Calendar,
      label: 'Definir prazo',
      description: 'Card prioritário sem data de entrega',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50',
    });
  }

  // Priority 4: Start checklist
  if (checklistProgress && checklistProgress.total > 0 && checklistProgress.completed === 0 && 
      card.status !== 'backlog' && card.briefing_completed) {
    actions.push({
      id: 'start-checklist',
      priority: 4,
      icon: CheckSquare,
      label: 'Iniciar checklist',
      description: `${checklistProgress.total} itens pendentes`,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50',
    });
  }

  // Priority 5: Start timer (for in_progress cards without time logged)
  if (card.status === 'in_progress' && (!card.actual_hours || card.actual_hours === 0)) {
    actions.push({
      id: 'start-timer',
      priority: 5,
      icon: Clock,
      label: 'Iniciar timer',
      description: 'Registre o tempo de trabalho',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
    });
  }

  // Priority 6: Move to in_progress
  if (card.status === 'todo' && card.briefing_completed && !isBlocked) {
    actions.push({
      id: 'start-work',
      priority: 6,
      icon: Play,
      label: 'Iniciar trabalho',
      description: 'Mover para "Em Progresso"',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
    });
  }

  // Sort by priority and take top action
  actions.sort((a, b) => a.priority - b.priority);
  const topAction = actions[0];

  if (!topAction) return null;

  const Icon = topAction.icon;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="font-medium">Próxima Ação Sugerida</span>
      </div>
      
      <Button
        variant="outline"
        className={cn(
          'w-full justify-start gap-3 h-auto py-3 px-4 border-2',
          topAction.bgColor,
          topAction.color
        )}
        onClick={() => onAction(topAction.id)}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <div className="flex-1 text-left">
          <p className="font-medium text-sm">{topAction.label}</p>
          <p className="text-xs opacity-80 font-normal">{topAction.description}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {/* Show other suggestions */}
      {actions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {actions.slice(1, 3).map((action) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={action.id}
                variant="ghost"
                size="sm"
                className={cn('h-7 text-xs gap-1.5', action.color)}
                onClick={() => onAction(action.id)}
              >
                <ActionIcon className="h-3.5 w-3.5" />
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};
