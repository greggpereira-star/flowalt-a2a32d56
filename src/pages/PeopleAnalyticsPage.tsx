import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Helmet } from 'react-helmet';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LEVEL_CONFIGS } from '@/hooks/useUserLevel';
import { Switch } from '@/components/ui/switch';
import { RankingConfigDialog } from '@/components/people/RankingConfigDialog';
import { formatDistanceToNow } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Award,
  Target,
  BarChart3,
  Activity,
  Zap,
  Download,
  FileSpreadsheet,
  Medal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface MemberStats {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role_label: string;
  participa: boolean;
  cards_completed: number;
  cards_open: number;
  total_hours: number;
  avg_completion_time: number;
  dias_ativos: number;
  comentarios: number;
  movimentacoes: number;
  ultima_atividade: string | null;
  pts_entrega: number;
  pts_constancia: number;
  pts_colaboracao: number;
  pts_horas: number;
  score: number;
  total_score: number; // XP vitalício
  level: number;
  level_name: string;
  level_icon: string;
  level_progress: number;
  badges: number;
}

const STATUS_CONCLUIDO = ['delivered', 'approved'];
const STATUS_ENCERRADO = ['delivered', 'approved', 'archived'];

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function csvCelula(valor: string | number) {
  return `"${String(valor).replace(/"/g, '""')}"`;
}

export default function PeopleAnalyticsPage() {
  usePageTracking('people_analytics');
  const { currentWorkspace } = useWorkspace();
  const startDate = subDays(new Date(), 30);

  // Fetch workspace members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-members-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, function_title, department, is_active')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Nome e foto vêm de profiles (workspace_members.user_id aponta para auth.users,
  // então não dá para embutir profiles na mesma consulta).
  const { data: profiles } = useQuery({
    queryKey: ['profiles-analytics', currentWorkspace?.id, members?.map(m => m.user_id).join(',')],
    queryFn: async () => {
      const ids = (members ?? []).map(m => m.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', ids);
      return data ?? [];
    },
    enabled: !!members && members.length > 0,
  });

  // Papel no workspace (proprietário, admin, membro...) como texto secundário.
  const { data: roles } = useQuery({
    queryKey: ['roles-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('workspace_id', currentWorkspace.id);
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Cards do período, atribuídos pelos RESPONSÁVEIS (card_members), não por quem criou.
  // Entram: criados ou concluídos nos últimos 30 dias, e tudo que ainda está em aberto.
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['cards-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const desde = startDate.toISOString();
      const { data } = await supabase
        .from('cards')
        .select('id, status, created_by, completed_at, created_at, card_members(user_id)')
        .eq('workspace_id', currentWorkspace.id)
        .or(`created_at.gte.${desde},completed_at.gte.${desde},status.not.in.(delivered,approved,archived)`);
      return (data ?? []) as any[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Ranking e XP calculados no banco a partir de atividade real (entregas, constância,
  // colaboração, horas). Ver função get_people_activity.
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['people-activity', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await (supabase as any).rpc('get_people_activity', {
        p_workspace_id: currentWorkspace.id,
        p_days: 30,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { user } = useAuth();
  const pesos = {
    entrega: activity?.[0]?.peso_entrega ?? 50,
    constancia: activity?.[0]?.peso_constancia ?? 20,
    colaboracao: activity?.[0]?.peso_colaboracao ?? 20,
    horas: activity?.[0]?.peso_horas ?? 10,
  };
  const queryClient = useQueryClient();
  const souAdmin = !!roles?.some(r => r.user_id === user?.id && (r.role === 'owner' || r.role === 'admin'));

  const alternarParticipacao = useMutation({
    mutationFn: async ({ userId, incluir }: { userId: string; incluir: boolean }) => {
      const { error } = await (supabase as any)
        .from('people_ranking_participation')
        .upsert(
          { workspace_id: currentWorkspace!.id, user_id: userId, included: incluir, updated_at: new Date().toISOString() },
          { onConflict: 'workspace_id,user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people-activity', currentWorkspace?.id] }),
  });

  const memberStats = useMemo<MemberStats[]>(() => {
    if (!members || !cards || !activity) return [];

    return members.map((member) => {
      const perfil = profiles?.find(p => p.id === member.user_id);
      const nome = perfil?.full_name?.trim() || perfil?.email || 'Membro sem nome';
      const papel = roles?.find(r => r.user_id === member.user_id)?.role;
      const rotuloPapel = member.function_title
        || (papel === 'owner' ? 'Proprietário' : papel === 'admin' ? 'Administrador' : 'Membro');

      const a = activity.find(x => x.user_id === member.user_id);
      const dele = cards.filter(c => (c.card_members ?? []).some((cm: any) => cm.user_id === member.user_id));
      const abertos = dele.filter(c => !STATUS_ENCERRADO.includes(c.status));
      const concluidos = dele.filter(c =>
        STATUS_ENCERRADO.includes(c.status) && c.completed_at && new Date(c.completed_at) >= startDate
      );
      const comTempo = concluidos.filter(c => c.created_at);
      const mediaHoras = comTempo.length > 0
        ? comTempo.reduce((acc, c) =>
            acc + (new Date(c.completed_at).getTime() - new Date(c.created_at).getTime()) / 3600000, 0
          ) / comTempo.length
        : 0;

      const xp = a?.xp ?? 0;
      const levelNum = a?.nivel ?? 1;
      const cfg = LEVEL_CONFIGS.find(c => c.level === levelNum) ?? LEVEL_CONFIGS[0];
      const faixa = (a?.proximo_nivel_xp ?? cfg.maxScore + 1) - cfg.minScore;
      const progresso = faixa > 0 ? Math.min(100, Math.max(0, ((xp - cfg.minScore) / faixa) * 100)) : 0;

      return {
        user_id: member.user_id,
        name: nome,
        avatar_url: perfil?.avatar_url ?? null,
        role_label: rotuloPapel,
        participa: a?.participa ?? true,
        cards_completed: a?.entregas ?? 0,
        cards_open: abertos.length,
        total_hours: Number(a?.horas ?? 0),
        avg_completion_time: Math.round(mediaHoras * 10) / 10,
        dias_ativos: a?.dias_ativos ?? 0,
        comentarios: a?.comentarios ?? 0,
        movimentacoes: a?.movimentacoes ?? 0,
        ultima_atividade: a?.ultima_atividade ?? null,
        pts_entrega: Number(a?.pts_entrega ?? 0),
        pts_constancia: Number(a?.pts_constancia ?? 0),
        pts_colaboracao: Number(a?.pts_colaboracao ?? 0),
        pts_horas: Number(a?.pts_horas ?? 0),
        score: Number(a?.score ?? 0),
        total_score: xp,
        level: levelNum,
        level_name: a?.nivel_nome || cfg.name,
        level_icon: cfg.icon,
        level_progress: progresso,
        badges: a?.medalhas ?? 0,
      };
    }).sort((a, b) =>
      Number(b.participa) - Number(a.participa) || b.score - a.score || b.cards_completed - a.cards_completed
    );
  }, [members, cards, activity, profiles, roles]);

  // Weekly productivity trend
  const weeklyTrend = useMemo(() => {
    if (!cards) return [];
    
    const days = eachDayOfInterval({
      start: startOfWeek(new Date(), { locale: ptBR }),
      end: endOfWeek(new Date(), { locale: ptBR }),
    });

    return days.map(day => {
      const chave = format(day, 'yyyy-MM-dd');
      const created = cards.filter(c => format(parseISO(c.created_at), 'yyyy-MM-dd') === chave).length;
      const completed = cards.filter(c =>
        c.completed_at && STATUS_ENCERRADO.includes(c.status) &&
        format(parseISO(c.completed_at), 'yyyy-MM-dd') === chave
      ).length;

      return {
        day: format(day, 'EEE', { locale: ptBR }),
        date: format(day, 'dd/MM'),
        criados: created,
        concluidos: completed,
      };
    });
  }, [cards]);

  // Distribuição da equipe por cargo/papel (o campo departamento não é preenchido no workspace).
  const departmentDistribution = useMemo(() => {
    const contagem: Record<string, number> = {};
    memberStats.forEach(m => {
      contagem[m.role_label] = (contagem[m.role_label] || 0) + 1;
    });
    return Object.entries(contagem).map(([name, value]) => ({ name, value }));
  }, [memberStats]);

  // Overall stats (só quem participa do ranking)
  const overallStats = useMemo(() => {
    const equipe = memberStats.filter(m => m.participa);
    const totalCompleted = equipe.reduce((acc, m) => acc + m.cards_completed, 0);
    const totalHours = Math.round(equipe.reduce((acc, m) => acc + m.total_hours, 0) * 10) / 10;
    const avgScore = equipe.length > 0
      ? Math.round(equipe.reduce((acc, m) => acc + m.score, 0) / equipe.length)
      : 0;
    const totalBadges = equipe.reduce((acc, m) => acc + m.badges, 0);
    const topPerformer = equipe[0]?.score > 0 ? equipe[0] : undefined;

    return { totalCompleted, totalHours, avgScore, totalBadges, topPerformer, equipe };
  }, [memberStats]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Posição', 'Nome', 'Cargo', 'Score (30 dias)', 'Entrega', 'Constância', 'Colaboração', 'Horas', 'Dias ativos', 'Nível', 'XP', 'Cards Concluídos (30 dias)', 'Cards em Aberto', 'Horas Registradas (30 dias)'];
    const rows = overallStats.equipe.map((m, i) => [
      i + 1,
      m.name,
      m.role_label,
      m.score,
      m.pts_entrega,
      m.pts_constancia,
      m.pts_colaboracao,
      m.pts_horas,
      m.dias_ativos,
      `${m.level} - ${m.level_name}`,
      m.total_score,
      m.cards_completed,
      m.cards_open,
      m.total_hours,
    ]);

    // BOM para o Excel abrir os acentos corretamente.
    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(csvCelula).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `people-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Export to JSON (for Excel import)
  const exportToJSON = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      period: '30 days',
      summary: {
        totalMembers: overallStats.equipe.length,
        totalCardsCompleted: overallStats.totalCompleted,
        totalHoursWorked: overallStats.totalHours,
        avgScore: overallStats.avgScore,
        totalBadges: overallStats.totalBadges,
      },
      members: overallStats.equipe.map(m => ({
        name: m.name,
        role: m.role_label,
        score30d: m.score,
        scoreBreakdown: { entrega: m.pts_entrega, constancia: m.pts_constancia, colaboracao: m.pts_colaboracao, horas: m.pts_horas },
        activeDays: m.dias_ativos,
        level: m.level,
        levelName: m.level_name,
        xp: m.total_score,
        badges: m.badges,
        cardsCompleted: m.cards_completed,
        cardsOpen: m.cards_open,
        hoursWorked: m.total_hours,
        avgCompletionTime: m.avg_completion_time,
      })),
      weeklyTrend,
      departmentDistribution,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `people-analytics-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  const isLoading = membersLoading || cardsLoading || activityLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Helmet>
        <title>People Analytics - Flowalt</title>
      </Helmet>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              People Analytics
            </h1>
            <p className="text-muted-foreground">
              Métricas de produtividade e desempenho da equipe
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {souAdmin && currentWorkspace?.id && <RankingConfigDialog workspaceId={currentWorkspace.id} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToJSON} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.equipe.length}</div>
              <p className="text-xs text-muted-foreground">na equipe operacional</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cards Concluídos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalCompleted}</div>
              <p className="text-xs text-muted-foreground">últimos 30 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Registradas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalHours}h</div>
              <p className="text-xs text-muted-foreground">com cronômetro, últimos 30 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score Médio da Equipe</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.avgScore}<span className="text-base text-muted-foreground">/100</span></div>
              <Progress value={overallStats.avgScore} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="team" className="space-y-4">
          <TabsList>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Tendências
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Distribuição
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-4">
            {/* Destaque */}
            {overallStats.topPerformer && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Award className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Destaque da Equipe</CardTitle>
                      <CardDescription>Maior score de atividade nos últimos 30 dias</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={overallStats.topPerformer.avatar_url ?? undefined} alt={overallStats.topPerformer.name} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {iniciais(overallStats.topPerformer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{overallStats.topPerformer.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {overallStats.topPerformer.level_icon} Nível {overallStats.topPerformer.level} · {overallStats.topPerformer.level_name}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {overallStats.topPerformer.score}/100
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {overallStats.topPerformer.cards_completed} concluídos · {overallStats.topPerformer.dias_ativos} dias ativos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Team Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Ranking da Equipe
                </CardTitle>
                <CardDescription>
                  Score de 0 a 100 nos últimos 30 dias: entregas {pesos.entrega}%, constância {pesos.constancia}%, colaboração {pesos.colaboracao}% e horas {pesos.horas}%. O XP e o nível acumulam a atividade de todo o período.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {memberStats.map((member) => {
                    const posicao = member.participa ? overallStats.equipe.indexOf(member) + 1 : null;
                    return (
                    <div key={member.user_id} className={`flex items-center gap-2 sm:gap-4 ${member.participa ? '' : 'opacity-60'}`}>
                      <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-muted font-bold text-sm">
                        {posicao ?? '–'}
                      </div>
                      <Avatar>
                        <AvatarImage src={member.avatar_url ?? undefined} alt={member.name} />
                        <AvatarFallback>{iniciais(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.role_label}
                          {member.ultima_atividade && (
                            <> · ativo {formatDistanceToNow(new Date(member.ultima_atividade), { addSuffix: true, locale: ptBR })}</>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{member.cards_completed} concluídos</span>
                          <span>{member.cards_open} em aberto</span>
                          <span>{member.dias_ativos} dias ativos</span>
                          <span>{member.comentarios} comentários</span>
                          <span className="inline-flex items-center gap-1">
                            <Medal className="h-3 w-3" />
                            {member.badges}
                          </span>
                        </div>
                        {member.participa && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Entrega {member.pts_entrega}/{pesos.entrega} · Constância {member.pts_constancia}/{pesos.constancia} · Colaboração {member.pts_colaboracao}/{pesos.colaboracao} · Horas {member.pts_horas}/{pesos.horas}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {member.participa ? (
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={member.score} className="w-12 sm:w-20" />
                            <span className="w-14 text-sm font-semibold tabular-nums">{member.score}/100</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">fora do ranking</span>
                        )}
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {member.level_icon} Nível {member.level}
                          <span className="hidden sm:inline"> · {member.level_name}</span> · {member.total_score.toLocaleString('pt-BR')} XP
                        </p>
                        {souAdmin && (
                          <label className="mt-1 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                            No ranking
                            <Switch
                              checked={member.participa}
                              disabled={alternarParticipacao.isPending}
                              onCheckedChange={(v) => alternarParticipacao.mutate({ userId: member.user_id, incluir: v })}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                    );
                  })}
                  {memberStats.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum membro ativo encontrado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Produtividade Semanal
                </CardTitle>
                <CardDescription>
                  Cards criados vs concluídos esta semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="criados" fill="hsl(var(--muted-foreground))" name="Criados" />
                      <Bar dataKey="concluidos" fill="hsl(var(--primary))" name="Concluídos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Por Cargo</CardTitle>
                  <CardDescription>
                    Distribuição da equipe por cargo ou papel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={departmentDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {departmentDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas Gerais</CardTitle>
                  <CardDescription>
                    Resumo de métricas da equipe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Média de cards/membro</span>
                    <span className="font-bold">
                      {memberStats.length > 0 
                        ? Math.round(overallStats.totalCompleted / Math.max(1, overallStats.equipe.length) * 10) / 10
                        : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Média de horas/membro</span>
                    <span className="font-bold">
                      {memberStats.length > 0 
                        ? Math.round(overallStats.totalHours / Math.max(1, overallStats.equipe.length) * 10) / 10
                        : 0}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tempo médio de conclusão</span>
                    <span className="font-bold">
                      {memberStats.length > 0 
                        ? Math.round(overallStats.equipe.reduce((a, m) => a + m.avg_completion_time, 0) / Math.max(1, overallStats.equipe.length) * 10) / 10
                        : 0}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Membros com score de 70 ou mais</span>
                    <span className="font-bold">
                      {overallStats.equipe.filter(m => m.score >= 70).length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
