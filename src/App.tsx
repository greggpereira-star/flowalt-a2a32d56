import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { CommandPalette } from "@/components/command/CommandPalette";
import { KeyboardShortcutsDialog } from "@/components/command/KeyboardShortcutsDialog";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NewWorkspace from "./pages/NewWorkspace";
import SpacePage from "./pages/SpacePage";
import Dashboard from "./pages/Dashboard";
import TasksPage from "./pages/TasksPage";
import TimePage from "./pages/TimePage";
import CoordinationPage from "./pages/CoordinationPage";
import AgendaPage from "./pages/AgendaPage";
import FinancialPage from "./pages/FinancialPage";
import PartnersPage from "./pages/PartnersPage";
import SettingsPage from "./pages/SettingsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import GamificationPage from "./pages/GamificationPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import PeopleAnalyticsPage from "./pages/PeopleAnalyticsPage";
import ClientsPage from "./pages/ClientsPage";
import PluggyOAuthCallback from "./pages/PluggyOAuthCallback";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import FirstAccessPage from "./pages/FirstAccessPage";
import PlatformAdminPage from "./pages/PlatformAdminPage";
import SecurityAuditPage from "./pages/SecurityAuditPage";
import MarketingPage from "./pages/MarketingPage";
import OAuthBridgePage from "./pages/OAuthBridgePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import DataDeletionPage from "./pages/DataDeletionPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import BirthdaysPage from "./pages/BirthdaysPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import { AltControlPage } from "./pages/altcontrol/AltControlPage";
import { NewProposalPage } from "./pages/altcontrol/NewProposalPage";
import { ProposalDetailPage } from "./pages/altcontrol/ProposalDetailPage";
import { ApprovalDetailPage } from "./pages/altcontrol/ApprovalDetailPage";
import { ContractDetailPage } from "./pages/altcontrol/ContractDetailPage";

const queryClient = new QueryClient();

const ProtectedLayout = () => (
  <AuthGuard>
    <AppLayout>
      <Outlet />
    </AppLayout>
  </AuthGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <OnboardingTour />
            <CommandPalette />
            <KeyboardShortcutsDialog />
            <Routes>
              {/* Public Routes */}
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/data-deletion" element={<DataDeletionPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/invite/:token" element={<AcceptInvitePage />} />
              <Route path="/pluggy/oauth/callback" element={<PluggyOAuthCallback />} />
              
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
                <Route path="/altcontrol/*" element={<AltControlPage />} />
                <Route path="/altcontrol/proposals/new" element={<NewProposalPage />} />
                <Route path="/altcontrol/proposals/:proposalId" element={<ProposalDetailPage />} />
                <Route path="/altcontrol/approvals/:proposalId" element={<ApprovalDetailPage />} />
                <Route path="/altcontrol/contracts/:contractId" element={<ContractDetailPage />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
