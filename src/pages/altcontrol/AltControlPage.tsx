import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  CheckCircle,
  Users,
  BarChart3,
  Settings,
  Plus,
  Gauge,
} from 'lucide-react';
import { usePendingApprovals } from '@/hooks/useAltControl';
import { usePermissions } from '@/hooks/usePermissions';

// Sub-pages
import { ProposalListPage } from './ProposalListPage';
import { NewProposalPage } from './NewProposalPage';
import { ProposalDetailPage } from './ProposalDetailPage';
import { ApprovalsPage } from './ApprovalsPage';
import { ApprovalDetailPage } from './ApprovalDetailPage';
import { ContractsPage } from './ContractsPage';
import { ContractDetailPage } from './ContractDetailPage';
import { ProfitabilityMatrixPage } from './ProfitabilityMatrixPage';
import { AltControlSettingsPage } from './AltControlSettingsPage';

const AltControlNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = usePermissions();
  const { data: pendingApprovals } = usePendingApprovals();

  const pendingCount = pendingApprovals?.length || 0;

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/proposals/new')) return 'new-proposal';
    if (path.includes('/proposals')) return 'proposals';
    if (path.includes('/approvals')) return 'approvals';
    if (path.includes('/contracts')) return 'contracts';
    if (path.includes('/profitability')) return 'profitability';
    if (path.includes('/settings')) return 'settings';
    return 'proposals';
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="overflow-x-auto w-full sm:w-auto">
        <Tabs value={getActiveTab()} className="w-full">
          <TabsList className="h-10">
            <TabsTrigger
              value="proposals"
              onClick={() => navigate('/altcontrol/proposals')}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Propostas</span>
            </TabsTrigger>
            <TabsTrigger
              value="approvals"
              onClick={() => navigate('/altcontrol/approvals')}
              className="gap-2 relative"
            >
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Aprovações</span>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="contracts"
              onClick={() => navigate('/altcontrol/contracts')}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clientes Ativos</span>
            </TabsTrigger>
            <TabsTrigger
              value="profitability"
              onClick={() => navigate('/altcontrol/profitability')}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Rentabilidade</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="settings"
                onClick={() => navigate('/altcontrol/settings')}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Configurações</span>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      <Button onClick={() => navigate('/altcontrol/proposals/new')} className="gap-2">
        <Plus className="h-4 w-4" />
        Nova Proposta
      </Button>
    </div>
  );
};

export const AltControlPage: React.FC = () => {
  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Gauge className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AltControl</h1>
              <p className="text-sm text-muted-foreground">
                Gestor de Rentabilidade e Precificação
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <AltControlNavigation />

        {/* Content */}
        <Routes>
          <Route index element={<Navigate to="proposals" replace />} />
          <Route path="proposals" element={<ProposalListPage />} />
          <Route path="proposals/new" element={<NewProposalPage />} />
          <Route path="proposals/:id" element={<ProposalDetailPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="approvals/:id" element={<ApprovalDetailPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="contracts/:id" element={<ContractDetailPage />} />
          <Route path="profitability" element={<ProfitabilityMatrixPage />} />
          <Route
            path="settings/*"
            element={
              <PermissionGuard permission="isAdmin">
                <AltControlSettingsPage />
              </PermissionGuard>
            }
          />
        </Routes>
      </div>
    </AppLayout>
  );
};
