import React, { useMemo, forwardRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  Clock, 
  Users,
  TrendingDown,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Calendar,
  Link2,
} from 'lucide-react';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';
import type { Dependency } from '@/hooks/useDependencies';

interface BottleneckDetectorProps {
  cards: CardType[];
  dependencies: Dependency[];
  memberCapacity?: Array<{
    id: string;
    name: string;
    allocated_hours: number;
    active_cards: number;
  }>;
  onCardClick?: (cardId: string) => void;
  onActionClick?: (action: string, data: any) => void;
}

interface Bottleneck {
  id: string;
  type: 'overdue' | 'blocked_chain' | 'stale' | 'overloaded' | 'dependency_loop' | 'single_point';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  affectedCards: CardType[];
  recommendations: Array<{
    action: string;
    label: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  metrics?: Record<string, number | string>;
}

export const BottleneckDetector: React.FC<BottleneckDetectorProps> = ({
  cards,
  dependencies,
  memberCapacity = [],
  onCardClick,
  onActionClick,
}) => {
  const bottlenecks = useMemo(() => {
    const now = new Date();
    const detected: Bottleneck[] = [];
    const activeCards = cards.filter(c => c.status !== 'delivered' && c.status !== 'archived');

    // 1. OVERDUE CHAINS - Cards atrasados que bloqueiam outros
    const overdueCards = activeCards.filter(c => 
      c.due_date && new Date(c.due_date) < now
    );
    
    const overdueBlocking = overdueCards.filter(card => {
      return dependencies.some(d => 
        d.blocking_card_id === card.id && 
        activeCards.some(c => c.id === d.dependent_card_id)
      );
    });

    if (overdueBlocking.length > 0) {
      const affectedDownstream = activeCards.filter(card =>
        dependencies.some(d => 
          d.dependent_card_id === card.id && 
          overdueBlocking.some(ob => ob.id === d.blocking_card_id)
        )
      );

      detected.push({
        id: 'overdue-chain',
        type: 'overdue',
        severity: 'critical',
        title: 'Cadeia de Atraso Crítica',
        description: `${overdueBlocking.length} card(s) atrasado(s) estão bloqueando ${affectedDownstream.length} outro(s) card(s).`,
        impact: `Risco de efeito cascata de atrasos em ${affectedDownstream.length + overdueBlocking.length} cards.`,
        affectedCards: [...overdueBlocking, ...affectedDownstream],
        recommendations: [
          { action: 'prioritize', label: 'Priorizar cards atrasados', priority: 'high' },
          { action: 'reassign', label: 'Realocar recursos', priority: 'high' },
          { action: 'split', label: 'Dividir em tarefas menores', priority: 'medium' },
        ],
        metrics: {
          daysOverdue: Math.max(...overdueBlocking.map(c => 
            differenceInDays(now, new Date(c.due_date!))
          )),
          blockedCount: affectedDownstream.length,
        },
      });
    }

    // 2. BLOCKED CHAINS - Cards bloqueados por múltiplas dependências
    const heavilyBlocked = activeCards.filter(card => {
      const blockingDeps = dependencies.filter(d => d.dependent_card_id === card.id);
      const activeBlockers = blockingDeps.filter(d => 
        activeCards.some(c => c.id === d.blocking_card_id)
      );
      return activeBlockers.length >= 3;
    });

    if (heavilyBlocked.length > 0) {
      detected.push({
        id: 'blocked-chain',
        type: 'blocked_chain',
        severity: 'high',
        title: 'Cards com Múltiplas Dependências',
        description: `${heavilyBlocked.length} card(s) dependem de 3+ cards não concluídos.`,
        impact: 'Alto risco de atraso por acúmulo de dependências.',
        affectedCards: heavilyBlocked,
        recommendations: [
          { action: 'review_deps', label: 'Revisar necessidade das dependências', priority: 'high' },
          { action: 'parallelize', label: 'Paralelizar tarefas bloqueantes', priority: 'medium' },
        ],
        metrics: {
          avgDependencies: Math.round(
            heavilyBlocked.reduce((sum, card) => {
              const deps = dependencies.filter(d => d.dependent_card_id === card.id);
              return sum + deps.length;
            }, 0) / heavilyBlocked.length
          ),
        },
      });
    }

    // 3. STALE CARDS - Cards parados há muito tempo
    const staleCards = activeCards.filter(card => {
      if (card.status !== 'in_progress') return false;
      const hoursStale = differenceInHours(now, new Date(card.updated_at));
      return hoursStale > 72; // 3 days
    });

    if (staleCards.length > 0) {
      const avgDaysStale = staleCards.reduce((sum, card) => 
        sum + differenceInDays(now, new Date(card.updated_at)), 0
      ) / staleCards.length;

      detected.push({
        id: 'stale-cards',
        type: 'stale',
        severity: avgDaysStale > 7 ? 'high' : 'medium',
        title: 'Cards Estagnados',
        description: `${staleCards.length} card(s) em progresso sem atualização há mais de 3 dias.`,
        impact: 'Possível bloqueio não reportado ou falta de progresso.',
        affectedCards: staleCards,
        recommendations: [
          { action: 'check_status', label: 'Verificar status com responsável', priority: 'high' },
          { action: 'unblock', label: 'Identificar e remover bloqueios', priority: 'medium' },
          { action: 'reassign', label: 'Considerar reatribuição', priority: 'low' },
        ],
        metrics: {
          avgDaysStale: Math.round(avgDaysStale),
        },
      });
    }

    // 4. SINGLE POINT OF FAILURE - Cards que bloqueiam muitos outros
    const singlePoints = activeCards.filter(card => {
      const dependents = dependencies.filter(d => d.blocking_card_id === card.id);
      const activeDependents = dependents.filter(d =>
        activeCards.some(c => c.id === d.dependent_card_id)
      );
      return activeDependents.length >= 3;
    });

    if (singlePoints.length > 0) {
      detected.push({
        id: 'single-point',
        type: 'single_point',
        severity: 'high',
        title: 'Ponto Único de Falha',
        description: `${singlePoints.length} card(s) bloqueiam 3 ou mais outros cards.`,
        impact: 'Atraso em um desses cards impacta múltiplos fluxos de trabalho.',
        affectedCards: singlePoints,
        recommendations: [
          { action: 'prioritize', label: 'Priorizar estes cards', priority: 'high' },
          { action: 'add_resources', label: 'Alocar recursos adicionais', priority: 'high' },
          { action: 'daily_check', label: 'Acompanhamento diário', priority: 'medium' },
        ],
        metrics: {
          totalBlocked: singlePoints.reduce((sum, card) => {
            const deps = dependencies.filter(d => d.blocking_card_id === card.id);
            return sum + deps.length;
          }, 0),
        },
      });
    }

    // 5. OVERLOADED MEMBERS
    const overloadedMembers = memberCapacity.filter(m => m.allocated_hours > 40);
    
    if (overloadedMembers.length > 0) {
      detected.push({
        id: 'overloaded',
        type: 'overloaded',
        severity: overloadedMembers.some(m => m.allocated_hours > 60) ? 'critical' : 'high',
        title: 'Membros Sobrecarregados',
        description: `${overloadedMembers.length} membro(s) com carga acima de 40h/semana.`,
        impact: 'Risco de burnout e atrasos por sobrecarga.',
        affectedCards: [],
        recommendations: [
          { action: 'redistribute', label: 'Redistribuir tarefas', priority: 'high' },
          { action: 'defer', label: 'Adiar cards não urgentes', priority: 'medium' },
          { action: 'hire', label: 'Considerar contratação temporária', priority: 'low' },
        ],
        metrics: {
          maxHours: Math.max(...overloadedMembers.map(m => m.allocated_hours)),
          membersAffected: overloadedMembers.length,
        },
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    detected.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return detected;
  }, [cards, dependencies, memberCapacity]);

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'border-l-red-500 bg-red-500/5',
      high: 'border-l-orange-500 bg-orange-500/5',
      medium: 'border-l-yellow-500 bg-yellow-500/5',
      low: 'border-l-blue-500 bg-blue-500/5',
    };
    return colors[severity] || colors.low;
  };

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, { class: string; label: string }> = {
      critical: { class: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'Crítico' },
      high: { class: 'bg-orange-500/10 text-orange-600 border-orange-500/20', label: 'Alto' },
      medium: { class: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: 'Médio' },
      low: { class: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'Baixo' },
    };
    const c = config[severity] || config.low;
    return <Badge variant="outline" className={c.class}>{c.label}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      overdue: <AlertTriangle className="h-5 w-5 text-red-500" />,
      blocked_chain: <Link2 className="h-5 w-5 text-orange-500" />,
      stale: <TrendingDown className="h-5 w-5 text-yellow-500" />,
      overloaded: <Users className="h-5 w-5 text-purple-500" />,
      single_point: <Zap className="h-5 w-5 text-blue-500" />,
    };
    return icons[type] || <Clock className="h-5 w-5" />;
  };

  const totalAffected = useMemo(() => {
    const cardIds = new Set<string>();
    bottlenecks.forEach(b => b.affectedCards.forEach(c => cardIds.add(c.id)));
    return cardIds.size;
  }, [bottlenecks]);

  const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{bottlenecks.length}</p>
                <p className="text-xs text-muted-foreground">Gargalos detectados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={criticalCount > 0 ? 'border-red-500/50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className={cn("h-5 w-5", criticalCount > 0 ? "text-red-500" : "text-muted-foreground")} />
              <div>
                <p className={cn("text-2xl font-bold", criticalCount > 0 && "text-red-500")}>{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalAffected}</p>
                <p className="text-xs text-muted-foreground">Cards afetados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottleneck List */}
      {bottlenecks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">Fluxo Saudável</p>
            <p className="text-muted-foreground">
              Nenhum gargalo significativo detectado no momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={[bottlenecks[0]?.id]} className="space-y-2">
          {bottlenecks.map((bottleneck) => (
            <AccordionItem 
              key={bottleneck.id} 
              value={bottleneck.id}
              className={cn("border-l-4 rounded-lg", getSeverityColor(bottleneck.severity))}
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  {getTypeIcon(bottleneck.type)}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bottleneck.title}</span>
                      {getSeverityBadge(bottleneck.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground font-normal">
                      {bottleneck.description}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  {/* Impact */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm">
                      <strong>Impacto:</strong> {bottleneck.impact}
                    </p>
                  </div>

                  {/* Metrics */}
                  {bottleneck.metrics && Object.keys(bottleneck.metrics).length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(bottleneck.metrics).map(([key, value]) => (
                        <div key={key} className="px-3 py-1.5 rounded-md bg-muted">
                          <span className="text-xs text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>{' '}
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Affected Cards */}
                  {bottleneck.affectedCards.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Cards Afetados:</p>
                      <div className="flex flex-wrap gap-1">
                        {bottleneck.affectedCards.slice(0, 5).map(card => (
                          <Badge 
                            key={card.id}
                            variant="outline"
                            className="cursor-pointer hover:bg-muted"
                            onClick={() => onCardClick?.(card.id)}
                          >
                            {card.title.length > 30 ? card.title.slice(0, 30) + '...' : card.title}
                          </Badge>
                        ))}
                        {bottleneck.affectedCards.length > 5 && (
                          <Badge variant="secondary">
                            +{bottleneck.affectedCards.length - 5} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Recomendações:
                    </p>
                    <div className="space-y-2">
                      {bottleneck.recommendations.map((rec, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => onActionClick?.(rec.action, { bottleneck, recommendation: rec })}
                        >
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                rec.priority === 'high' && "border-red-500/50 text-red-600",
                                rec.priority === 'medium' && "border-yellow-500/50 text-yellow-600",
                                rec.priority === 'low' && "border-blue-500/50 text-blue-600"
                              )}
                            >
                              {rec.priority === 'high' ? 'Urgente' : rec.priority === 'medium' ? 'Médio' : 'Baixo'}
                            </Badge>
                            <span className="text-sm">{rec.label}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};
