import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
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
import { OnboardingSettings } from '@/components/settings/OnboardingSettings';
import { AutomationsManager } from '@/components/settings/AutomationsManager';
import { SystemMonitorPanel } from '@/components/settings/SystemMonitorPanel';
import { FeatureFlagsManager } from '@/components/settings/FeatureFlagsManager';
import { UsageAnalyticsDashboard } from '@/components/analytics/UsageAnalyticsDashboard';
import { TemplateManager } from '@/components/templates/TemplateManager';
import { AuditLogsPanel } from '@/components/settings/AuditLogsPanel';
import { ApiDocsPanel } from '@/components/settings/ApiDocsPanel';
import { ApiTesterPanel } from '@/components/settings/ApiTesterPanel';
import { ApiMetricsDashboard } from '@/components/settings/ApiMetricsDashboard';
import { SuperAdminDashboard } from '@/components/settings/SuperAdminDashboard';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { HealthCheckPanel } from '@/components/settings/HealthCheckPanel';
import { ConfigBackupPanel } from '@/components/settings/ConfigBackupPanel';
import { ConnectorsPanel } from '@/components/settings/ConnectorsPanel';
import { PredictiveSyncPanel } from '@/components/settings/PredictiveSyncPanel';
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';
import { QAChecklist } from '@/components/settings/QAChecklist';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Code, Key, Webhook, BarChart3, Sparkles, Activity, Zap, Monitor, Flag, 
  PieChart, FileStack, Shield, Crown, Bell, HeartPulse, Archive, 
  RotateCcw, Search, Store, Heart, Link2, Brain, Play, TrendingUp, GitBranch,
  ClipboardCheck
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePageTracking } from '@/hooks/usePageTracking';

export default function SettingsPage() {
  usePageTracking('settings');
  const { currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState('onboarding');

  return (
    <AppLayout>
      <Helmet>
        <title>Configurações - API & Webhooks</title>
      </Helmet>
      
      <IntegrationsCommandPalette />
      
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie suas preferências, API, webhooks e integrações
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Pressione <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘</kbd>+<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⇧</kbd>+<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">I</kbd> para ações rápidas
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center px-4 md:px-8 lg:px-12">
            <TabsList className="grid grid-cols-5 sm:grid-cols-10 gap-1 h-auto p-3 bg-muted/50 rounded-xl max-w-5xl w-full">
              <TabsTrigger value="qa-checklist" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <ClipboardCheck className="h-5 w-5" />
                <span className="text-xs font-medium">QA</span>
              </TabsTrigger>
              <TabsTrigger value="workflow" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <GitBranch className="h-5 w-5" />
                <span className="text-xs font-medium">Workflow</span>
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-medium">Tour</span>
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Zap className="h-5 w-5" />
                <span className="text-xs font-medium">Automações</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <FileStack className="h-5 w-5" />
                <span className="text-xs font-medium">Templates</span>
              </TabsTrigger>
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
              <TabsTrigger value="api-keys" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Key className="h-5 w-5" />
                <span className="text-xs font-medium">API</span>
              </TabsTrigger>
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
              <TabsTrigger value="events" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Search className="h-5 w-5" />
                <span className="text-xs font-medium">Eventos</span>
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <BarChart3 className="h-5 w-5" />
                <span className="text-xs font-medium">Monitor</span>
              </TabsTrigger>
              <TabsTrigger value="api-metrics" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs font-medium">Métricas</span>
              </TabsTrigger>
              <TabsTrigger value="api-logs" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Activity className="h-5 w-5" />
                <span className="text-xs font-medium">Logs</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Monitor className="h-5 w-5" />
                <span className="text-xs font-medium">Sistema</span>
              </TabsTrigger>
              <TabsTrigger value="feature-flags" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Flag className="h-5 w-5" />
                <span className="text-xs font-medium">Flags</span>
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <PieChart className="h-5 w-5" />
                <span className="text-xs font-medium">Uso</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Shield className="h-5 w-5" />
                <span className="text-xs font-medium">Auditoria</span>
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Code className="h-5 w-5" />
                <span className="text-xs font-medium">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="api-tester" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Play className="h-5 w-5" />
                <span className="text-xs font-medium">Tester</span>
              </TabsTrigger>
              <TabsTrigger value="super-admin" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Crown className="h-5 w-5" />
                <span className="text-xs font-medium">Admin</span>
              </TabsTrigger>
              <TabsTrigger value="push" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Bell className="h-5 w-5" />
                <span className="text-xs font-medium">Push</span>
              </TabsTrigger>
              <TabsTrigger value="health" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <HeartPulse className="h-5 w-5" />
                <span className="text-xs font-medium">Health</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Archive className="h-5 w-5" />
                <span className="text-xs font-medium">Backup</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="qa-checklist">
            <QAChecklist />
          </TabsContent>

          <TabsContent value="workflow">
            <WorkflowBuilder />
          </TabsContent>

          <TabsContent value="onboarding">
            <OnboardingSettings />
          </TabsContent>

          <TabsContent value="automations">
            <AutomationsManager />
          </TabsContent>

          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>

          <TabsContent value="marketplace">
            <IntegrationMarketplace />
          </TabsContent>

          <TabsContent value="connectors">
            <ConnectorsPanel />
          </TabsContent>

          <TabsContent value="predictive">
            <PredictiveSyncPanel />
          </TabsContent>

          <TabsContent value="api-keys">
            <ApiKeyManager />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhookManager />
          </TabsContent>

          <TabsContent value="webhook-health">
            <WebhookHealthScore />
          </TabsContent>

          <TabsContent value="webhook-dlq">
            <WebhookReplayPanel />
          </TabsContent>

          <TabsContent value="events">
            <EventExplorer />
          </TabsContent>

          <TabsContent value="monitoring">
            <WebhookDashboard />
          </TabsContent>

          <TabsContent value="api-metrics">
            <ApiMetricsDashboard />
          </TabsContent>

          <TabsContent value="api-logs">
            <ApiLogsPanel />
          </TabsContent>

          <TabsContent value="system">
            <SystemMonitorPanel />
          </TabsContent>

          <TabsContent value="feature-flags">
            <FeatureFlagsManager />
          </TabsContent>

          <TabsContent value="usage">
            <UsageAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogsPanel />
          </TabsContent>

          <TabsContent value="docs">
            <ApiDocsPanel />
          </TabsContent>

          <TabsContent value="api-tester">
            <ApiTesterPanel />
          </TabsContent>

          <TabsContent value="super-admin">
            <SuperAdminDashboard />
          </TabsContent>

          <TabsContent value="push">
            <PushNotificationSettings />
          </TabsContent>

          <TabsContent value="health">
            <HealthCheckPanel />
          </TabsContent>

          <TabsContent value="backup">
            <ConfigBackupPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
