import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  Circle, 
  Folder,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
  Sparkles,
  Eye,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';

interface MindMapViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  spaceName?: string;
  folderName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  backlog: { label: 'Backlog', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Circle },
  briefing: { label: 'Briefing', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: FileText },
  todo: { label: 'A Fazer', color: 'text-primary', bgColor: 'bg-primary/10', icon: Clock },
  in_progress: { label: 'Em Progresso', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Sparkles },
  review: { label: 'Revisão', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Eye },
  approved: { label: 'Aprovado', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  delivered: { label: 'Entregue', color: 'text-green-700', bgColor: 'bg-green-200 dark:bg-green-900/50', icon: Package },
  done: { label: 'Concluído', color: 'text-green-700', bgColor: 'bg-green-200 dark:bg-green-900/50', icon: CheckCircle2 },
};

const URGENCY_COLORS: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
};

interface StatusGroupProps {
  status: string;
  cards: Card[];
  onCardClick: (card: Card) => void;
  depth: number;
}

const StatusGroup: React.FC<StatusGroupProps> = ({ status, cards, onCardClick, depth }) => {
  const [isOpen, setIsOpen] = useState(true);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;
  const Icon = config.icon;

  if (cards.length === 0) return null;

  return (
    <div className="relative">
      {/* Connection line from parent */}
      <div 
        className={cn(
          "absolute top-4 h-px bg-border",
          depth === 1 ? "-left-8 w-8" : "-left-6 w-6"
        )} 
      />
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2 h-auto py-2 px-3",
              config.bgColor
            )}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
            <Icon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
            <span className={cn("font-medium", config.color)}>{config.label}</span>
            <Badge variant="secondary" className="ml-auto">
              {cards.length}
            </Badge>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="ml-6 pl-4 border-l-2 border-border/50 space-y-1 mt-1">
            {cards.map(card => (
              <CardNode 
                key={card.id} 
                card={card} 
                onClick={() => onCardClick(card)} 
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

interface CardNodeProps {
  card: Card;
  onClick: () => void;
}

const CardNode: React.FC<CardNodeProps> = ({ card, onClick }) => {
  const urgencyClass = card.urgency ? URGENCY_COLORS[card.urgency] : '';
  const isOverdue = card.due_date && new Date(card.due_date) < new Date() && 
    !['done', 'delivered', 'approved'].includes(card.status);

  return (
    <div className="relative">
      {/* Connection line */}
      <div className="absolute top-3 -left-4 w-4 h-px bg-border" />
      
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left p-2 rounded-md border bg-card transition-all",
          "hover:shadow-md hover:border-primary/50",
          urgencyClass && `border-l-4 ${urgencyClass}`
        )}
      >
        <div className="flex items-start gap-2">
          <Circle className="h-2 w-2 mt-1.5 flex-shrink-0 fill-current text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{card.title}</p>
            {(card.due_date || isOverdue) && (
              <div className="flex items-center gap-1 mt-1">
                {isOverdue && (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                {card.due_date && (
                  <span className={cn(
                    "text-xs",
                    isOverdue ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {new Date(card.due_date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

export const MindMapView: React.FC<MindMapViewProps> = ({
  cards,
  onCardClick,
  spaceName = 'Espaço',
  folderName,
}) => {
  const [showAll, setShowAll] = useState(true);

  // Group cards by status
  const cardsByStatus = useMemo(() => {
    const grouped: Record<string, Card[]> = {};
    
    cards.forEach(card => {
      const status = card.status || 'backlog';
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(card);
    });

    return grouped;
  }, [cards]);

  // Status order
  const statusOrder = ['backlog', 'briefing', 'todo', 'in_progress', 'review', 'approved', 'delivered', 'done'];
  const orderedStatuses = statusOrder.filter(s => cardsByStatus[s]?.length > 0);

  // Stats
  const stats = useMemo(() => {
    const overdue = cards.filter(c => 
      c.due_date && 
      new Date(c.due_date) < new Date() && 
      !['done', 'delivered', 'approved'].includes(c.status)
    ).length;

    const urgent = cards.filter(c => c.urgency === 'critical').length;
    const inProgress = cards.filter(c => c.status === 'in_progress').length;

    return { total: cards.length, overdue, urgent, inProgress };
  }, [cards]);

  if (cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum card para exibir</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 min-w-[600px]">
        {/* Central Node */}
        <div className="flex items-start">
          {/* Root node */}
          <div className="flex-shrink-0">
            <div className="bg-primary text-primary-foreground rounded-xl p-4 shadow-lg min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="h-5 w-5" />
                <span className="font-semibold">{folderName || spaceName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-primary-foreground/20 rounded px-2 py-1">
                  <span className="opacity-80">Total:</span> {stats.total}
                </div>
                {stats.inProgress > 0 && (
                  <div className="bg-yellow-500/30 rounded px-2 py-1">
                    <span className="opacity-80">Em prog:</span> {stats.inProgress}
                  </div>
                )}
                {stats.overdue > 0 && (
                  <div className="bg-red-500/30 rounded px-2 py-1">
                    <span className="opacity-80">Atrasados:</span> {stats.overdue}
                  </div>
                )}
                {stats.urgent > 0 && (
                  <div className="bg-orange-500/30 rounded px-2 py-1">
                    <span className="opacity-80">Urgentes:</span> {stats.urgent}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main connection line */}
          <div className="w-8 h-px bg-border mt-8 flex-shrink-0" />

          {/* Status branches */}
          <div className="flex-1 space-y-2">
            {orderedStatuses.map((status, index) => (
              <StatusGroup
                key={status}
                status={status}
                cards={cardsByStatus[status] || []}
                onCardClick={onCardClick}
                depth={1}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Legenda de urgência:</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(URGENCY_COLORS).map(([urgency, colorClass]) => (
              <div key={urgency} className="flex items-center gap-1">
                <div className={cn("w-3 h-3 rounded", colorClass.replace('border-l-', 'bg-'))} />
                <span className="text-xs text-muted-foreground capitalize">{urgency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
