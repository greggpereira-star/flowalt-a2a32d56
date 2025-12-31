import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  GitBranch, 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  Target,
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';
import type { Dependency } from '@/hooks/useDependencies';

interface CriticalPathAnalyzerProps {
  cards: CardType[];
  dependencies: Dependency[];
  onCardClick?: (cardId: string) => void;
}

interface CriticalPathNode {
  card: CardType;
  depth: number;
  isOnCriticalPath: boolean;
  estimatedCompletionDate: Date | null;
  blockedByCount: number;
  blockingCount: number;
  slack: number; // days of flexibility
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface PathSequence {
  nodes: CriticalPathNode[];
  totalDuration: number;
  totalEstimatedHours: number;
  endDate: Date | null;
}

export const CriticalPathAnalyzer: React.FC<CriticalPathAnalyzerProps> = ({
  cards,
  dependencies,
  onCardClick,
}) => {
  // Build adjacency lists
  const { adjacencyList, reverseAdjacencyList } = useMemo(() => {
    const adj: Map<string, string[]> = new Map();
    const revAdj: Map<string, string[]> = new Map();

    cards.forEach(c => {
      adj.set(c.id, []);
      revAdj.set(c.id, []);
    });

    dependencies.forEach(dep => {
      if (dep.blocking_card_id && dep.dependent_card_id) {
        const existing = adj.get(dep.blocking_card_id) || [];
        adj.set(dep.blocking_card_id, [...existing, dep.dependent_card_id]);

        const revExisting = revAdj.get(dep.dependent_card_id) || [];
        revAdj.set(dep.dependent_card_id, [...revExisting, dep.blocking_card_id]);
      }
    });

    return { adjacencyList: adj, reverseAdjacencyList: revAdj };
  }, [cards, dependencies]);

  // Find all paths and calculate critical path
  const criticalPathData = useMemo(() => {
    const activeCards = cards.filter(c => c.status !== 'delivered' && c.status !== 'archived');
    
    // Calculate earliest start time for each card
    const earliestStart: Map<string, number> = new Map();
    const duration: Map<string, number> = new Map();
    
    activeCards.forEach(card => {
      duration.set(card.id, card.estimated_hours || 8); // default 8 hours = 1 day
    });

    // Topological sort + forward pass
    const visited = new Set<string>();
    const sorted: string[] = [];
    
    const visit = (cardId: string) => {
      if (visited.has(cardId)) return;
      visited.add(cardId);
      
      const deps = reverseAdjacencyList.get(cardId) || [];
      deps.forEach(visit);
      sorted.push(cardId);
    };
    
    activeCards.forEach(card => visit(card.id));
    
    // Forward pass - calculate earliest start
    sorted.forEach(cardId => {
      const deps = reverseAdjacencyList.get(cardId) || [];
      if (deps.length === 0) {
        earliestStart.set(cardId, 0);
      } else {
        const maxDepEnd = Math.max(
          ...deps.map(depId => (earliestStart.get(depId) || 0) + (duration.get(depId) || 8))
        );
        earliestStart.set(cardId, maxDepEnd);
      }
    });

    // Find end nodes (cards that don't block anything active)
    const endNodes = activeCards.filter(card => {
      const blocking = adjacencyList.get(card.id) || [];
      return blocking.every(depId => {
        const depCard = cards.find(c => c.id === depId);
        return !depCard || depCard.status === 'delivered';
      });
    });

    // Calculate latest finish time (backward pass)
    const latestFinish: Map<string, number> = new Map();
    const maxEnd = Math.max(...Array.from(earliestStart.values()).map((start, i) => 
      start + (duration.get(sorted[i]) || 8)
    ), 0);

    endNodes.forEach(card => {
      latestFinish.set(card.id, maxEnd);
    });

    // Backward pass
    [...sorted].reverse().forEach(cardId => {
      const dependents = adjacencyList.get(cardId) || [];
      const activeDepends = dependents.filter(depId => {
        const depCard = cards.find(c => c.id === depId);
        return depCard && depCard.status !== 'delivered';
      });

      if (activeDepends.length === 0) {
        if (!latestFinish.has(cardId)) {
          latestFinish.set(cardId, maxEnd);
        }
      } else {
        const minDepStart = Math.min(
          ...activeDepends.map(depId => (latestFinish.get(depId) || maxEnd) - (duration.get(depId) || 8))
        );
        latestFinish.set(cardId, minDepStart);
      }
    });

    // Calculate slack and identify critical path
    const nodes: CriticalPathNode[] = activeCards.map(card => {
      const es = earliestStart.get(card.id) || 0;
      const lf = latestFinish.get(card.id) || 0;
      const dur = duration.get(card.id) || 8;
      const slack = Math.max(0, lf - es - dur);
      
      const blockedByCount = (reverseAdjacencyList.get(card.id) || []).filter(id => {
        const c = cards.find(x => x.id === id);
        return c && c.status !== 'delivered';
      }).length;
      
      const blockingCount = (adjacencyList.get(card.id) || []).filter(id => {
        const c = cards.find(x => x.id === id);
        return c && c.status !== 'delivered';
      }).length;

      const isOverdue = card.due_date && new Date(card.due_date) < new Date();
      const daysUntilDue = card.due_date ? differenceInDays(new Date(card.due_date), new Date()) : null;

      let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (isOverdue) {
        risk = 'critical';
      } else if (slack === 0 && blockingCount > 0) {
        risk = 'high';
      } else if (daysUntilDue !== null && daysUntilDue <= 3) {
        risk = 'high';
      } else if (slack < 16 && blockingCount > 0) {
        risk = 'medium';
      }

      return {
        card,
        depth: es / 8,
        isOnCriticalPath: slack === 0 && (blockedByCount > 0 || blockingCount > 0),
        estimatedCompletionDate: addDays(new Date(), es / 8 + dur / 8),
        blockedByCount,
        blockingCount,
        slack: slack / 8,
        risk,
      };
    });

    // Sort by depth (earliest first), then by critical path
    nodes.sort((a, b) => {
      if (a.isOnCriticalPath !== b.isOnCriticalPath) {
        return a.isOnCriticalPath ? -1 : 1;
      }
      return a.depth - b.depth;
    });

    // Calculate total project duration
    const totalDuration = maxEnd / 8; // Convert hours to days

    return {
      nodes,
      totalDuration,
      criticalPathLength: nodes.filter(n => n.isOnCriticalPath).length,
      endDate: addDays(new Date(), totalDuration),
    };
  }, [cards, dependencies, adjacencyList, reverseAdjacencyList]);

  const getRiskBadge = (risk: string) => {
    const config: Record<string, { class: string; label: string }> = {
      low: { class: 'bg-green-500/10 text-green-600 border-green-500/20', label: 'Baixo' },
      medium: { class: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: 'Médio' },
      high: { class: 'bg-orange-500/10 text-orange-600 border-orange-500/20', label: 'Alto' },
      critical: { class: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'Crítico' },
    };
    const c = config[risk] || config.low;
    return <Badge variant="outline" className={c.class}>{c.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'delivered') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'in_progress') return <Clock className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const criticalNodes = criticalPathData.nodes.filter(n => n.isOnCriticalPath);
  const atRiskNodes = criticalPathData.nodes.filter(n => n.risk === 'high' || n.risk === 'critical');

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Caminho Crítico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{criticalPathData.criticalPathLength}</p>
            <p className="text-xs text-muted-foreground">cards sem folga</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Duração Estimada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Math.ceil(criticalPathData.totalDuration)}</p>
            <p className="text-xs text-muted-foreground">dias úteis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Conclusão Prevista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              {criticalPathData.endDate ? format(criticalPathData.endDate, "dd MMM", { locale: ptBR }) : '-'}
            </p>
            <p className="text-xs text-muted-foreground">data projetada</p>
          </CardContent>
        </Card>

        <Card className={atRiskNodes.length > 0 ? 'border-destructive/50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", atRiskNodes.length > 0 && "text-destructive")}>
              {atRiskNodes.length}
            </p>
            <p className="text-xs text-muted-foreground">cards críticos</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Path Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Sequência do Caminho Crítico
          </CardTitle>
          <CardDescription>
            Cards que determinam a duração total do projeto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {criticalNodes.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Sem dependências críticas</p>
              <p className="text-muted-foreground">
                Todos os cards têm folga suficiente no cronograma.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {criticalNodes.map((node, index) => (
                <div key={node.card.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
                      node.risk === 'critical' && "border-red-500/50 bg-red-500/5",
                      node.risk === 'high' && "border-orange-500/50 bg-orange-500/5"
                    )}
                    onClick={() => onCardClick?.(node.card.id)}
                  >
                    <div className="flex items-center gap-2 w-8">
                      <span className="text-sm font-mono text-muted-foreground">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                    </div>
                    
                    {getStatusIcon(node.card.status)}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{node.card.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {node.card.estimated_hours && (
                          <span>{node.card.estimated_hours}h estimadas</span>
                        )}
                        {node.card.due_date && (
                          <span>• Prazo: {format(new Date(node.card.due_date), "dd/MM")}</span>
                        )}
                        {node.blockedByCount > 0 && (
                          <span>• Aguarda {node.blockedByCount} card(s)</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {node.blockingCount > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs">
                                Bloqueia {node.blockingCount}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Este card bloqueia {node.blockingCount} outro(s)
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {getRiskBadge(node.risk)}
                    </div>
                  </div>
                  
                  {index < criticalNodes.length - 1 && (
                    <div className="flex items-center justify-center py-1">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Nodes with Slack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Análise de Folga por Card</CardTitle>
          <CardDescription>
            Dias de folga disponíveis antes de impactar o cronograma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {criticalPathData.nodes.map(node => (
                <div
                  key={node.card.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer",
                    node.isOnCriticalPath && "bg-primary/5"
                  )}
                  onClick={() => onCardClick?.(node.card.id)}
                >
                  <div className="w-16">
                    <Progress 
                      value={Math.min(100, (node.slack / 5) * 100)} 
                      className="h-2"
                    />
                  </div>
                  <span className="text-sm font-mono w-12 text-right">
                    {node.slack.toFixed(1)}d
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{node.card.title}</p>
                  </div>
                  {node.isOnCriticalPath && (
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                      Crítico
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
