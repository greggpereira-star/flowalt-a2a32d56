import React, { createContext, lazy, Suspense, useContext, useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useLocation, useParams } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { DynamicBreadcrumb } from './DynamicBreadcrumb';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useRealtimeNotifications } from '@/hooks/useRealtimeCards';
import { cn } from '@/lib/utils';

const UnifiedAlertsCenter = lazy(() => import('@/components/notifications/UnifiedAlertsCenter').then(module => ({ default: module.UnifiedAlertsCenter })));
const NotificationToast = lazy(() => import('@/components/notifications/NotificationToast').then(module => ({ default: module.NotificationToast })));
const MyBirthdayCelebration = lazy(() => import('@/components/notices/MyBirthdayCelebration').then(module => ({ default: module.MyBirthdayCelebration })));
const BadgeProgress = lazy(() => import('@/components/onboarding/BadgeProgress').then(module => ({ default: module.BadgeProgress })));
const FeedbackWidget = lazy(() => import('@/components/feedback/FeedbackWidget').then(module => ({ default: module.FeedbackWidget })));
const OverLimitBanner = lazy(() => import('@/components/billing/OverLimitBanner').then(module => ({ default: module.OverLimitBanner })));
const GlobalModals = lazy(() => import('./GlobalModals').then(module => ({ default: module.GlobalModals })));

const DeferredMount: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 1200 }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  if (!ready) return null;

  return <>{children}</>;
};

const DeferredLayoutTools: React.FC = () => {
  return (
    <DeferredMount delay={1800}>
      <Suspense fallback={null}>
        <FeedbackWidget />
        <NotificationToast />
        <MyBirthdayCelebration />
        <GlobalModals />
      </Suspense>
    </DeferredMount>
  );
};

// Context to detect nested AppLayout (route already wraps in one via ProtectedLayout).
// Prevents duplicated headers/breadcrumb/sidebar in pages that still import <AppLayout>.
const AppLayoutContext = createContext(false);


interface AppLayoutProps {
  children: React.ReactNode;
  spaceId?: string;
  folderId?: string;
  cardId?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, spaceId, folderId, cardId }) => {
  const location = useLocation();
  const params = useParams();
  const searchParams = new URLSearchParams(location.search);
  const alreadyInsideLayout = useContext(AppLayoutContext);

  // Use params or searchParams if props not provided
  const effectiveSpaceId = spaceId || params.spaceId;
  const effectiveFolderId = folderId || searchParams.get('folder');
  const effectiveCardId = cardId || searchParams.get('card');


  // Only Space pages should have fixed viewport + internal scrolling (Kanban area)
  const isSpaceRoute = location.pathname.startsWith('/space/');

  // Enable global keyboard shortcuts
  useGlobalShortcuts();

  // Enable realtime notifications
  useRealtimeNotifications();

  // If a parent already rendered AppLayout (ProtectedLayout does), just render children.
  // Avoids duplicated sidebar, header, breadcrumb and the extra top spacing.
  if (alreadyInsideLayout) {
    return <>{children}</>;
  }

  return (
    <AppLayoutContext.Provider value={true}>
    <SidebarProvider className={cn(isSpaceRoute && 'h-svh overflow-hidden')}>
      <AppSidebar />
      <SidebarInset className={cn(isSpaceRoute && 'h-svh overflow-hidden')}>
        {/* Over Limit Banner - Global */}
        <DeferredMount delay={2200}>
          <Suspense fallback={null}>
            <OverLimitBanner />
          </Suspense>
        </DeferredMount>

        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 px-4 min-w-0">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4 hidden sm:block" />
            <div className="hidden sm:block truncate">
              <DynamicBreadcrumb
                spaceId={effectiveSpaceId}
                folderId={effectiveFolderId || undefined}
                cardId={effectiveCardId || undefined}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 shrink-0">
            <div className="hidden md:flex items-center gap-2">
              <DeferredMount delay={2200}>
                <Suspense fallback={null}>
                  <BadgeProgress compact />
                </Suspense>
              </DeferredMount>
              <Separator orientation="vertical" className="h-6" />
            </div>
            <ThemeToggle />
            <DeferredMount delay={2200}>
              <Suspense fallback={null}>
                <UnifiedAlertsCenter />
              </Suspense>
            </DeferredMount>
          </div>
        </header>

        {/* Main Content */}
        <main className={cn('flex-1', isSpaceRoute ? 'min-h-0 overflow-hidden' : 'overflow-auto')}>
          <div className={cn(isSpaceRoute ? 'h-full min-h-0' : undefined)}>{children}</div>
        </main>

        <DeferredLayoutTools />
      </SidebarInset>

    </SidebarProvider>
    </AppLayoutContext.Provider>
  );
};
