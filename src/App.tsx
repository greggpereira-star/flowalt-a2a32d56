import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { GlobalModalProvider } from "@/contexts/GlobalModalContext";

import { AppLayout } from "@/components/layout/AppLayout";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const NewWorkspace = lazy(() => import("./pages/NewWorkspace"));
const SpacePage = lazy(() => import("./pages/SpacePage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const TimePage = lazy(() => import("./pages/TimePage"));
const CoordinationPage = lazy(() => import("./pages/CoordinationPage"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const FinancialPage = lazy(() => import("./pages/FinancialPage"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const GamificationPage = lazy(() => import("./pages/GamificationPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const PeopleAnalyticsPage = lazy(() => import("./pages/PeopleAnalyticsPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const PluggyOAuthCallback = lazy(() => import("./pages/PluggyOAuthCallback"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const FirstAccessPage = lazy(() => import("./pages/FirstAccessPage"));
const PlatformAdminPage = lazy(() => import("./pages/PlatformAdminPage"));
const SecurityAuditPage = lazy(() => import("./pages/SecurityAuditPage"));
const MarketingPage = lazy(() => import("./pages/MarketingPage"));
const OAuthBridgePage = lazy(() => import("./pages/OAuthBridgePage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const DataDeletionPage = lazy(() => import("./pages/DataDeletionPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const BirthdaysPage = lazy(() => import("./pages/BirthdaysPage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const IdeasBankPage = lazy(() => import("./pages/IdeasBankPage"));
const PublicBoardPage = lazy(() => import("./pages/PublicBoardPage"));
const PublicProposalPage = lazy(() => import("./pages/PublicProposalPage"));
const AltControlPage = lazy(() => import("./pages/altcontrol/AltControlPage").then(module => ({ default: module.AltControlPage })));
const NewProposalPage = lazy(() => import("./pages/altcontrol/NewProposalPage").then(module => ({ default: module.NewProposalPage })));
const ProposalGeneratorPage = lazy(() => import("./pages/altcontrol/ProposalGeneratorPage"));
const ProposalDetailPage = lazy(() => import("./pages/altcontrol/ProposalDetailPage").then(module => ({ default: module.ProposalDetailPage })));
const ApprovalDetailPage = lazy(() => import("./pages/altcontrol/ApprovalDetailPage").then(module => ({ default: module.ApprovalDetailPage })));
const ContractDetailPage = lazy(() => import("./pages/altcontrol/ContractDetailPage").then(module => ({ default: module.ContractDetailPage })));

const OnboardingTour = lazy(() => import("@/components/onboarding/OnboardingTour").then(module => ({ default: module.OnboardingTour })));
const CommandPalette = lazy(() => import("@/components/command/CommandPalette").then(module => ({ default: module.CommandPalette })));
const KeyboardShortcutsDialog = lazy(() => import("@/components/command/KeyboardShortcutsDialog").then(module => ({ default: module.KeyboardShortcutsDialog })));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const ProtectedLayout = () => (
  <AuthGuard>
    <AppLayout>
      <Outlet />
    </AppLayout>
  </AuthGuard>
);

// Helper component to ensure tools are only rendered when authenticated
const ConditionalTools = () => {
  const { session, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !session) {
      setReady(false);
      return;
    }

    const timer = window.setTimeout(() => setReady(true), 1800);
    return () => window.clearTimeout(timer);
  }, [loading, session]);
  
  if (loading || !session || !ready) return null;

  return (
    <Suspense fallback={null}>
      <OnboardingTour />
      <CommandPalette />
      <KeyboardShortcutsDialog />
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <GlobalModalProvider>
              <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/data-deletion" element={<DataDeletionPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/invite/:token" element={<AcceptInvitePage />} />
                <Route path="/pluggy/oauth/callback" element={<PluggyOAuthCallback />} />
                <Route path="/share/board/:token" element={<PublicBoardPage />} />
                <Route path="/p/:token" element={<PublicProposalPage />} />
                
                
                {/* Protected Routes with shared AppLayout */}
                <Route element={<ProtectedLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/complete-profile" element={<CompleteProfilePage />} />
                  <Route path="/oauth/bridge" element={<OAuthBridgePage />} />
                  <Route path="/first-access" element={<FirstAccessPage />} />
                  <Route path="/platform" element={<PlatformAdminPage />} />
                  <Route path="/security-audit" element={<SecurityAuditPage />} />
                  <Route path="/workspace/new" element={<NewWorkspace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/time" element={<TimePage />} />
                  <Route path="/coordination" element={<CoordinationPage />} />
                  <Route path="/calendar" element={<AgendaPage />} />
                  <Route path="/financial" element={<FinancialPage />} />
                  <Route path="/partners" element={<PartnersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/gamification" element={<GamificationPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/people-analytics" element={<PeopleAnalyticsPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/:clientId" element={<ClientsPage />} />
                  <Route path="/space/:spaceId" element={<SpacePage />} />
                  <Route path="/marketing" element={<MarketingPage />} />
                  <Route path="/birthdays" element={<BirthdaysPage />} />
                  <Route path="/ideas" element={<IdeasBankPage />} />
                  <Route path="/altcontrol/*" element={<AltControlPage />} />
                  <Route path="/altcontrol/proposals/new" element={<NewProposalPage />} />
                  <Route path="/altcontrol/proposals/generator" element={<ProposalGeneratorPage />} />
                  <Route path="/altcontrol/proposals/generator/:docId" element={<ProposalGeneratorPage />} />
                  <Route path="/altcontrol/proposals/:proposalId" element={<ProposalDetailPage />} />
                  <Route path="/altcontrol/approvals/:proposalId" element={<ApprovalDetailPage />} />
                  <Route path="/altcontrol/contracts/:contractId" element={<ContractDetailPage />} />
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>

              <ConditionalTools />
            </GlobalModalProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;