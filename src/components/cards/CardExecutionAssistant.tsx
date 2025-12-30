import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  Clock,
  FileText,
  Link2,
  CheckSquare,
  CalendarDays,
  ArrowRight,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';
import type { Dependency } from '@/hooks/useDependencies';

interface CardExecutionAssistantProps {
  card: CardType;
  dependencies: Dependency[];
  checklists: { id: string; title: string; is_completed: boolean }[];
  allCards: CardType[];
  onNavigateToCard?: (cardId: string) => void;
  onCompleteChecklist?: (checklistId: string) => void;
}

interface Alert {
  type: 'deadline' | 'overdue' | 'blocked' | 'briefing' | 'dependency_delay';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface Recommendation {
  type: 'next_step' | 'waiting' | 'tip';
  title: string;
  description: string;
  priority: number;
}

export const CardExecutionAssistant: React.FC<CardExecutionAssistantProps> = ({
  card,
  dependencies,
  checklists,
  allCards,
  onNavigateToCard,
  onCompleteChecklist,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Calculate alerts and recommendations
  useEffect(() => {
    const newAlerts: Alert[] = [];
    const newRecommendations: Recommendation[] = [];
    const today = new Date();

    // Check due date alerts
    if (card.due_date) {
      const dueDate = new Date(card.due_date);
      const daysUntilDue = differenceInDays(dueDate, today);

      if (isPast(dueDate) && !isToday(dueDate) && card.status !== 'delivered') {
        newAlerts.push({
          type: 'overdue',
          severity: 'critical',
          title: 'Prazo Vencido',
          description: `Este card está ${Math.abs(daysUntilDue)} dia(s) atrasado.`,
        });
      } else if (daysUntilDue <= 2 && daysUntilDue >= 0 && card.status !== 'delivered') {
        newAlerts.push({
          type: 'deadline',
          severity: 'warning',
          title: 'Prazo Próximo',
          description: daysUntilDue === 0 
            ? 'Prazo vence hoje!' 
            : `Prazo em ${daysUntilDue} dia(s).`,
        });
      }
    }

    // Check briefing status
    if (!card.briefing_completed && ['backlog', 'briefing'].includes(card.status)) {
      newAlerts.push({
        type: 'briefing',
        severity: 'warning',
        title: 'Briefing Pendente',
        description: 'Complete o briefing antes de iniciar a execução.',
      });
    }

    // Check blocking dependencies
    const blockingDeps = dependencies.filter(d => d.dependent_card_id === card.id);
    blockingDeps.forEach(dep => {
      if (dep.blocking_card_id) {
        const blockingCard = allCards.find(c => c.id === dep.blocking_card_id);
        if (blockingCard && blockingCard.status !== 'delivered') {
          newAlerts.push({
            type: 'blocked',
            severity: 'critical',
            title: 'Dependência Bloqueando',
            description: `Aguardando conclusão de "${blockingCard.title}"`,
            action: onNavigateToCard ? {
              label: 'Ver tarefa',
              onClick: () => onNavigateToCard(blockingCard.id),
            } : undefined,
          });

          // Check if blocking card is delayed
          if (blockingCard.due_date && isPast(new Date(blockingCard.due_date))) {
            newAlerts.push({
              type: 'dependency_delay',
              severity: 'critical',
              title: 'Dependência Atrasada',
              description: `A tarefa "${blockingCard.title}" está atrasada e bloqueia este card.`,
            });
          }
        }
      }
    });

    // Generate recommendations
    const pendingChecklists = checklists.filter(c => !c.is_completed);
    const completedChecklists = checklists.filter(c => c.is_completed);

    // Next step recommendation
    if (pendingChecklists.length > 0) {
      const nextItem = pendingChecklists[0];
      
      // Check if this checklist item is blocked
      const checklistDeps = dependencies.filter(d => d.dependent_checklist_id === nextItem.id);
      const isChecklistBlocked = checklistDeps.some(d => {
        if (d.blocking_checklist_id) {
          return !checklists.find(c => c.id === d.blocking_checklist_id)?.is_completed;
        }
        if (d.blocking_card_id) {
          const bc = allCards.find(c => c.id === d.blocking_card_id);
          return bc && bc.status !== 'delivered';
        }
        return false;
      });

      if (isChecklistBlocked) {
        newRecommendations.push({
          type: 'waiting',
          title: 'Item em Espera',
          description: `"${nextItem.title}" está aguardando uma dependência.`,
          priority: 1,
        });
      } else {
        newRecommendations.push({
          type: 'next_step',
          title: 'Próximo Passo',
          description: nextItem.title,
          priority: 0,
        });
      }
    }

    // Progress tip
    if (checklists.length > 0) {
      const progress = (completedChecklists.length / checklists.length) * 100;
      if (progress >= 80 && progress < 100) {
        newRecommendations.push({
          type: 'tip',
          title: 'Quase Lá!',
          description: `${100 - Math.round(progress)}% restante para concluir o checklist.`,
          priority: 2,
        });
      }
    }

    // Status progression tip
    if (card.status === 'in_progress' && completedChecklists.length === checklists.length && checklists.length > 0) {
      newRecommendations.push({
        type: 'tip',
        title: 'Pronto para Revisão?',
        description: 'Todos os itens do checklist estão completos. Considere mover para revisão.',
        priority: 0,
      });
    }

    setAlerts(newAlerts);
    setRecommendations(newRecommendations.sort((a, b) => a.priority - b.priority));
  }, [card, dependencies, checklists, allCards, onNavigateToCard]);

  if (alerts.length === 0 && recommendations.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Assistente de Execução
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-lg text-sm',
                  alert.severity === 'critical' && 'bg-destructive/10 text-destructive',
                  alert.severity === 'warning' && 'bg-orange-500/10 text-orange-600',
                  alert.severity === 'info' && 'bg-blue-500/10 text-blue-600'
                )}
              >
                {alert.type === 'overdue' && <Clock className="h-4 w-4 shrink-0 mt-0.5" />}
                {alert.type === 'deadline' && <CalendarDays className="h-4 w-4 shrink-0 mt-0.5" />}
                {alert.type === 'blocked' && <Link2 className="h-4 w-4 shrink-0 mt-0.5" />}
                {alert.type === 'briefing' && <FileText className="h-4 w-4 shrink-0 mt-0.5" />}
                {alert.type === 'dependency_delay' && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-xs opacity-80">{alert.description}</p>
                </div>
                {alert.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={alert.action.onClick}
                  >
                    {alert.action.label}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-lg text-sm',
                  rec.type === 'next_step' && 'bg-green-500/10 text-green-600',
                  rec.type === 'waiting' && 'bg-yellow-500/10 text-yellow-600',
                  rec.type === 'tip' && 'bg-blue-500/10 text-blue-600'
                )}
              >
                {rec.type === 'next_step' && <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" />}
                {rec.type === 'waiting' && <Clock className="h-4 w-4 shrink-0 mt-0.5" />}
                {rec.type === 'tip' && <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium">{rec.title}</p>
                  <p className="text-xs opacity-80">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
