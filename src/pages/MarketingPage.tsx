import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Calendar,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileText,
  Plug,
  Sparkles,
  Lock,
  Plus,
  Activity,
  ArrowLeft,
  Home,
  Wifi,
  AlertCircle,
} from 'lucide-react';
import { SocialCalendar } from '@/components/social-media/SocialCalendar';
import { PlatformConnector } from '@/components/social-media/PlatformConnector';
import { MetricsDashboard } from '@/components/social-media/MetricsDashboard';
import { PostList } from '@/components/social-media/PostList';
import { SocialJobsPanel } from '@/components/social-media/SocialJobsPanel';
import { SocialReportsPage } from '@/components/social-media/SocialReportsPage';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { EntitlementGate } from '@/components/billing/EntitlementGate';
import { AccessDeniedState } from '@/components/governance/AccessDeniedState';
import { CreateSocialPostDialog } from '@/components/social-media/CreateSocialPostDialog';
import { useRealtimeSocialPosts } from '@/hooks/useRealtimeSocialPosts';
import { useRealtimeSocialJobs } from '@/hooks/useRealtimeSocialJobs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function MarketingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('calendar');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const { has, isLoading: entitlementsLoading, entitlements } = useEntitlementRegistry();
  
  // Use realtime hooks for live updates
  const { posts: scheduledPosts, realtimeStatus: postsRealtimeStatus } = useRealtimeSocialPosts({ status: 'scheduled' });
  const { posts: publishedPosts } = useRealtimeSocialPosts({ status: 'published' });
  const { posts: draftPosts } = useRealtimeSocialPosts({ status: 'draft' });
  const { posts: failedPosts } = useRealtimeSocialPosts({ status: 'failed' });
  const { jobStats, realtimeStatus: jobsRealtimeStatus } = useRealtimeSocialJobs();
  const { data: platforms } = useSocialPlatforms();

  const hasSocialPublish = has('social_publish');
  const hasSocialReports = has('social_reports');
  const hasSocialInsights = has('social_insights_ai');

  // CRITICAL: Wait for both workspace context AND entitlements to fully load
  // This prevents false "no permission" screen during OAuth callback redirects
  // The entitlements array being empty/undefined means the query hasn't completed yet
  const isFullyLoaded = !entitlementsLoading && entitlements && entitlements.length > 0;

  if (!isFullyLoaded) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!hasSocialPublish) {
    return (
      <AppLayout>
        <AccessDeniedState
          type="no_permission"
          title="Módulo de Marketing"
          description="Este módulo está disponível nos planos PRO e Enterprise. Faça upgrade para acessar o calendário editorial, agendamento de posts e métricas de redes sociais."
        />
      </AppLayout>
    );
  }

  const activePlatforms = platforms?.filter(p => p.is_active) || [];

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4">
            {/* Back Navigation */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <Home className="h-4 w-4" />
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Marketing
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Central de comando para redes sociais
              </p>
            </div>
          </div>

        {/* Quick Stats & Actions with Realtime Indicator */}
        <div className="flex items-center gap-4">
          {/* Realtime Status */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
                  postsRealtimeStatus === 'connected' && "bg-green-100 text-green-700",
                  postsRealtimeStatus === 'connecting' && "bg-amber-100 text-amber-700",
                  postsRealtimeStatus === 'disconnected' && "bg-red-100 text-red-700"
                )}>
                  <Wifi className="h-3 w-3" />
                  {postsRealtimeStatus === 'connected' ? 'Ao vivo' : 
                   postsRealtimeStatus === 'connecting' ? '...' : 'Offline'}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {postsRealtimeStatus === 'connected' 
                    ? 'Dados sincronizados em tempo real' 
                    : postsRealtimeStatus === 'connecting'
                      ? 'Conectando ao servidor...'
                      : 'Conexão perdida - atualize a página'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">{scheduledPosts?.length || 0} agendados</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{publishedPosts?.length || 0} publicados</span>
          </div>
          {(failedPosts?.length || 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">{failedPosts?.length || 0} com erro</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <Plug className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">{activePlatforms.length} plataformas</span>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Postagem
          </Button>
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
            <TabsTrigger
              value="jobs"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <Activity className="h-4 w-4 mr-2" />
              Jobs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="calendar" className="flex-1 m-0">
          <SocialCalendar />
        </TabsContent>

        <TabsContent value="scheduled" className="flex-1 m-0 p-6 overflow-auto">
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
              <PostList 
                posts={scheduledPosts || []} 
                onEdit={(postId) => setEditPostId(postId)}
                emptyMessage="Nenhuma postagem agendada. Use o calendário ou clique em 'Novo Post' para agendar."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="published" className="flex-1 m-0 p-6 overflow-auto">
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
              <PostList 
                posts={publishedPosts || []} 
                showActions={false}
                emptyMessage="Nenhuma postagem publicada ainda"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="flex-1 m-0 p-6 overflow-auto">
          <MetricsDashboard />
        </TabsContent>

        <TabsContent value="platforms" className="flex-1 m-0 p-6 overflow-auto">
          <PlatformConnector />
        </TabsContent>

        <TabsContent value="jobs" className="flex-1 m-0 p-6 overflow-auto">
          <SocialJobsPanel />
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

        <TabsContent value="reports" className="flex-1 m-0 p-6 overflow-auto">
          {hasSocialReports ? (
            <SocialReportsPage />
          ) : (
            <EntitlementGate entitlementKey="social_reports">
              <div />
            </EntitlementGate>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Post Dialog */}
      <CreateSocialPostDialog
        open={isCreateDialogOpen || !!editPostId}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditPostId(null);
          }
        }}
        editPostId={editPostId || undefined}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          setEditPostId(null);
        }}
      />
    </div>
    </AppLayout>
  );
}

export default MarketingPage;
