import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  Link2, 
  Unlink, 
  ArrowRight, 
  AlertTriangle,
  Search,
  Plus,
  X,
  CheckCircle,
  Clock,
  Flag,
} from 'lucide-react';
import type { Card as CardType } from '@/hooks/useCards';
import type { Dependency } from '@/hooks/useDependencies';
import { useCreateDependency, useDeleteDependency } from '@/hooks/useDependencies';
import { useToast } from '@/hooks/use-toast';

interface DependencyManagerProps {
  cards: CardType[];
  dependencies: Dependency[];
  selectedCardId?: string;
  onCardSelect?: (cardId: string) => void;
}

interface DependencyNode {
  id: string;
  title: string;
  status: string;
  blockedBy: string[];
  blocking: string[];
  level: number;
  isBlocked: boolean;
  isCriticalPath: boolean;
}

export const DependencyManager: React.FC<DependencyManagerProps> = ({
  cards,
  dependencies,
  selectedCardId,
  onCardSelect,
}) => {
  const { toast } = useToast();
  const createDependency = useCreateDependency();
  const deleteDependency = useDeleteDependency();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showOnlyBlocked, setShowOnlyBlocked] = useState(false);
  const [linkingFromCard, setLinkingFromCard] = useState<string | null>(null);

  // Build dependency graph
  const dependencyGraph = useMemo((): DependencyNode[] => {
    return cards
      .filter(c => c.status !== 'archived')
      .map(card => {
        const blockedBy = dependencies
          .filter(d => d.dependent_card_id === card.id && d.blocking_card_id)
          .map(d => d.blocking_card_id!);
        
        const blocking = dependencies
          .filter(d => d.blocking_card_id === card.id && d.dependent_card_id)
          .map(d => d.dependent_card_id!);

        // Check if blocked by incomplete tasks
        const isBlocked = blockedBy.some(blockingId => {
          const blockingCard = cards.find(c => c.id === blockingId);
          return blockingCard && blockingCard.status !== 'delivered';
        });

        // Calculate level in dependency chain (0 = no dependencies)
        const calculateLevel = (cardId: string, visited: Set<string> = new Set()): number => {
          if (visited.has(cardId)) return 0;
          visited.add(cardId);
          
          const deps = dependencies.filter(d => d.dependent_card_id === cardId);
          if (deps.length === 0) return 0;
          
          return 1 + Math.max(...deps.map(d => 
            d.blocking_card_id ? calculateLevel(d.blocking_card_id, visited) : 0
          ));
        };

        return {
          id: card.id,
          title: card.title,
          status: card.status,
          blockedBy,
          blocking,
          level: calculateLevel(card.id),
          isBlocked,
          isCriticalPath: blocking.length > 0 || blockedBy.length > 0,
        };
      })
      .sort((a, b) => a.level - b.level);
  }, [cards, dependencies]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return dependencyGraph.filter(node => {
      if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterStatus !== 'all' && node.status !== filterStatus) {
        return false;
      }
      if (showOnlyBlocked && !node.isBlocked) {
        return false;
      }
      return true;
    });
  }, [dependencyGraph, searchQuery, filterStatus, showOnlyBlocked]);

  // Handle creating dependency
  const handleCreateDependency = async (blockingCardId: string, dependentCardId: string) => {
    // Check for circular dependency
    const checkCircular = (fromId: string, toId: string, visited: Set<string> = new Set()): boolean => {
      if (fromId === toId) return true;
      if (visited.has(toId)) return false;
      visited.add(toId);
      
      const deps = dependencies.filter(d => d.blocking_card_id === toId);
      return deps.some(d => d.dependent_card_id && checkCircular(fromId, d.dependent_card_id, visited));
    };

    if (checkCircular(blockingCardId, dependentCardId)) {
      toast({
        title: 'Dependência circular',
        description: 'Não é possível criar uma dependência que forme um ciclo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createDependency.mutateAsync({
        blocking_card_id: blockingCardId,
        dependent_card_id: dependentCardId,
      });
      toast({ title: 'Dependência criada' });
      setLinkingFromCard(null);
    } catch (error) {
      toast({ title: 'Erro ao criar dependência', variant: 'destructive' });
    }
  };

  // Handle removing dependency
  const handleRemoveDependency = async (depId: string) => {
    try {
      await deleteDependency.mutateAsync(depId);
      toast({ title: 'Dependência removida' });
    } catch (error) {
      toast({ title: 'Erro ao remover dependência', variant: 'destructive' });
    }
  };

  // Get dependency by card IDs
  const getDependency = (blockingId: string, dependentId: string): Dependency | undefined => {
    return dependencies.find(
      d => d.blocking_card_id === blockingId && d.dependent_card_id === dependentId
    );
  };

  const getCardName = (cardId: string): string => {
    return cards.find(c => c.id === cardId)?.title || 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      delivered: 'bg-green-500',
      approved: 'bg-green-400',
      review: 'bg-purple-500',
      in_progress: 'bg-yellow-500',
      todo: 'bg-blue-500',
      briefing: 'bg-blue-400',
      backlog: 'bg-gray-500',
    };
    return (
      <div className={cn('w-2 h-2 rounded-full', colors[status] || 'bg-gray-500')} />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Dependências
        </CardTitle>
        <CardDescription>
          Gerencie as relações entre tarefas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="briefing">Briefing</SelectItem>
              <SelectItem value="todo">A Fazer</SelectItem>
              <SelectItem value="in_progress">Em Progresso</SelectItem>
              <SelectItem value="review">Revisão</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox
              id="blocked"
              checked={showOnlyBlocked}
              onCheckedChange={(c) => setShowOnlyBlocked(!!c)}
            />
            <label htmlFor="blocked" className="text-sm">
              Apenas bloqueados
            </label>
          </div>
        </div>

        {/* Linking mode indicator */}
        {linkingFromCard && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="text-sm">
              Criando dependência de: <strong>{getCardName(linkingFromCard)}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLinkingFromCard(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Dependency list */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filteredNodes.map(node => (
              <div
                key={node.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  selectedCardId === node.id && 'border-primary bg-primary/5',
                  node.isBlocked && 'border-orange-500/50',
                  linkingFromCard === node.id && 'border-primary ring-2 ring-primary/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {getStatusBadge(node.status)}
                    <span 
                      className="font-medium cursor-pointer hover:text-primary"
                      onClick={() => onCardSelect?.(node.id)}
                    >
                      {node.title}
                    </span>
                    {node.isBlocked && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Bloqueado por tarefas não concluídas
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {node.level > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Nível {node.level}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {linkingFromCard && linkingFromCard !== node.id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateDependency(linkingFromCard, node.id)}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Vincular aqui
                      </Button>
                    ) : !linkingFromCard && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLinkingFromCard(node.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Show dependencies */}
                {(node.blockedBy.length > 0 || node.blocking.length > 0) && (
                  <div className="mt-2 space-y-1">
                    {node.blockedBy.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground">Bloqueado por:</span>
                        {node.blockedBy.map(depId => {
                          const dep = getDependency(depId, node.id);
                          const depCard = cards.find(c => c.id === depId);
                          return (
                            <Badge 
                              key={depId} 
                              variant="outline" 
                              className={cn(
                                'text-xs cursor-pointer group',
                                depCard?.status === 'delivered' && 'line-through opacity-50'
                              )}
                            >
                              {depCard?.status === 'delivered' ? (
                                <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                              ) : (
                                <Clock className="h-3 w-3 mr-1 text-orange-500" />
                              )}
                              {getCardName(depId)}
                              {dep && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleRemoveDependency(dep.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    
                    {node.blocking.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground">Bloqueando:</span>
                        {node.blocking.map(depId => {
                          const dep = getDependency(node.id, depId);
                          return (
                            <Badge 
                              key={depId} 
                              variant="outline" 
                              className="text-xs cursor-pointer group"
                            >
                              <Flag className="h-3 w-3 mr-1" />
                              {getCardName(depId)}
                              {dep && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleRemoveDependency(dep.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Summary */}
        <Separator />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{dependencies.length} dependências totais</span>
          <span>{filteredNodes.filter(n => n.isBlocked).length} tarefas bloqueadas</span>
        </div>
      </CardContent>
    </Card>
  );
};
