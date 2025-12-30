import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Clock, Users, Briefcase, FolderOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(45, 93%, 47%)',
  'hsl(280, 80%, 60%)',
  'hsl(220, 80%, 60%)',
  'hsl(340, 80%, 60%)',
];

export const MetricsPanel: React.FC = () => {
  const { currentWorkspace } = useWorkspace();

  // Fetch time entries with user and card info
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['coordination-metrics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const weekStart = startOfWeek(new Date(), { locale: ptBR });
      const weekEnd = endOfWeek(new Date(), { locale: ptBR });

      // Get time entries for this week
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select(`
          duration_seconds,
          user_id,
          card_id,
          cards!inner(
            id,
            title,
            space_id,
            spaces!inner(id, name, type)
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', weekEnd.toISOString());

      if (timeError) throw timeError;

      // Get workspace members with profiles
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('user_id, function_title, department')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (membersError) throw membersError;

      const memberIds = members?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberIds);

      // Calculate hours by sector (space type)
      const hoursBySector: Record<string, number> = {};
      const hoursByMember: Record<string, { name: string; hours: number; function: string }> = {};
      const hoursBySpace: Record<string, { name: string; hours: number }> = {};

      timeEntries?.forEach(entry => {
        const hours = entry.duration_seconds / 3600;
        const space = entry.cards?.spaces;
        const spaceType = space?.type || 'custom';
        const spaceName = space?.name || 'Sem espaço';

        // By sector
        hoursBySector[spaceType] = (hoursBySector[spaceType] || 0) + hours;

        // By space/project
        hoursBySpace[spaceName] = hoursBySpace[spaceName] || { name: spaceName, hours: 0 };
        hoursBySpace[spaceName].hours += hours;

        // By member
        const profile = profiles?.find(p => p.id === entry.user_id);
        const member = members?.find(m => m.user_id === entry.user_id);
        const memberName = profile?.full_name || profile?.email || 'Desconhecido';
        hoursByMember[entry.user_id] = hoursByMember[entry.user_id] || {
          name: memberName,
          hours: 0,
          function: member?.function_title || 'Sem função',
        };
        hoursByMember[entry.user_id].hours += hours;
      });

      return {
        bySector: Object.entries(hoursBySector).map(([sector, hours]) => ({
          name: getSectorLabel(sector),
          hours: Math.round(hours * 10) / 10,
        })),
        byMember: Object.values(hoursByMember)
          .map(m => ({ ...m, hours: Math.round(m.hours * 10) / 10 }))
          .sort((a, b) => b.hours - a.hours),
        bySpace: Object.values(hoursBySpace)
          .map(s => ({ ...s, hours: Math.round(s.hours * 10) / 10 }))
          .sort((a, b) => b.hours - a.hours),
        totalHours: Math.round(
          (timeEntries?.reduce((acc, e) => acc + e.duration_seconds, 0) || 0) / 3600 * 10
        ) / 10,
      };
    },
    enabled: !!currentWorkspace?.id,
  });

  if (isLoading || !metricsData) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardContent className="h-64 animate-pulse bg-muted" /></Card>
        <Card><CardContent className="h-64 animate-pulse bg-muted" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Semana</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metricsData.totalHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Colaboradores</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metricsData.byMember.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Setores</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metricsData.bySector.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Projetos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metricsData.bySpace.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Hours by Sector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas por Setor</CardTitle>
            <CardDescription>Distribuição de tempo por tipo de espaço</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsData.bySector.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metricsData.bySector}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="hours"
                      nameKey="name"
                    >
                      {metricsData.bySector.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded-lg p-2 shadow-lg">
                            <p className="text-sm font-medium">{data.name}: {data.hours}h</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              {metricsData.bySector.map((sector, i) => (
                <Badge key={sector.name} variant="outline" className="text-xs">
                  <div 
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  {sector.name}: {sector.hours}h
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Hours by Member */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas por Colaborador</CardTitle>
            <CardDescription>Top colaboradores esta semana</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsData.byMember.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metricsData.byMember.slice(0, 5)}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      type="number"
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      width={75}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded-lg p-2 shadow-lg">
                            <p className="text-sm font-medium">{data.name}</p>
                            <p className="text-xs text-muted-foreground">{data.function}</p>
                            <p className="text-sm">{data.hours}h</p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="hours"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hours by Project */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horas por Projeto/Espaço</CardTitle>
          <CardDescription>Tempo investido em cada projeto</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsData.bySpace.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricsData.bySpace.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{data.name}: {data.hours}h</p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="hours"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function getSectorLabel(type: string): string {
  const labels: Record<string, string> = {
    designer: 'Design',
    audiovisual: 'Audiovisual',
    social_media: 'Social Media',
    traffic: 'Tráfego',
    administrative: 'Administrativo',
    coordination: 'Coordenação',
    custom: 'Outros',
  };
  return labels[type] || type;
}
