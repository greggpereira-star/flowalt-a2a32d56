import React, { useState } from 'react';
import { useClientSpaceCards, useClientSpaceStats } from '@/hooks/useClientSpaceCards';
import { useUpdateCard } from '@/hooks/useCards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  ExternalLink,
  ListTodo,
  PlayCircle,
  Eye,
  CheckCheck,
  Timer,
  AlertTriangle,
  FileText,
  Inbox,
  ThumbsUp,
  Package
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CardStatus } from '@/lib/supabase';

interface ClientTasksTabProps {
  clientId: string;
  onViewCard?: (cardId: string) => void;
}

const statusConfig: Record<CardStatus, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  backlog: { label: 'Backlog', icon: Inbox, color: 'text-gray-500', bgColor: 'bg-gray-100' },
  briefing: { label: 'Briefing', icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  todo: { label: 'A Fazer', icon: ListTodo, color: 'text-slate-600', bgColor: 'bg-slate-100' },
  in_progress: { label: 'Em Andamento', icon: PlayCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  review: { label: 'Revisão', icon: Eye, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  approved: { label: 'Aprovado', icon: ThumbsUp, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  delivered: { label: 'Entregue', icon: Package, color: 'text-green-600', bgColor: 'bg-green-100' },
  archived: { label: 'Arquivado', icon: Circle, color: 'text-gray-400', bgColor: 'bg-gray-100' },
};

const TaskCard: React.FC<{ 
  card: any; 
  onStatusChange: (cardId: string, status: CardStatus) => void;
  onViewCard?: (cardId: string) => void;
}> = ({ card, onStatusChange, onViewCard }) => {
  const config = statusConfig[card.status as CardStatus];
  const StatusIcon = config.icon;
  
  const isOverdue = card.due_date && card.status !== 'delivered' && card.status !== 'approved' && isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));
  const isDueToday = card.due_date && isToday(new Date(card.due_date));

  const getNextStatus = (current: CardStatus): CardStatus | null => {
    const flow: Record<string, CardStatus> = {
      backlog: 'briefing',
      briefing: 'todo',
      todo: 'in_progress',
      in_progress: 'review',
      review: 'approved',
      approved: 'delivered',
    };
    return flow[current] || null;
  };

  const nextStatus = getNextStatus(card.status);

  return (
    <Card className={cn(
      "group hover:shadow-md transition-all cursor-pointer",
      isOverdue && "border-red-300 bg-red-50/50"
    )}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Status indicator */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (nextStatus) {
                onStatusChange(card.id, nextStatus);
              }
            }}
            className={cn(
              "mt-0.5 p-1 rounded-full transition-colors",
              config.bgColor,
              nextStatus && "hover:scale-110"
            )}
            title={nextStatus ? `Mover para ${statusConfig[nextStatus].label}` : undefined}
          >
            <StatusIcon className={cn("h-4 w-4", config.color)} />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0" onClick={() => onViewCard?.(card.id)}>
            <h4 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {card.title}
            </h4>
            
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.color, config.bgColor)}>
                {config.label}
              </Badge>
              
              {card.due_date && (
                <span className={cn(
                  "text-[10px] flex items-center gap-1",
                  isOverdue ? "text-red-600 font-medium" : 
                  isDueToday ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {isOverdue && <AlertTriangle className="h-3 w-3" />}
                  {isDueToday && <Clock className="h-3 w-3" />}
                  {format(new Date(card.due_date), "dd MMM", { locale: ptBR })}
                </span>
              )}
              
              {card.estimated_hours && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Timer className="h-3 w-3" />
                  {card.estimated_hours}h
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {nextStatus && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(card.id, nextStatus);
                }}
                title={`Mover para ${statusConfig[nextStatus].label}`}
              >
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onViewCard?.(card.id);
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ClientTasksTab: React.FC<ClientTasksTabProps> = ({ clientId, onViewCard }) => {
  const { data: cards, isLoading } = useClientSpaceCards(clientId);
  const stats = useClientSpaceStats(clientId);
  const updateCard = useUpdateCard();
  const [filter, setFilter] = useState<'all' | CardStatus>('all');

  const handleStatusChange = (cardId: string, newStatus: CardStatus) => {
    updateCard.mutate({ id: cardId, status: newStatus });
  };

  const filteredCards = filter === 'all' 
    ? cards 
    : cards?.filter(c => c.status === filter);

  // Group by status for mini-kanban
  const groupedCards = {
    backlog: cards?.filter(c => c.status === 'backlog') || [],
    briefing: cards?.filter(c => c.status === 'briefing') || [],
    todo: cards?.filter(c => c.status === 'todo') || [],
    in_progress: cards?.filter(c => c.status === 'in_progress') || [],
    review: cards?.filter(c => c.status === 'review') || [],
    approved: cards?.filter(c => c.status === 'approved') || [],
    delivered: cards?.filter(c => c.status === 'delivered') || [],
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilter('todo')}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", filter === 'todo' ? 'bg-slate-200' : 'bg-slate-100')}>
              <ListTodo className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{stats.todo}</p>
              <p className="text-[10px] text-muted-foreground">A Fazer</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilter('in_progress')}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", filter === 'in_progress' ? 'bg-blue-200' : 'bg-blue-100')}>
              <PlayCircle className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{stats.inProgress}</p>
              <p className="text-[10px] text-muted-foreground">Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilter('review')}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", filter === 'review' ? 'bg-purple-200' : 'bg-purple-100')}>
              <Eye className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{stats.review}</p>
              <p className="text-[10px] text-muted-foreground">Revisão</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilter('delivered')}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", filter === 'delivered' ? 'bg-green-200' : 'bg-green-100')}>
              <Package className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{stats.delivered}</p>
              <p className="text-[10px] text-muted-foreground">Entregue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for overdue */}
      {stats.overdue > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 font-medium">
              {stats.overdue} {stats.overdue === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Hours summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Timer className="h-4 w-4" />
          Estimado: <strong className="text-foreground">{stats.totalHours}h</strong>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          Realizado: <strong className="text-foreground">{stats.actualHours}h</strong>
        </span>
        {stats.totalHours > 0 && (
          <Badge variant={stats.actualHours > stats.totalHours ? 'destructive' : 'secondary'}>
            {Math.round((stats.actualHours / stats.totalHours) * 100)}%
          </Badge>
        )}
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-1">
        <Button 
          variant={filter === 'all' ? 'secondary' : 'ghost'} 
          size="sm"
          onClick={() => setFilter('all')}
        >
          Todas ({stats.total})
        </Button>
        {Object.entries(statusConfig).filter(([key]) => key !== 'archived').map(([key, config]) => {
          const count = groupedCards[key as keyof typeof groupedCards]?.length || 0;
          if (count === 0 && filter !== key) return null;
          return (
            <Button 
              key={key}
              variant={filter === key ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setFilter(key as CardStatus)}
              className="gap-1"
            >
              <config.icon className={cn("h-3 w-3", config.color)} />
              {count}
            </Button>
          );
        })}
      </div>

      {/* Task list */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {(filteredCards || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === 'all' 
                  ? 'Nenhuma tarefa vinculada a este cliente'
                  : `Nenhuma tarefa com status "${statusConfig[filter].label}"`
                }
              </p>
            </div>
          ) : (
            filteredCards?.map(card => (
              <TaskCard 
                key={card.id} 
                card={card} 
                onStatusChange={handleStatusChange}
                onViewCard={onViewCard}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
