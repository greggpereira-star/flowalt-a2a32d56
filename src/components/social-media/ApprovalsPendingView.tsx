import React, { useMemo } from 'react';
import { extractPlainText } from '@/components/ui/rich-text-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  Calendar,
  User,
  Flame,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays, differenceInHours, isPast, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';

interface ApprovalsPendingViewProps {
  cards: CardType[];
  onCardClick: (card: CardType) => void;
  isLoading?: boolean;
}

type CriticalityLevel = 'critical' | 'urgent' | 'warning' | 'normal';

interface CardWithCriticality extends CardType {
  criticality: CriticalityLevel;
  criticalityScore: number;
  daysUntilDue: number | null;
  hoursUntilDue: number | null;
}

export const ApprovalsPendingView: React.FC<ApprovalsPendingViewProps> = ({
  cards,
  onCardClick,
  isLoading = false,
}) => {
  // Filter and sort cards by criticality
  const pendingCards = useMemo(() => {
    const now = new Date();
    
    // Filter cards that are pending approval or in production phase
    const filtered = cards.filter(card => {
      const status = card.status;
      // Include cards in review/approval status or cards close to deadline
      return status === 'review' || 
             status === 'briefing' || 
             (card.due_date && isPast(new Date(card.due_date)) && status !== 'approved' && status !== 'archived');
    });

    // Calculate criticality for each card
    const withCriticality: CardWithCriticality[] = filtered.map(card => {
      let criticalityScore = 0;
      let criticality: CriticalityLevel = 'normal';
      let daysUntilDue: number | null = null;
      let hoursUntilDue: number | null = null;

      if (card.due_date) {
        const dueDate = new Date(card.due_date);
        daysUntilDue = differenceInDays(dueDate, now);
        hoursUntilDue = differenceInHours(dueDate, now);

        // Calculate score based on deadline proximity
        if (isPast(dueDate)) {
          criticalityScore = 1000 + Math.abs(daysUntilDue); // Overdue gets highest priority
          criticality = 'critical';
        } else if (isToday(dueDate) || hoursUntilDue <= 24) {
          criticalityScore = 500;
          criticality = 'critical';
        } else if (isTomorrow(dueDate) || daysUntilDue <= 2) {
          criticalityScore = 300;
          criticality = 'urgent';
        } else if (daysUntilDue <= 5) {
          criticalityScore = 100;
          criticality = 'warning';
        }
      }

      // Add score based on urgency
      if (card.urgency === 'high') {
        criticalityScore += 200;
        if (criticality === 'normal') criticality = 'urgent';
      }

      // Add score for pending approval status
      if (card.status === 'review') {
        criticalityScore += 50;
        if (criticality === 'normal') criticality = 'warning';
      }

      return {
        ...card,
        criticality,
        criticalityScore,
        daysUntilDue,
        hoursUntilDue,
      };
    });

    // Sort by criticality score (highest first)
    return withCriticality.sort((a, b) => b.criticalityScore - a.criticalityScore);
  }, [cards]);

  const getCriticalityBadge = (card: CardWithCriticality) => {
    const config = {
      critical: { label: 'Crítico', className: 'bg-destructive text-destructive-foreground', icon: Flame },
      urgent: { label: 'Urgente', className: 'bg-orange-500 text-white', icon: AlertTriangle },
      warning: { label: 'Atenção', className: 'bg-yellow-500 text-black', icon: AlertCircle },
      normal: { label: 'Normal', className: 'bg-muted text-muted-foreground', icon: Clock },
    };
    const { label, className, icon: Icon } = config[card.criticality];
    return (
      <Badge className={cn('gap-1', className)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getDeadlineText = (card: CardWithCriticality) => {
    if (!card.due_date) return null;
    
    const dueDate = new Date(card.due_date);
    
    if (isPast(dueDate)) {
      return (
        <span className="text-destructive font-medium">
          Atrasado {Math.abs(card.daysUntilDue || 0)} dia(s)
        </span>
      );
    }
    
    if (isToday(dueDate)) {
      return <span className="text-destructive font-medium">Vence hoje!</span>;
    }
    
    if (isTomorrow(dueDate)) {
      return <span className="text-orange-500 font-medium">Vence amanhã</span>;
    }
    
    if (card.daysUntilDue !== null && card.daysUntilDue <= 5) {
      return <span className="text-yellow-600">Vence em {card.daysUntilDue} dias</span>;
    }
    
    return format(dueDate, "dd 'de' MMMM", { locale: ptBR });
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      in_review: 'Em Aprovação',
      in_progress: 'Em Produção',
      backlog: 'Backlog',
      todo: 'A Fazer',
      done: 'Concluído',
    };
    return statusMap[status] || status;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (pendingCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Tudo em dia!</h3>
        <p className="text-muted-foreground max-w-md">
          Não há itens pendentes de aprovação ou próximos do vencimento.
        </p>
      </div>
    );
  }

  // Group by criticality
  const grouped = {
    critical: pendingCards.filter(c => c.criticality === 'critical'),
    urgent: pendingCards.filter(c => c.criticality === 'urgent'),
    warning: pendingCards.filter(c => c.criticality === 'warning'),
    normal: pendingCards.filter(c => c.criticality === 'normal'),
  };

  const renderGroup = (items: CardWithCriticality[], title: string, icon: React.ReactNode, colorClass: string) => {
    if (items.length === 0) return null;
    
    return (
      <div className="space-y-3">
        <div className={cn('flex items-center gap-2 text-sm font-semibold', colorClass)}>
          {icon}
          <span>{title}</span>
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </div>
        <div className="space-y-2">
          {items.map(card => (
            <Card 
              key={card.id} 
              className={cn(
                'cursor-pointer hover:shadow-md transition-all border-l-4',
                card.criticality === 'critical' && 'border-l-destructive',
                card.criticality === 'urgent' && 'border-l-orange-500',
                card.criticality === 'warning' && 'border-l-yellow-500',
                card.criticality === 'normal' && 'border-l-muted'
              )}
              onClick={() => onCardClick(card)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getCriticalityBadge(card)}
                      <Badge variant="outline" className="text-xs">
                        {getStatusText(card.status)}
                      </Badge>
                    </div>
                    <h4 className="font-medium truncate">{card.title}</h4>
                    {card.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {extractPlainText(card.description)}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {card.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {getDeadlineText(card)}
                        </div>
                      )}
                      {card.owner_id && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>Atribuído</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-6">
      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-destructive">{grouped.critical.length}</div>
              <div className="text-xs text-muted-foreground">Críticos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">{grouped.urgent.length}</div>
              <div className="text-xs text-muted-foreground">Urgentes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{grouped.warning.length}</div>
              <div className="text-xs text-muted-foreground">Atenção</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-muted-foreground">{grouped.normal.length}</div>
              <div className="text-xs text-muted-foreground">Normal</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards by criticality */}
      {renderGroup(grouped.critical, 'Críticos - Ação Imediata', <Flame className="h-4 w-4" />, 'text-destructive')}
      {renderGroup(grouped.urgent, 'Urgentes', <AlertTriangle className="h-4 w-4" />, 'text-orange-500')}
      {renderGroup(grouped.warning, 'Requer Atenção', <AlertCircle className="h-4 w-4" />, 'text-yellow-600')}
      {renderGroup(grouped.normal, 'Em Andamento', <Clock className="h-4 w-4" />, 'text-muted-foreground')}
    </div>
  );
};
