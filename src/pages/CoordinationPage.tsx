import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
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
  Activity,
  Heart,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BottleneckCard, type BottleneckItem } from '@/components/coordination/BottleneckCard';
import { BottleneckDetector } from '@/components/coordination/BottleneckDetector';
import { CapacityChart } from '@/components/coordination/CapacityChart';
import { CriticalPathAnalyzer } from '@/components/coordination/CriticalPathAnalyzer';
import { GanttChart } from '@/components/coordination/GanttChart';
import { GanttAdvanced } from '@/components/coordination/GanttAdvanced';
import { DependencyManager } from '@/components/coordination/DependencyManager';
import { SprintManager } from '@/components/coordination/SprintManager';
import { MetricsPanel } from '@/components/coordination/MetricsPanel';
import { WorkflowMetricsPanel } from '@/components/coordination/WorkflowMetricsPanel';
import { ClientMetricsPanel } from '@/components/coordination/ClientMetricsPanel';
import { CapacityPlanner } from '@/components/coordination/CapacityPlanner';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { useMemberCapacity } from '@/hooks/useWorkspaceMembers';
import { useDependencies } from '@/hooks/useDependencies';
import { useCardMemberAssignments } from '@/hooks/useCardMemberAssignments';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { usePageTracking } from '@/hooks/usePageTracking';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';

const CoordinationPage: React.FC = () => {
  usePageTracking('coordination');
  const { currentWorkspace } = useWorkspace();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Fetch all cards for the workspace with space info
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['coordination-cards', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select(`
          *,
          space:spaces(id, name, color)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (cardsError) throw cardsError;

      // Get unique owner IDs to fetch profiles
      const ownerIds = [...new Set(cardsData?.filter(c => c.owner_id).map(c => c.owner_id) || [])];
      
      let profiles: Array<{ id: string; full_name: string | null; avatar_url: string | null }> = [];
      if (ownerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', ownerIds);
        profiles = profilesData || [];
      }

      // Merge profiles with cards
      return (cardsData || []).map(card => ({
        ...card,
        owner: profiles.find(p => p.id === card.owner_id),
      })) as Array<CardType & {
        space?: { id: string; name: string; color: string | null };
        owner?: { id: string; full_name: string | null; avatar_url: string | null };
      }>;
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: dependencies = [], isLoading: depsLoading } = useDependencies();
  const { data: memberCapacity = [], isLoading: capacityLoading } = useMemberCapacity();
  const { data: cardMemberAssignments = [], isLoading: assignmentsLoading } = useCardMemberAssignments();

  // Calculate bottlenecks with space and owner info
  const bottlenecks = useMemo(() => {
    if (!cards) return { overdue: [], blocked: [], stale: [], overloaded: [] };

    const now = new Date();

    // Helper to build bottleneck item with space/owner
    const buildItem = (c: typeof cards[0], detail: string, severity: 'low' | 'medium' | 'high' | 'critical'): BottleneckItem => ({
      id: c.id,
      title: c.title,
      detail,
      severity,
      spaceId: c.space?.id || c.space_id,
      spaceName: c.space?.name,
      spaceColor: c.space?.color || undefined,
      ownerId: c.owner?.id || c.owner_id || undefined,
      ownerName: c.owner?.full_name || undefined,
      ownerAvatar: c.owner?.avatar_url || undefined,
    });

    // Overdue cards
    const overdue: BottleneckItem[] = cards
      .filter(c => c.due_date && new Date(c.due_date) < now && c.status !== 'delivered')
      .map(c => {
        const daysOverdue = differenceInDays(now, new Date(c.due_date!));
        const severity = (daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium') as 'critical' | 'high' | 'medium';
        return buildItem(c, `${daysOverdue} dias de atraso`, severity);
      })
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    // Blocked cards (cards with dependencies that aren't done)
    const blocked: BottleneckItem[] = cards
      .filter(c => {
        const cardDeps = dependencies.filter(d => d.dependent_card_id === c.id);
        if (cardDeps.length === 0) return false;
        
        return cardDeps.some(dep => {
          const blockingCard = cards.find(bc => bc.id === dep.blocking_card_id);
          return blockingCard && blockingCard.status !== 'delivered';
        });
      })
      .map(c => buildItem(c, 'Aguardando dependência', 'medium'));

    // Stale cards (in progress for too long without updates)
    const stale: BottleneckItem[] = cards
      .filter(c => {
        if (c.status !== 'in_progress') return false;
        const hoursInProgress = differenceInHours(now, new Date(c.updated_at));
        return hoursInProgress > 48; // More than 48 hours without update
      })
      .map(c => {
        const hoursStale = differenceInHours(now, new Date(c.updated_at));
        const daysStale = Math.floor(hoursStale / 24);
        const severity = (daysStale > 5 ? 'high' : 'medium') as 'high' | 'medium';
        return buildItem(c, `${daysStale} dias sem atualização`, severity);
      });

    // Overloaded members (these don't have space/owner - they're people)
    const overloaded: BottleneckItem[] = memberCapacity
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

  // Generate capacity data for Gantt chart in required format
  const ganttCapacityData = useMemo(() => {
    if (!memberCapacity.length || !cardMemberAssignments.length || !cards) return [];
    
    const today = new Date();
    const capacityItems: Array<{
      userId: string;
      userName: string;
      date: Date;
      allocatedHours: number;
      capacityHours: number;
    }> = [];

    memberCapacity.forEach(member => {
      // Get cards assigned to this member
      const memberCardIds = cardMemberAssignments
        .filter(a => a.user_id === member.id)
        .map(a => a.card_id);
      
      const memberCards = cards.filter(c => 
        memberCardIds.includes(c.id) && 
        c.status !== 'delivered' && 
        c.status !== 'archived'
      );

      // Calculate daily allocation for the next 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;

        let dailyHours = 0;
        memberCards.forEach(card => {
          const startDate = new Date(card.created_at);
          const endDate = card.due_date ? new Date(card.due_date) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          if (date >= startDate && date <= endDate) {
            const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
            const hoursPerDay = (card.estimated_hours || 4) / totalDays;
            dailyHours += hoursPerDay;
          }
        });

        if (dailyHours > 0) {
          capacityItems.push({
            userId: member.id,
            userName: member.name,
            date,
            allocatedHours: Math.round(dailyHours * 10) / 10,
            capacityHours: 8,
          });
        }
      }
    });

    return capacityItems;
  }, [memberCapacity, cardMemberAssignments, cards]);

  const isLoading = cardsLoading || depsLoading || capacityLoading || assignmentsLoading;

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
    <PermissionGuard permission="canViewCoordination">
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
          <TabsList className="flex h-auto p-3 bg-gradient-to-b from-muted/50 to-muted/30 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm w-full overflow-x-auto">
            <div className="flex gap-2 min-w-max mx-auto">
              <TabsTrigger 
                value="bottlenecks" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Gargalos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="bottleneck-detector" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Brain className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Detector</span>
              </TabsTrigger>
              <TabsTrigger 
                value="critical-path" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Target className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Crítico</span>
              </TabsTrigger>
              <TabsTrigger 
                value="workflow-metrics" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Activity className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Workflow</span>
              </TabsTrigger>
              <TabsTrigger 
                value="metrics" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <PieChart className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Tempo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="gantt" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Calendar className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Gantt</span>
              </TabsTrigger>
              <TabsTrigger 
                value="gantt-advanced" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Calendar className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Gantt+</span>
              </TabsTrigger>
              <TabsTrigger 
                value="capacity" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Users className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Capacidade</span>
              </TabsTrigger>
              <TabsTrigger 
                value="dependencies" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <GitBranch className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Dependências</span>
              </TabsTrigger>
              <TabsTrigger 
                value="sprints" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Zap className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Sprints</span>
              </TabsTrigger>
              <TabsTrigger 
                value="clients" 
                className="flex flex-col items-center gap-1.5 px-4 py-3 h-auto rounded-lg bg-muted/50 hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
              >
                <Heart className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">Clientes</span>
              </TabsTrigger>
            </div>
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
                  onCardClick={setSelectedCardId}
                />
                <BottleneckCard
                  title="Cards Bloqueados"
                  type="blocked"
                  items={bottlenecks.blocked}
                  onCardClick={setSelectedCardId}
                />
                <BottleneckCard
                  title="Cards Estagnados"
                  type="stale"
                  items={bottlenecks.stale}
                  onCardClick={setSelectedCardId}
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

          <TabsContent value="workflow-metrics">
            <WorkflowMetricsPanel />
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
              capacityData={ganttCapacityData}
              showCapacityOverlay={true}
              onCardClick={setSelectedCardId}
            />
          </TabsContent>

          <TabsContent value="capacity">
            <div className="space-y-6">
              <CapacityPlanner
                cards={cards || []}
                members={memberCapacity}
                cardMemberAssignments={cardMemberAssignments}
                onCardClick={setSelectedCardId}
              />
              <CapacityChart members={memberCapacity} />
            </div>
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

          <TabsContent value="clients">
            <ClientMetricsPanel />
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
    </PermissionGuard>
  );
};

export default CoordinationPage;
