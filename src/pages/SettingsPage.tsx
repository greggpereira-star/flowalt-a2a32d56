import React from 'react';
import { Helmet } from 'react-helmet';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';
import { WebhookManager } from '@/components/settings/WebhookManager';
import { WebhookDashboard } from '@/components/settings/WebhookDashboard';
import { ApiLogsPanel } from '@/components/settings/ApiLogsPanel';
import { OnboardingSettings } from '@/components/settings/OnboardingSettings';
import { AutomationsManager } from '@/components/settings/AutomationsManager';
import { SystemMonitorPanel } from '@/components/settings/SystemMonitorPanel';
import { FeatureFlagsManager } from '@/components/settings/FeatureFlagsManager';
import { UsageAnalyticsDashboard } from '@/components/analytics/UsageAnalyticsDashboard';
import { TemplateManager } from '@/components/templates/TemplateManager';
import { AuditLogsPanel } from '@/components/settings/AuditLogsPanel';
import { ApiDocsPanel } from '@/components/settings/ApiDocsPanel';
import { SuperAdminDashboard } from '@/components/settings/SuperAdminDashboard';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { HealthCheckPanel } from '@/components/settings/HealthCheckPanel';
import { ConfigBackupPanel } from '@/components/settings/ConfigBackupPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Key, Webhook, BarChart3, Sparkles, Activity, Zap, Monitor, Flag, PieChart, FileStack, Shield, Crown, Bell, HeartPulse, Archive } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePageTracking } from '@/hooks/usePageTracking';

export default function SettingsPage() {
  usePageTracking('settings');
  const { currentWorkspace } = useWorkspace();
  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

  return (
    <AppLayout>
      <Helmet>
        <title>Configurações - API & Webhooks</title>
      </Helmet>
      
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie suas preferências, API e integrações
          </p>
        </div>

        <Tabs defaultValue="onboarding" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
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
            <TabsTrigger value="feature-flags" className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Feature Flags
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Uso
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Monitor
            </TabsTrigger>
            <TabsTrigger value="api-logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Sistema
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Docs
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

          <TabsContent value="onboarding">
            <OnboardingSettings />
          </TabsContent>

          <TabsContent value="automations">
            <AutomationsManager />
          </TabsContent>

          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>

          <TabsContent value="feature-flags">
            <FeatureFlagsManager />
          </TabsContent>

          <TabsContent value="usage">
            <UsageAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="api-keys">
            <ApiKeyManager />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhookManager />
          </TabsContent>

          <TabsContent value="monitoring">
            <WebhookDashboard />
          </TabsContent>

          <TabsContent value="api-logs">
            <ApiLogsPanel />
          </TabsContent>

          <TabsContent value="system">
            <SystemMonitorPanel />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogsPanel />
          </TabsContent>

          <TabsContent value="docs">
            <ApiDocsPanel />
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
