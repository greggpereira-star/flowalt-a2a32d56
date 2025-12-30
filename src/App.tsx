import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NewWorkspace from "./pages/NewWorkspace";
import SpacePage from "./pages/SpacePage";
import Dashboard from "./pages/Dashboard";
import CoordinationPage from "./pages/CoordinationPage";
import AgendaPage from "./pages/AgendaPage";
import FinancialPage from "./pages/FinancialPage";
import PartnersPage from "./pages/PartnersPage";
import SettingsPage from "./pages/SettingsPage";
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
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
              <Route path="/workspace/new" element={<AuthGuard><NewWorkspace /></AuthGuard>} />
              <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
              <Route path="/coordination" element={<AuthGuard><CoordinationPage /></AuthGuard>} />
              <Route path="/calendar" element={<AuthGuard><AgendaPage /></AuthGuard>} />
              <Route path="/financial" element={<AuthGuard><FinancialPage /></AuthGuard>} />
              <Route path="/partners" element={<AuthGuard><PartnersPage /></AuthGuard>} />
              <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
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
