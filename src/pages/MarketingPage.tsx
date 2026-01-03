import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileText,
  Plug,
  Sparkles,
  Lock,
} from 'lucide-react';
import { SocialCalendar } from '@/components/social-media/SocialCalendar';
import { PlatformConnector } from '@/components/social-media/PlatformConnector';
import { MetricsDashboard } from '@/components/social-media/MetricsDashboard';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useSocialPosts } from '@/hooks/useSocialPosts';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { useSocialMetrics, formatMetricNumber } from '@/hooks/useSocialMetrics';
import { EntitlementGate } from '@/components/billing/EntitlementGate';
import { AccessDeniedState } from '@/components/governance/AccessDeniedState';

export const MarketingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const { has, isLoading: entitlementsLoading } = useEntitlementRegistry();
  const { data: scheduledPosts } = useSocialPosts({ status: 'scheduled' });
  const { data: publishedPosts } = useSocialPosts({ status: 'published' });
  const { data: platforms } = useSocialPlatforms();
  const { summary, isLoading: metricsLoading } = useSocialMetrics();

  const hasSocialPublish = has('social_publish');
  const hasSocialReports = has('social_reports');
  const hasSocialInsights = has('social_insights_ai');

  if (entitlementsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!hasSocialPublish) {
    return (
      <AccessDeniedState
        type="no_permission"
        title="Módulo de Marketing"
        description="Este módulo está disponível nos planos PRO e Enterprise. Faça upgrade para acessar o calendário editorial, agendamento de posts e métricas de redes sociais."
      />
    );
  }

  const activePlatforms = platforms?.filter(p => p.is_active) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie suas publicações em redes sociais
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">{scheduledPosts?.length || 0} agendados</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{publishedPosts?.length || 0} publicados</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <Plug className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">{activePlatforms.length} plataformas</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="h-12 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendário Editorial
            </TabsTrigger>
            <TabsTrigger
              value="scheduled"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <Clock className="h-4 w-4 mr-2" />
              Agendados
              {scheduledPosts && scheduledPosts.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {scheduledPosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="published"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Publicados
            </TabsTrigger>
            <TabsTrigger
              value="metrics"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Métricas
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
              disabled={!hasSocialInsights}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Insights
              {!hasSocialInsights && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
              disabled={!hasSocialReports}
            >
              <FileText className="h-4 w-4 mr-2" />
              Relatórios
              {!hasSocialReports && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger
              value="platforms"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <Plug className="h-4 w-4 mr-2" />
              Plataformas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="calendar" className="flex-1 m-0">
          <SocialCalendar />
        </TabsContent>

        <TabsContent value="scheduled" className="flex-1 m-0 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Postagens Agendadas
              </CardTitle>
              <CardDescription>
                Visualize e gerencie suas postagens programadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledPosts && scheduledPosts.length > 0 ? (
                <div className="space-y-4">
                  {/* List of scheduled posts */}
                  <p className="text-sm text-muted-foreground">
                    {scheduledPosts.length} postagem(ns) agendada(s)
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma postagem agendada</p>
                  <p className="text-sm mt-1">Use o calendário para agendar suas publicações</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="published" className="flex-1 m-0 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Postagens Publicadas
              </CardTitle>
              <CardDescription>
                Histórico de publicações e suas métricas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publishedPosts && publishedPosts.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {publishedPosts.length} postagem(ns) publicada(s)
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma postagem publicada ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="flex-1 m-0 p-6 overflow-auto">
          <MetricsDashboard />
        </TabsContent>

        <TabsContent value="platforms" className="flex-1 m-0 p-6 overflow-auto">
          <PlatformConnector />
        </TabsContent>

        <TabsContent value="insights" className="flex-1 m-0 p-6">
          {hasSocialInsights ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Insights com IA
                  <Badge className="ml-2">Enterprise</Badge>
                </CardTitle>
                <CardDescription>
                  Análises inteligentes e sugestões baseadas em dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center py-12 text-muted-foreground">
                  Insights serão gerados automaticamente conforme você publica conteúdo
                </p>
              </CardContent>
            </Card>
          ) : (
            <EntitlementGate entitlementKey="social_insights_ai">
              <div />
            </EntitlementGate>
          )}
        </TabsContent>

        <TabsContent value="reports" className="flex-1 m-0 p-6">
          {hasSocialReports ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Relatórios
                  <Badge className="ml-2">Enterprise</Badge>
                </CardTitle>
                <CardDescription>
                  Gere relatórios detalhados por cliente, período e plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center py-12 text-muted-foreground">
                  Gerador de relatórios disponível em breve
                </p>
              </CardContent>
            </Card>
          ) : (
            <EntitlementGate entitlementKey="social_reports">
              <div />
            </EntitlementGate>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketingPage;
