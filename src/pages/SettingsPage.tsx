import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OnboardingSettings } from '@/components/settings/OnboardingSettings';
import { AutomationsManager } from '@/components/settings/AutomationsManager';
import { SystemMonitorPanel } from '@/components/settings/SystemMonitorPanel';
import { UsageAnalyticsDashboard } from '@/components/analytics/UsageAnalyticsDashboard';
import { TemplateManager } from '@/components/templates/TemplateManager';
import { SuperAdminDashboard } from '@/components/settings/SuperAdminDashboard';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { NotificationPreferencesPanel } from '@/components/settings/NotificationPreferencesPanel';
import { HealthCheckPanel } from '@/components/settings/HealthCheckPanel';
import { ConfigBackupPanel } from '@/components/settings/ConfigBackupPanel';
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';
import { QAChecklist } from '@/components/settings/QAChecklist';
import { SpacesManager } from '@/components/settings/SpacesManager';
import { WorkspaceMembersPanel } from '@/components/settings/WorkspaceMembersPanel';
import { WorkspaceInvitesPanel } from '@/components/settings/WorkspaceInvitesPanel';
import { GovernancePanel } from '@/components/settings/GovernancePanel';
import { SpaceAccessControl } from '@/components/settings/SpaceAccessControl';
import { BirthdaySettings } from '@/components/notices/BirthdaySettings';
import { HolidayCelebrationDemo } from '@/components/notices/HolidayCelebrationDemo';
import { NoticesManager } from '@/components/notices/NoticesManager';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Zap, Monitor, PieChart, FileStack, Shield, Crown, Bell, 
  HeartPulse, Archive, GitBranch, ClipboardCheck, FolderKanban, Users, 
  UserPlus, ShieldX, ArrowLeft, CreditCard, User, PartyPopper, Megaphone, Mail
} from 'lucide-react';
import { BillingPlanPage } from '@/components/billing/BillingPlanPage';
import { usePermissions } from '@/hooks/usePermissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePageTracking } from '@/hooks/usePageTracking';

const SETTINGS_TABS = new Set([
  'profile',
  'members',
  'invites',
  'governance',
  'space-access',
  'spaces',
  'billing',
  'qa-checklist',
  'workflow',
  'onboarding',
  'automations',
  'templates',
  'push',
  'email-notifications',
  'health',
  'backup',
  'system',
  'usage',
  'super-admin',
  'celebrations',
  'notices',
]);

// Redirects for old integration tabs -> new /integrations page
const LEGACY_REDIRECTS: Record<string, string> = {
  'api-keys': '/integrations?tab=api-keys',
  'webhooks': '/integrations?tab=webhooks',
  'webhook-health': '/integrations?tab=webhook-health',
  'webhook-dlq': '/integrations?tab=webhook-dlq',
  'monitoring': '/integrations?tab=webhook-monitor',
  'events': '/integrations?tab=events',
  'api-metrics': '/integrations?tab=api-metrics',
  'api-logs': '/integrations?tab=api-logs',
  'api-tester': '/integrations?tab=api-tester',
  'docs': '/integrations?tab=docs',
  'marketplace': '/integrations?tab=marketplace',
  'connectors': '/integrations?tab=connectors',
  'predictive': '/integrations?tab=predictive',
  'feature-flags': '/integrations?tab=feature-flags',
  'audit': '/integrations?tab=audit',
};

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
            Você não tem permissão para acessar as Configurações do Workspace. 
            Entre em contato com o administrador se precisar de acesso.
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

export default function SettingsPage() {
  usePageTracking('settings');
  const navigate = useNavigate();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { canManageWorkspace, canViewSettings, isAdmin, isCoordinator, isSuperAdmin } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if user has basic settings access - but only after workspace context is ready
  // When workspace is loading, permissions will be false, so we need to wait
  const hasAccess = workspaceLoading || canViewSettings || isAdmin || isCoordinator;

  const initialTab = useMemo(() => {
    const tab = searchParams.get('tab');
    
    // Handle legacy redirects for integration tabs
    if (tab && LEGACY_REDIRECTS[tab]) {
      return null; // Will trigger redirect in useEffect
    }
    
    return tab && SETTINGS_TABS.has(tab) ? tab : 'profile';
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState(initialTab || 'profile');

  useEffect(() => {
    const tab = searchParams.get('tab');
    
    // Handle legacy redirects
    if (tab && LEGACY_REDIRECTS[tab]) {
      navigate(LEGACY_REDIRECTS[tab], { replace: true });
      return;
    }
    
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, searchParams]);

  // If user doesn't have access, show unauthorized message
  if (!hasAccess) {
    return (
      <AppLayout>
        <Helmet>
          <title>Configurações - Acesso Restrito</title>
        </Helmet>
        <UnauthorizedAccess />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Helmet>
        <title>Configurações do Workspace</title>
      </Helmet>
      
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações do Workspace</h1>
          <p className="text-muted-foreground">
            Gerencie membros, governança, espaços e configurações operacionais
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
            <TabsList className="grid grid-cols-4 sm:grid-cols-8 gap-1 h-auto p-3 bg-muted/50 rounded-xl max-w-4xl w-full">
              {/* User Profile - Always visible */}
              <TabsTrigger value="profile" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <User className="h-5 w-5" />
                <span className="text-xs font-medium">Perfil</span>
              </TabsTrigger>
              
              {/* Workspace Management - Admin only */}
              {canManageWorkspace && (
                <>
                  <TabsTrigger value="members" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <Users className="h-5 w-5" />
                    <span className="text-xs font-medium">Membros</span>
                  </TabsTrigger>
                  <TabsTrigger value="invites" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <UserPlus className="h-5 w-5" />
                    <span className="text-xs font-medium">Convites</span>
                  </TabsTrigger>
                  <TabsTrigger value="governance" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <Shield className="h-5 w-5" />
                    <span className="text-xs font-medium">Governança</span>
                  </TabsTrigger>
                  <TabsTrigger value="space-access" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <FolderKanban className="h-5 w-5" />
                    <span className="text-xs font-medium">Acessos</span>
                  </TabsTrigger>
                  <TabsTrigger value="spaces" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <FolderKanban className="h-5 w-5" />
                    <span className="text-xs font-medium">Espaços</span>
                  </TabsTrigger>
                </>
              )}
              
              {/* Operations */}
              <TabsTrigger value="workflow" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <GitBranch className="h-5 w-5" />
                <span className="text-xs font-medium">Workflow</span>
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Zap className="h-5 w-5" />
                <span className="text-xs font-medium">Automações</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <FileStack className="h-5 w-5" />
                <span className="text-xs font-medium">Templates</span>
              </TabsTrigger>
              
              {/* User preferences */}
              <TabsTrigger value="onboarding" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-medium">Tour</span>
              </TabsTrigger>
              <TabsTrigger value="push" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Bell className="h-5 w-5" />
                <span className="text-xs font-medium">Push</span>
              </TabsTrigger>
              <TabsTrigger value="email-notifications" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <Mail className="h-5 w-5" />
                <span className="text-xs font-medium">E-mails</span>
              </TabsTrigger>
              <TabsTrigger value="celebrations" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                <PartyPopper className="h-5 w-5" />
                <span className="text-xs font-medium">Celebrações</span>
              </TabsTrigger>
              
              {/* Admin: Notices Manager */}
              {canManageWorkspace && (
                <TabsTrigger value="notices" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                  <Megaphone className="h-5 w-5" />
                  <span className="text-xs font-medium">Avisos</span>
                </TabsTrigger>
              )}
              
              {/* System - Admin only */}
              {canManageWorkspace && (
                <>
                  <TabsTrigger value="qa-checklist" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <ClipboardCheck className="h-5 w-5" />
                    <span className="text-xs font-medium">QA</span>
                  </TabsTrigger>
                  <TabsTrigger value="health" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <HeartPulse className="h-5 w-5" />
                    <span className="text-xs font-medium">Health</span>
                  </TabsTrigger>
                  <TabsTrigger value="backup" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <Archive className="h-5 w-5" />
                    <span className="text-xs font-medium">Backup</span>
                  </TabsTrigger>
                  <TabsTrigger value="system" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <Monitor className="h-5 w-5" />
                    <span className="text-xs font-medium">Sistema</span>
                  </TabsTrigger>
                  <TabsTrigger value="usage" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <PieChart className="h-5 w-5" />
                    <span className="text-xs font-medium">Uso</span>
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                    <CreditCard className="h-5 w-5" />
                    <span className="text-xs font-medium">Plano</span>
                  </TabsTrigger>
                </>
              )}
              
              {/* Super Admin */}
              {isSuperAdmin && (
                <TabsTrigger value="super-admin" className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
                  <Crown className="h-5 w-5" />
                  <span className="text-xs font-medium">Admin</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* User Profile */}
          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>

          {/* Workspace Management */}
          <TabsContent value="members">
            <WorkspaceMembersPanel />
          </TabsContent>
          <TabsContent value="invites">
            <WorkspaceInvitesPanel />
          </TabsContent>
          <TabsContent value="governance">
            <GovernancePanel />
          </TabsContent>
          <TabsContent value="space-access">
            <SpaceAccessControl />
          </TabsContent>
          <TabsContent value="spaces">
            <SpacesManager />
          </TabsContent>

          {/* Operations */}
          <TabsContent value="workflow">
            <WorkflowBuilder />
          </TabsContent>
          <TabsContent value="automations">
            <AutomationsManager />
          </TabsContent>
          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>

          {/* User preferences */}
          <TabsContent value="onboarding">
            <OnboardingSettings />
          </TabsContent>
          <TabsContent value="push">
            <PushNotificationSettings />
          </TabsContent>
          <TabsContent value="email-notifications">
            <NotificationPreferencesPanel />
          </TabsContent>
          <TabsContent value="celebrations">
            <HolidayCelebrationDemo />
          </TabsContent>
          <TabsContent value="notices">
            <NoticesManager />
          </TabsContent>

          {/* System */}
          <TabsContent value="qa-checklist">
            <QAChecklist />
          </TabsContent>
          <TabsContent value="health">
            <HealthCheckPanel />
          </TabsContent>
          <TabsContent value="backup">
            <ConfigBackupPanel />
          </TabsContent>
          <TabsContent value="system">
            <SystemMonitorPanel />
          </TabsContent>
          <TabsContent value="usage">
            <UsageAnalyticsDashboard />
          </TabsContent>
          <TabsContent value="billing">
            <BillingPlanPage />
          </TabsContent>

          {/* Super Admin */}
          <TabsContent value="super-admin">
            <SuperAdminDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
