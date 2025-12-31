import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
  GitBranch,
  TrendingUp,
  Calendar,
  Zap,
  PieChart,
  Target,
  Brain,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BottleneckCard } from '@/components/coordination/BottleneckCard';
import { BottleneckDetector } from '@/components/coordination/BottleneckDetector';
import { CapacityChart } from '@/components/coordination/CapacityChart';
import { CriticalPathAnalyzer } from '@/components/coordination/CriticalPathAnalyzer';
import { GanttChart } from '@/components/coordination/GanttChart';
import { GanttAdvanced } from '@/components/coordination/GanttAdvanced';
import { DependencyManager } from '@/components/coordination/DependencyManager';
import { SprintManager } from '@/components/coordination/SprintManager';
import { MetricsPanel } from '@/components/coordination/MetricsPanel';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { useMemberCapacity } from '@/hooks/useWorkspaceMembers';
import { useDependencies } from '@/hooks/useDependencies';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { usePageTracking } from '@/hooks/usePageTracking';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';

const CoordinationPage: React.FC = () => {
  usePageTracking('coordination');
  const { currentWorkspace } = useWorkspace();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Fetch all cards for the workspace
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['coordination-cards', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CardType[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: dependencies = [], isLoading: depsLoading } = useDependencies();
  const { data: memberCapacity = [], isLoading: capacityLoading } = useMemberCapacity();

  // Calculate bottlenecks
  const bottlenecks = useMemo(() => {
    if (!cards) return { overdue: [], blocked: [], stale: [], overloaded: [] };

    const now = new Date();

    // Overdue cards
    const overdue: Array<{ id: string; title: string; detail: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = cards
      .filter(c => c.due_date && new Date(c.due_date) < now && c.status !== 'delivered')
      .map(c => {
        const daysOverdue = differenceInDays(now, new Date(c.due_date!));
        return {
          id: c.id,
          title: c.title,
          detail: `${daysOverdue} dias de atraso`,
          severity: (daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium') as 'critical' | 'high' | 'medium',
        };
      })
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    // Blocked cards (cards with dependencies that aren't done)
    const blocked: Array<{ id: string; title: string; detail: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = cards
      .filter(c => {
        const cardDeps = dependencies.filter(d => d.dependent_card_id === c.id);
        if (cardDeps.length === 0) return false;
        
        return cardDeps.some(dep => {
          const blockingCard = cards.find(bc => bc.id === dep.blocking_card_id);
          return blockingCard && blockingCard.status !== 'delivered';
        });
      })
      .map(c => ({
        id: c.id,
        title: c.title,
        detail: 'Aguardando dependência',
        severity: 'medium' as const,
      }));

    // Stale cards (in progress for too long without updates)
    const stale: Array<{ id: string; title: string; detail: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = cards
      .filter(c => {
        if (c.status !== 'in_progress') return false;
        const hoursInProgress = differenceInHours(now, new Date(c.updated_at));
        return hoursInProgress > 48; // More than 48 hours without update
      })
      .map(c => {
        const hoursStale = differenceInHours(now, new Date(c.updated_at));
        const daysStale = Math.floor(hoursStale / 24);
        return {
          id: c.id,
          title: c.title,
          detail: `${daysStale} dias sem atualização`,
          severity: (daysStale > 5 ? 'high' : 'medium') as 'high' | 'medium',
        };
      });

    // Overloaded members
    const overloaded: Array<{ id: string; title: string; detail: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = memberCapacity
      .filter(m => m.allocated_hours > 40)
      .map(m => ({
        id: m.id,
        title: m.name,
        detail: `${m.allocated_hours}h alocadas / ${m.active_cards} cards`,
        severity: (m.allocated_hours > 60 ? 'critical' : 'high') as 'critical' | 'high',
      }));

    return { overdue, blocked, stale, overloaded };
  }, [cards, dependencies, memberCapacity]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    if (!cards) return { total: 0, inProgress: 0, overdue: 0, onTrack: 0 };

    const now = new Date();
    const total = cards.length;
    const inProgress = cards.filter(c => c.status === 'in_progress').length;
    const overdue = cards.filter(c => 
      c.due_date && new Date(c.due_date) < now && c.status !== 'delivered'
    ).length;
    const onTrack = total - overdue;

    return { total, inProgress, overdue, onTrack };
  }, [cards]);

  const isLoading = cardsLoading || depsLoading || capacityLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Coordenação
          </h1>
          <p className="text-muted-foreground">
            Visão geral de gargalos, capacidade e cronograma
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Total de Cards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Em Progresso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics.inProgress}</p>
            </CardContent>
          </Card>

          <Card className={metrics.overdue > 0 ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Atrasados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${metrics.overdue > 0 ? 'text-destructive' : ''}`}>
                {metrics.overdue}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                No Prazo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{metrics.onTrack}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bottlenecks" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="bottlenecks" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Gargalos
            </TabsTrigger>
            <TabsTrigger value="bottleneck-detector" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Detector
            </TabsTrigger>
            <TabsTrigger value="critical-path" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Caminho Crítico
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Métricas
            </TabsTrigger>
            <TabsTrigger value="gantt" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Gantt
            </TabsTrigger>
            <TabsTrigger value="gantt-advanced" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Gantt+
            </TabsTrigger>
            <TabsTrigger value="capacity" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Capacidade
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Dependências
            </TabsTrigger>
            <TabsTrigger value="sprints" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Sprints
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bottlenecks" className="space-y-4">
            {bottlenecks.overdue.length === 0 && 
             bottlenecks.blocked.length === 0 && 
             bottlenecks.stale.length === 0 &&
             bottlenecks.overloaded.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium">Tudo em ordem!</p>
                  <p className="text-muted-foreground">
                    Não há gargalos identificados no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <BottleneckCard
                  title="Cards Atrasados"
                  type="overdue"
                  items={bottlenecks.overdue}
                />
                <BottleneckCard
                  title="Cards Bloqueados"
                  type="blocked"
                  items={bottlenecks.blocked}
                />
                <BottleneckCard
                  title="Cards Estagnados"
                  type="stale"
                  items={bottlenecks.stale}
                />
                <BottleneckCard
                  title="Membros Sobrecarregados"
                  type="overloaded"
                  items={bottlenecks.overloaded}
                  icon={<Users className="h-5 w-5 text-yellow-500" />}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="bottleneck-detector">
            <BottleneckDetector
              cards={cards || []}
              dependencies={dependencies}
              memberCapacity={memberCapacity}
              onCardClick={setSelectedCardId}
            />
          </TabsContent>

          <TabsContent value="critical-path">
            <CriticalPathAnalyzer
              cards={cards || []}
              dependencies={dependencies}
              onCardClick={setSelectedCardId}
            />
          </TabsContent>

          <TabsContent value="metrics">
            <MetricsPanel />
          </TabsContent>

          <TabsContent value="gantt">
            <GanttChart
              cards={cards || []}
              dependencies={dependencies}
              onCardClick={setSelectedCardId}
            />
          </TabsContent>

          <TabsContent value="gantt-advanced">
            <GanttAdvanced
              cards={cards || []}
              dependencies={dependencies}
              onCardClick={setSelectedCardId}
            />
          </TabsContent>

          <TabsContent value="capacity">
            <CapacityChart members={memberCapacity} />
          </TabsContent>

          <TabsContent value="dependencies">
            <DependencyManager 
              cards={cards || []}
              dependencies={dependencies}
              onCardSelect={setSelectedCardId}
            />
          </TabsContent>

          <TabsContent value="sprints">
            <SprintManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Card Detail Sheet */}
      <CardDetailSheet
        cardId={selectedCardId || undefined}
        open={!!selectedCardId}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
      />
    </AppLayout>
  );
};

export default CoordinationPage;
