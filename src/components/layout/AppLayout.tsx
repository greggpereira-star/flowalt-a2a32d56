import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useLocation, useParams } from 'react-router-dom';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { BadgeProgress } from '@/components/onboarding/BadgeProgress';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { DynamicBreadcrumb } from './DynamicBreadcrumb';
import { OverLimitBanner } from '@/components/billing/OverLimitBanner';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useRealtimeNotifications } from '@/hooks/useRealtimeCards';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  spaceId?: string;
  folderId?: string;
  cardId?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, spaceId, folderId, cardId }) => {
  const location = useLocation();
  const params = useParams();

  // Use params if props not provided
  const effectiveSpaceId = spaceId || params.spaceId;

  // Only Space pages should have fixed viewport + internal scrolling (Kanban area)
  const isSpaceRoute = location.pathname.startsWith('/space/');

  // Enable global keyboard shortcuts
  useGlobalShortcuts();

  // Enable realtime notifications
  useRealtimeNotifications();

  return (
    <SidebarProvider className={cn(isSpaceRoute && 'h-svh overflow-hidden')}>
      <AppSidebar />
      <SidebarInset className={cn(isSpaceRoute && 'h-svh overflow-hidden')}>
        {/* Over Limit Banner - Global */}
        <OverLimitBanner />

        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <DynamicBreadcrumb
              spaceId={effectiveSpaceId}
              folderId={folderId}
              cardId={cardId}
            />
          </div>
          <div className="flex items-center gap-3 px-4">
            <BadgeProgress compact />
            <Separator orientation="vertical" className="h-6" />
            <NotificationCenter />
          </div>
        </header>

        {/* Main Content */}
        <main className={cn('flex-1', isSpaceRoute ? 'min-h-0 overflow-hidden' : 'overflow-auto')}>
          <div className={cn(isSpaceRoute ? 'h-full min-h-0' : undefined)}>{children}</div>
        </main>

        {/* Feedback Widget */}
        <FeedbackWidget />
      </SidebarInset>
    </SidebarProvider>
  );
};
