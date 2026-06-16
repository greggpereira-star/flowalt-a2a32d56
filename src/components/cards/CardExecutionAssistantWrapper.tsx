import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  CheckCircle,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, differenceInDays, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCard } from '@/hooks/useCards';
import { useDependencies } from '@/hooks/useDependencies';
import { useChecklists } from '@/hooks/useChecklists';
import { useAllCards } from '@/hooks/useCards';
import { CardAIAssistant } from './CardAIAssistant';

interface CardExecutionAssistantWrapperProps {
  cardId: string;
  onNavigateToCard?: (cardId: string) => void;
}

interface Alert {
  type: 'deadline' | 'overdue' | 'blocked' | 'briefing' | 'dependency_delay';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
}

interface Recommendation {
  type: 'next_step' | 'waiting' | 'tip';
  title: string;
  description: string;
  priority: number;
}

export const CardExecutionAssistantWrapper: React.FC<CardExecutionAssistantWrapperProps> = ({
  cardId,
  onNavigateToCard,
}) => {
  const { data: card, isLoading: cardLoading } = useCard(cardId);
  const { data: dependencies = [] } = useDependencies();
  const { data: checklists = [], isLoading: checklistsLoading } = useChecklists(cardId);
  const { data: allCards = [] } = useAllCards();

  if (cardLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!card) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Card não encontrado
        </CardContent>
      </Card>
    );
  }

  // Generate alerts
  const alerts: Alert[] = [];

  // Check due date
  if (card.due_date) {
    const dueDate = new Date(card.due_date);
    const now = new Date();
    
    if (isPast(dueDate) && card.status !== 'delivered' && card.status !== 'approved') {
      const daysOverdue = differenceInDays(now, dueDate);
      alerts.push({
        type: 'overdue',
        severity: daysOverdue > 3 ? 'critical' : 'warning',
        title: 'Card Atrasado',
        description: `Este card está ${daysOverdue} dia(s) atrasado.`,
      });
    } else if (isToday(dueDate)) {
      alerts.push({
        type: 'deadline',
        severity: 'warning',
        title: 'Prazo Hoje',
        description: 'O prazo deste card é hoje.',
      });
    } else {
      const daysUntil = differenceInDays(dueDate, now);
      if (daysUntil <= 2 && daysUntil > 0) {
        alerts.push({
          type: 'deadline',
          severity: 'info',
          title: 'Prazo Próximo',
          description: `Faltam ${daysUntil} dia(s) para o prazo.`,
        });
      }
    }
  }

  // Check briefing status
  if (!card.briefing_completed && ['in_progress', 'review'].includes(card.status)) {
    alerts.push({
      type: 'briefing',
      severity: 'warning',
      title: 'Briefing Pendente',
      description: 'O briefing deste card ainda não foi concluído.',
    });
  }

  // Check dependencies
  const cardDependencies = dependencies.filter(d => d.dependent_card_id === cardId);
  const blockedBy = cardDependencies.filter(dep => {
    const blockingCard = allCards.find(c => c.id === dep.blocking_card_id);
    return blockingCard && blockingCard.status !== 'delivered';
  });

  const isBlocked = blockedBy.length > 0;

  if (isBlocked) {
    const blockingCardTitles = blockedBy
      .map(dep => allCards.find(c => c.id === dep.blocking_card_id)?.title)
      .filter(Boolean);
    
    alerts.push({
      type: 'blocked',
      severity: 'warning',
      title: 'Card Bloqueado',
      description: `Aguardando: ${blockingCardTitles.slice(0, 2).join(', ')}${blockingCardTitles.length > 2 ? ` +${blockingCardTitles.length - 2}` : ''}`,
    });
  }

  // Generate recommendations
  const recommendations: Recommendation[] = [];

  // Next checklist item
  const pendingChecklists = checklists.filter(c => !c.is_completed);
  if (pendingChecklists.length > 0) {
    recommendations.push({
      type: 'next_step',
      title: 'Próxima Tarefa',
      description: pendingChecklists[0].title,
      priority: 1,
    });
  }

  // Progress tip
  const completedCount = checklists.filter(c => c.is_completed).length;
  const totalCount = checklists.length;
  if (totalCount > 0) {
    const progress = Math.round((completedCount / totalCount) * 100);
    if (progress >= 80 && progress < 100) {
      recommendations.push({
        type: 'tip',
        title: 'Quase Lá!',
        description: `Você completou ${progress}% do checklist. Continue assim!`,
        priority: 2,
      });
    }
  }

  // Status recommendation
  if (card.status === 'todo' && completedCount > 0) {
    recommendations.push({
      type: 'tip',
      title: 'Atualizar Status',
      description: 'Considere mover o card para "Em Progresso".',
      priority: 3,
    });
  }

  if (completedCount === totalCount && totalCount > 0 && card.status !== 'review' && card.status !== 'delivered') {
    recommendations.push({
      type: 'tip',
      title: 'Checklist Completo',
      description: 'Todos os itens foram concluídos. Mova para revisão.',
      priority: 1,
    });
  }

  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/10 border-destructive/50 text-destructive';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-700';
      default:
        return 'bg-blue-500/10 border-blue-500/50 text-blue-700';
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'overdue':
      case 'deadline':
        return <CalendarDays className="h-4 w-4" />;
      case 'blocked':
        return <Link2 className="h-4 w-4" />;
      case 'briefing':
        return <FileText className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={cn(
                  'p-3 rounded-lg border flex items-start gap-3',
                  getSeverityStyles(alert.severity)
                )}
              >
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{alert.title}</p>
                  <p className="text-xs opacity-80">{alert.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations Section */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.sort((a, b) => a.priority - b.priority).map((rec, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-muted/50 flex items-start gap-3"
              >
                {rec.type === 'next_step' ? (
                  <ChevronRight className="h-4 w-4 text-primary" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{rec.title}</p>
                  <p className="text-xs text-muted-foreground">{rec.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Progress Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Progresso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedCount}/{totalCount}</p>
                <p className="text-xs text-muted-foreground">Itens completos</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Timer className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{card.actual_hours || 0}h</p>
                <p className="text-xs text-muted-foreground">
                  de {card.estimated_hours || '-'}h est.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Assistant */}
      <CardAIAssistant cardId={cardId} isBlocked={isBlocked} />

      {/* No alerts or recommendations */}
      {alerts.length === 0 && recommendations.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="font-medium">Tudo em ordem!</p>
            <p className="text-sm text-muted-foreground">
              Nenhum alerta ou recomendação no momento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
