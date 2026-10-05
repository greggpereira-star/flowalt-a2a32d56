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
import { CARD_STATUS_LABELS } from '@/lib/cards/cardStatusLabels';
import { useStatusLabel } from '@/hooks/useStatusLabel';
import {
  avaliarCards,
  cargaPorPessoa,
  proximosPrazos,
  resumir,
  resumirEtapas,
  type CoordCard,
  type EtapaConfig,
} from '@/lib/coordination/coordMetrics';
import { AtencaoAgora, KpisCoordenacao, PainelEquipe, PainelEtapas, PainelPrazos } from '@/components/coordination/v2/Painel';
import { useSkinNovo } from '@/components/ui/skin-novo';
import { cn } from '@/lib/utils';

const CoordinationPage: React.FC = () => {
  const novo = useSkinNovo();
  const rotuloStatus = useStatusLabel();
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
  // `includeInactive` aqui porque esta tela desenha a coluna de entregues.
  // Sem isso o hook filtra fora os cards delivered/archived, os vinculos
  // somem, e o avatar cai no fallback "?" — a pessoa continua no card, mas
  // a tela mostra um card sem responsavel. O Gantt ja tinha esbarrado nisso.
  const { data: cardMemberAssignments = [], isLoading: assignmentsLoading } = useCardMemberAssignments({ includeInactive: true });

  // Configuração das etapas do fluxo (SLA e limite de WIP de cada uma).
  const { data: etapas = [] } = useQuery({
    queryKey: ['coordination-stages', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_stages')
        .select('slug, name, sort_order, is_final, wip_limit, wip_limit_per_person, sla_warning_hours, sla_critical_hours, workflows!inner(workspace_id)')
        .eq('workflows.workspace_id', currentWorkspace!.id);
      if (error) throw error;
      return (data ?? []) as unknown as EtapaConfig[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60_000,
  });

  const nomes = useMemo(() => new Map(memberCapacity.map(m => [m.id, m.name] as [string, string])), [memberCapacity]);

  // Avaliação única de cada card aberto: atraso, SLA da etapa, parado, sem responsável, sem prazo.
  const painel = useMemo(() => {
    const agora = new Date();
    const avaliados = avaliarCards(
      (cards ?? []) as unknown as CoordCard[],
      cardMemberAssignments.map(a => ({ card_id: a.card_id, user_id: a.user_id })),
      etapas,
      agora,
      new Set(memberCapacity.map(m => m.id))
    );
    return {
      avaliados,
      resumo: resumir(avaliados, agora),
      etapas: resumirEtapas(avaliados, etapas, agora),
      carga: cargaPorPessoa(avaliados, agora),
      proximos: proximosPrazos(avaliados, agora, 30),
    };
  }, [cards, cardMemberAssignments, etapas, memberCapacity]);

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
        <div className={cn('p-6 space-y-6', novo && 'mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 sm:px-8 sm:py-8')}>
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
        <div className={cn('p-6 space-y-6', novo && 'mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 sm:px-8 sm:py-8')}>
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

        <KpisCoordenacao resumo={painel.resumo} />

        <Tabs defaultValue="atencao" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="atencao">Atenção agora</TabsTrigger>
            <TabsTrigger value="etapas">Etapas</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="prazos">Prazos</TabsTrigger>
            <TabsTrigger value="avancado">Avançado</TabsTrigger>
          </TabsList>

          <TabsContent value="atencao">
            <AtencaoAgora avaliados={painel.avaliados} nomes={nomes} onCardClick={setSelectedCardId} />
          </TabsContent>
          <TabsContent value="etapas">
            <PainelEtapas etapas={painel.etapas} />
          </TabsContent>
          <TabsContent value="equipe">
            <PainelEquipe carga={painel.carga} nomes={nomes} />
          </TabsContent>
          <TabsContent value="prazos">
            <PainelPrazos proximos={painel.proximos} nomes={nomes} onCardClick={setSelectedCardId} />
          </TabsContent>

          <TabsContent value="avancado" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Ferramentas de planejamento. Dependências, sprints e caminho crítico só mostram dados depois de cadastrados.
            </p>
        <Tabs defaultValue="bottleneck-detector" className="space-y-4">
          <TabsList className="flex h-auto p-3 bg-gradient-to-b from-muted/50 to-muted/30 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm w-full overflow-x-auto">
            <div className="flex gap-2 min-w-max mx-auto">
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
