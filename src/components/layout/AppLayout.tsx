import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useLocation, useParams } from 'react-router-dom';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { BadgeProgress } from '@/components/onboarding/BadgeProgress';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { DynamicBreadcrumb } from './DynamicBreadcrumb';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useRealtimeNotifications } from '@/hooks/useRealtimeCards';

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
  
  // Enable global keyboard shortcuts
  useGlobalShortcuts();
  
  // Enable realtime notifications
  useRealtimeNotifications();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
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
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Feedback Widget */}
        <FeedbackWidget />
      </SidebarInset>
    </SidebarProvider>
  );
};
