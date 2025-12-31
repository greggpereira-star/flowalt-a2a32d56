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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto gap-1 p-1">
              <TabsTrigger value="qa-checklist" className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                QA
              </TabsTrigger>
              <TabsTrigger value="workflow" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Workflow
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Tour
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Automações
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileStack className="h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="marketplace" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Marketplace
              </TabsTrigger>
              <TabsTrigger value="connectors" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Conectores
              </TabsTrigger>
              <TabsTrigger value="predictive" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Preditivo
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhooks
              </TabsTrigger>
              <TabsTrigger value="webhook-health" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Saúde
              </TabsTrigger>
              <TabsTrigger value="webhook-dlq" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Replay
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Eventos
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Monitor
              </TabsTrigger>
              <TabsTrigger value="api-metrics" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Métricas
              </TabsTrigger>
              <TabsTrigger value="api-logs" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Sistema
              </TabsTrigger>
              <TabsTrigger value="feature-flags" className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Flags
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Uso
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Auditoria
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Docs
              </TabsTrigger>
              <TabsTrigger value="api-tester" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Tester
              </TabsTrigger>
              <TabsTrigger value="super-admin" className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Admin
              </TabsTrigger>
              <TabsTrigger value="push" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Push
              </TabsTrigger>
              <TabsTrigger value="health" className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4" />
                Health
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Backup
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

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
