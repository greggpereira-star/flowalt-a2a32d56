import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';
import { WebhookManager } from '@/components/settings/WebhookManager';
import { WebhookDashboard } from '@/components/settings/WebhookDashboard';
import { WebhookHealthScore } from '@/components/settings/WebhookHealthScore';
import { WebhookReplayPanel } from '@/components/settings/WebhookReplayPanel';
import { EventExplorer } from '@/components/settings/EventExplorer';
import { IntegrationMarketplace } from '@/components/settings/IntegrationMarketplace';
import { IntegrationsCommandPalette } from '@/components/settings/IntegrationsCommandPalette';
import { ApiLogsPanel } from '@/components/settings/ApiLogsPanel';
import { ApiDocsPanel } from '@/components/settings/ApiDocsPanel';
import { ApiTesterPanel } from '@/components/settings/ApiTesterPanel';
import { ApiMetricsDashboard } from '@/components/settings/ApiMetricsDashboard';
import { ConnectorsPanel } from '@/components/settings/ConnectorsPanel';
import { PredictiveSyncPanel } from '@/components/settings/PredictiveSyncPanel';
import { FeatureFlagsManager } from '@/components/settings/FeatureFlagsManager';
import { AuditLogsPanel } from '@/components/settings/AuditLogsPanel';
import { IntegrationsPaywall } from '@/components/billing/IntegrationsPaywall';
import { PlanGate } from '@/components/billing/PlanGate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Key, Webhook, Activity, Flag, Store, Link2, Brain, Play, TrendingUp,
  Heart, RotateCcw, Search, BarChart3, Code, Shield, ShieldX, ArrowLeft
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useHasEntitlement } from '@/hooks/useWorkspacePlan';

const INTEGRATION_TABS = new Set([
  'api-keys',
  'webhooks',
  'webhook-health',
  'webhook-dlq',
  'webhook-monitor',
  'events',
  'api-metrics',
  'api-logs',
  'api-tester',
  'docs',
  'marketplace',
  'connectors',
  'predictive',
  'feature-flags',
  'audit',
]);

// Fallback component for unauthorized access
const UnauthorizedAccess = () => {
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Acesso Restrito</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Você não tem permissão para acessar API & Integrações. 
            Esta área é restrita a administradores e coordenadores.
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Início
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default function IntegrationsPage() {
  usePageTracking('integrations');
  const navigate = useNavigate();
  const { canManageApiKeys, canManageWebhooks, isAdmin, isCoordinator } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Permission check: Owner, Admin, or Coordinator
  const hasAccess = isAdmin || isCoordinator;

  const initialTab = useMemo(() => {
    const tab = searchParams.get('tab');
    return tab && INTEGRATION_TABS.has(tab) ? tab : 'api-keys';
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab !== activeTab) setActiveTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // If user doesn't have access, show unauthorized message
  if (!hasAccess) {
    return (
      <AppLayout>
        <Helmet>
          <title>API & Integrações - Acesso Restrito</title>
        </Helmet>
        <UnauthorizedAccess />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Helmet>
        <title>API & Integrações</title>
      </Helmet>
      
      <IntegrationsCommandPalette />
      
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">API & Integrações</h1>
          <p className="text-muted-foreground">
            Gerencie APIs, webhooks, conectores e integrações externas
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Pressione <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘</kbd>+<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⇧</kbd>+<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">I</kbd> para ações rápidas
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('tab', tab);
              return next;
            });
          }}
          className="space-y-8"
        >
          <div className="flex justify-center px-4 md:px-8 lg:px-12">
            <TabsList className="grid grid-cols-5 sm:grid-cols-8 gap-1 h-auto p-3 bg-muted/50 rounded-xl max-w-4xl w-full">
              {/* API & Keys */}
              <TabsTrigger value="api-keys" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Key className="h-5 w-5" />
                <span className="text-xs font-medium">API Keys</span>
              </TabsTrigger>
              
              {/* Webhooks */}
              <TabsTrigger value="webhooks" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Webhook className="h-5 w-5" />
                <span className="text-xs font-medium">Webhooks</span>
              </TabsTrigger>
              <TabsTrigger value="webhook-health" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Heart className="h-5 w-5" />
                <span className="text-xs font-medium">Saúde</span>
              </TabsTrigger>
              <TabsTrigger value="webhook-dlq" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <RotateCcw className="h-5 w-5" />
                <span className="text-xs font-medium">Replay</span>
              </TabsTrigger>
              <TabsTrigger value="webhook-monitor" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <BarChart3 className="h-5 w-5" />
                <span className="text-xs font-medium">Monitor</span>
              </TabsTrigger>
              
              {/* Events & Logs */}
              <TabsTrigger value="events" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Search className="h-5 w-5" />
                <span className="text-xs font-medium">Eventos</span>
              </TabsTrigger>
              <TabsTrigger value="api-metrics" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs font-medium">Métricas</span>
              </TabsTrigger>
              <TabsTrigger value="api-logs" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Activity className="h-5 w-5" />
                <span className="text-xs font-medium">Logs</span>
              </TabsTrigger>
              
              {/* Tools */}
              <TabsTrigger value="api-tester" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Play className="h-5 w-5" />
                <span className="text-xs font-medium">Tester</span>
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Code className="h-5 w-5" />
                <span className="text-xs font-medium">Docs</span>
              </TabsTrigger>
              
              {/* Integrations */}
              <TabsTrigger value="marketplace" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Store className="h-5 w-5" />
                <span className="text-xs font-medium">Marketplace</span>
              </TabsTrigger>
              <TabsTrigger value="connectors" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Link2 className="h-5 w-5" />
                <span className="text-xs font-medium">Conectores</span>
              </TabsTrigger>
              <TabsTrigger value="predictive" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Brain className="h-5 w-5" />
                <span className="text-xs font-medium">Preditivo</span>
              </TabsTrigger>
              
              {/* Advanced */}
              <TabsTrigger value="feature-flags" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Flag className="h-5 w-5" />
                <span className="text-xs font-medium">Flags</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Shield className="h-5 w-5" />
                <span className="text-xs font-medium">Auditoria</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* API Keys */}
          <TabsContent value="api-keys">
            <ApiKeyManager />
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks">
            <WebhookManager />
          </TabsContent>
          <TabsContent value="webhook-health">
            <WebhookHealthScore />
          </TabsContent>
          <TabsContent value="webhook-dlq">
            <WebhookReplayPanel />
          </TabsContent>
          <TabsContent value="webhook-monitor">
            <WebhookDashboard />
          </TabsContent>

          {/* Events & Logs */}
          <TabsContent value="events">
            <EventExplorer />
          </TabsContent>
          <TabsContent value="api-metrics">
            <ApiMetricsDashboard />
          </TabsContent>
          <TabsContent value="api-logs">
            <ApiLogsPanel />
          </TabsContent>

          {/* Tools */}
          <TabsContent value="api-tester">
            <ApiTesterPanel />
          </TabsContent>
          <TabsContent value="docs">
            <ApiDocsPanel />
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="marketplace">
            <IntegrationMarketplace />
          </TabsContent>
          <TabsContent value="connectors">
            <ConnectorsPanel />
          </TabsContent>
          <TabsContent value="predictive">
            <PredictiveSyncPanel />
          </TabsContent>

          {/* Advanced */}
          <TabsContent value="feature-flags">
            <FeatureFlagsManager />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
