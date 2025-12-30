import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionList } from "@/components/financial/TransactionList";
import { TransactionForm } from "@/components/financial/TransactionForm";
import { FinancialDashboard } from "@/components/financial/FinancialDashboard";
import { CollaboratorManager } from "@/components/financial/CollaboratorManager";
import { InvoiceList } from "@/components/financial/InvoiceList";
import { InvoiceForm } from "@/components/financial/InvoiceForm";
import { CostCenterManager } from "@/components/financial/CostCenterManager";
import { DREReport } from "@/components/financial/DREReport";
import { FinancialAlertsPanel } from "@/components/financial/FinancialAlertsPanel";
import { BankReconciliationPanel } from "@/components/financial/BankReconciliationPanel";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  LayoutDashboard,
  List,
  Users,
  DollarSign,
  FileText,
  FolderTree,
  FileSpreadsheet,
  Bell,
  Link2,
} from "lucide-react";
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAccessLogging } from '@/hooks/useAccessLogging';

export default function FinancialPage() {
  usePageTracking('financial');
  const { logFinancialAccess } = useAccessLogging();

  useEffect(() => {
    logFinancialAccess('dashboard_view');
  }, [logFinancialAccess]);
  
  return (
    <PermissionGuard permission="canViewFinancial">
      <Helmet>
        <title>Financeiro | FlowAgency</title>
        <meta name="description" content="Gestão financeira completa com lançamentos, notas fiscais, DRE, centros de custo e conciliação bancária" />
      </Helmet>

      <AppLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Financeiro</h1>
              <p className="text-muted-foreground">
                Gestão financeira completa e inteligência contábil
              </p>
            </div>
            <div className="flex gap-2">
              <InvoiceForm />
              <TransactionForm />
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2">
                <List className="w-4 h-4" />
                Lançamentos
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2">
                <FileText className="w-4 h-4" />
                Notas Fiscais
              </TabsTrigger>
              <TabsTrigger value="reconciliation" className="gap-2">
                <Link2 className="w-4 h-4" />
                Conciliação
              </TabsTrigger>
              <TabsTrigger value="dre" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                DRE
              </TabsTrigger>
              <TabsTrigger value="cost-centers" className="gap-2">
                <FolderTree className="w-4 h-4" />
                Centros de Custo
              </TabsTrigger>
              <TabsTrigger value="cashflow" className="gap-2">
                <DollarSign className="w-4 h-4" />
                Fluxo de Caixa
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2">
                <Bell className="w-4 h-4" />
                Alertas
              </TabsTrigger>
              <TabsTrigger value="collaborators" className="gap-2">
                <Users className="w-4 h-4" />
                Colaboradores
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <FinancialDashboard />
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionList />
            </TabsContent>

            <TabsContent value="invoices">
              <InvoiceList />
            </TabsContent>

            <TabsContent value="reconciliation">
              <BankReconciliationPanel />
            </TabsContent>

            <TabsContent value="dre">
              <DREReport />
            </TabsContent>

            <TabsContent value="cost-centers">
              <CostCenterManager />
            </TabsContent>

            <TabsContent value="cashflow">
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-green-500">Receitas</h3>
                    <TransactionList filters={{ type: "income" }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-red-500">Despesas</h3>
                    <TransactionList filters={{ type: "expense" }} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="alerts">
              <FinancialAlertsPanel />
            </TabsContent>

            <TabsContent value="collaborators">
              <CollaboratorManager />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </PermissionGuard>
  );
}
