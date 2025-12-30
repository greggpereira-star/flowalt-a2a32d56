import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useLocation } from 'react-router-dom';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { BadgeProgress } from '@/components/onboarding/BadgeProgress';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';

interface AppLayoutProps {
  children: React.ReactNode;
}

const routeNames: Record<string, string> = {
  '/': 'Início',
  '/dashboard': 'Dashboard',
  '/tasks': 'Minhas Tarefas',
  '/time': 'Tempo',
  '/calendar': 'Agenda',
  '/coordination': 'Coordenação',
  '/financial': 'Financeiro',
  '/partners': 'Painel dos Sócios',
  '/gamification': 'Gamificação',
  '/analytics': 'Análises',
  '/settings': 'Configurações',
};

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const currentRouteName = routeNames[location.pathname] || 'Página';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Flowalt</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{currentRouteName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-3 px-4">
            <BadgeProgress compact />
            <Separator orientation="vertical" className="h-6" />
            <NotificationCenter />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Feedback Widget */}
        <FeedbackWidget />
      </SidebarInset>
    </SidebarProvider>
  );
};
