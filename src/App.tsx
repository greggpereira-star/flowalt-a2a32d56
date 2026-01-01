import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { CommandPalette } from "@/components/command/CommandPalette";
import { KeyboardShortcutsDialog } from "@/components/command/KeyboardShortcutsDialog";
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
import GamificationPage from "./pages/GamificationPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import PeopleAnalyticsPage from "./pages/PeopleAnalyticsPage";
import ClientsPage from "./pages/ClientsPage";
import PluggyOAuthCallback from "./pages/PluggyOAuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <Route path="/auth" element={<Auth />} />
              <Route path="/pluggy/oauth/callback" element={<PluggyOAuthCallback />} />
              <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
              <Route path="/workspace/new" element={<AuthGuard><NewWorkspace /></AuthGuard>} />
              <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
              <Route path="/tasks" element={<AuthGuard><TasksPage /></AuthGuard>} />
              <Route path="/time" element={<AuthGuard><TimePage /></AuthGuard>} />
              <Route path="/coordination" element={<AuthGuard><CoordinationPage /></AuthGuard>} />
              <Route path="/calendar" element={<AuthGuard><AgendaPage /></AuthGuard>} />
              <Route path="/financial" element={<AuthGuard><FinancialPage /></AuthGuard>} />
              <Route path="/partners" element={<AuthGuard><PartnersPage /></AuthGuard>} />
              <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
              <Route path="/gamification" element={<AuthGuard><GamificationPage /></AuthGuard>} />
              <Route path="/analytics" element={<AuthGuard><AnalyticsPage /></AuthGuard>} />
              <Route path="/people-analytics" element={<AuthGuard><PeopleAnalyticsPage /></AuthGuard>} />
              <Route path="/clients" element={<AuthGuard><ClientsPage /></AuthGuard>} />
              <Route path="/clients/:clientId" element={<AuthGuard><ClientsPage /></AuthGuard>} />
              <Route path="/space/:spaceId" element={<AuthGuard><SpacePage /></AuthGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
