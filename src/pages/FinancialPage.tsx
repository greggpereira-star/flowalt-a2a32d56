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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Gestão financeira e inteligência contábil
                </p>
              </div>
              <div className="flex items-center gap-3">
                <InvoiceForm />
                <TransactionForm />
              </div>
            </div>

            {/* Premium Navigation */}
            <Tabs defaultValue="dashboard" className="w-full">
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList variant="premium" className="min-w-max">
                  <TabsTrigger value="dashboard" variant="premium" className="gap-2.5">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="transactions" variant="premium" className="gap-2.5">
                    <List className="w-4 h-4" />
                    <span>Lançamentos</span>
                  </TabsTrigger>
                  <TabsTrigger value="invoices" variant="premium" className="gap-2.5">
                    <FileText className="w-4 h-4" />
                    <span>Notas Fiscais</span>
                  </TabsTrigger>
                  <TabsTrigger value="reconciliation" variant="premium" className="gap-2.5">
                    <Link2 className="w-4 h-4" />
                    <span>Conciliação</span>
                  </TabsTrigger>
                  <TabsTrigger value="dre" variant="premium" className="gap-2.5">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>DRE</span>
                  </TabsTrigger>
                  <TabsTrigger value="cost-centers" variant="premium" className="gap-2.5">
                    <FolderTree className="w-4 h-4" />
                    <span>Centros de Custo</span>
                  </TabsTrigger>
                  <TabsTrigger value="cashflow" variant="premium" className="gap-2.5">
                    <DollarSign className="w-4 h-4" />
                    <span>Fluxo de Caixa</span>
                  </TabsTrigger>
                  <TabsTrigger value="alerts" variant="premium" className="gap-2.5">
                    <Bell className="w-4 h-4" />
                    <span>Alertas</span>
                  </TabsTrigger>
                  <TabsTrigger value="collaborators" variant="premium" className="gap-2.5">
                    <Users className="w-4 h-4" />
                    <span>Colaboradores</span>
                  </TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" className="invisible" />
              </ScrollArea>

              {/* Content */}
              <div className="p-6">
                <TabsContent value="dashboard" className="mt-0">
                  <FinancialDashboard />
                </TabsContent>

                <TabsContent value="transactions" className="mt-0">
                  <TransactionList />
                </TabsContent>

                <TabsContent value="invoices" className="mt-0">
                  <InvoiceList />
                </TabsContent>

                <TabsContent value="reconciliation" className="mt-0">
                  <BankReconciliationPanel />
                </TabsContent>

                <TabsContent value="dre" className="mt-0">
                  <DREReport />
                </TabsContent>

                <TabsContent value="cost-centers" className="mt-0">
                  <CostCenterManager />
                </TabsContent>

                <TabsContent value="cashflow" className="mt-0">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <h3 className="text-base font-medium">Receitas</h3>
                        </div>
                        <TransactionList filters={{ type: "income" }} />
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <h3 className="text-base font-medium">Despesas</h3>
                        </div>
                        <TransactionList filters={{ type: "expense" }} />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="alerts" className="mt-0">
                  <FinancialAlertsPanel />
                </TabsContent>

                <TabsContent value="collaborators" className="mt-0">
                  <CollaboratorManager />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </AppLayout>
    </PermissionGuard>
  );
}
