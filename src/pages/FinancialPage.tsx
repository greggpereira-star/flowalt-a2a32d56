import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionList } from "@/components/financial/TransactionList";
import { TransactionForm } from "@/components/financial/TransactionForm";
import { AdvancedFinancialDashboard } from "@/components/financial/AdvancedFinancialDashboard";
import { CollaboratorManager } from "@/components/financial/CollaboratorManager";
import { InvoiceList } from "@/components/financial/InvoiceList";
import { InvoiceForm } from "@/components/financial/InvoiceForm";
import { InvoiceXMLImporter } from "@/components/financial/InvoiceXMLImporter";
import { CostCenterManager } from "@/components/financial/CostCenterManager";
import { DREReport } from "@/components/financial/DREReport";
import { FinancialAlertsPanel } from "@/components/financial/FinancialAlertsPanel";
import { BankReconciliationPanel } from "@/components/financial/BankReconciliationPanel";
import { CashFlowForecastChart } from "@/components/financial/CashFlowForecastChart";
import { FinancialAuditPanel } from "@/components/financial/FinancialAuditPanel";
import { ProjectProfitabilityPanel } from "@/components/financial/ProjectProfitabilityPanel";
import { TaxSettingsPanel } from "@/components/financial/TaxSettingsPanel";
import { TaxCalculatorWidget } from "@/components/financial/TaxCalculatorWidget";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  Wallet,
  FileText,
  FolderTree,
  TrendingUp,
  Bell,
  GitCompare,
  Shield,
  PieChart,
  Calculator,
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
        <div className="flex flex-col h-full bg-muted/20">
          {/* Header Section */}
          <div className="bg-background border-b border-border/30">
            <div className="px-6 lg:px-8 pt-8 pb-8">
              {/* Title Row */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Gestão financeira e inteligência contábil
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <InvoiceXMLImporter />
                  <InvoiceForm />
                  <TransactionForm />
                </div>
              </div>

              {/* Breathing Space */}
              <div className="mt-8">
                {/* Navigation Pills */}
                <Tabs defaultValue="dashboard" className="w-full">
                  <TabsList variant="wrap" className="gap-2.5">
                  <TabsTrigger value="dashboard" variant="wrap" className="gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="transactions" variant="wrap" className="gap-2">
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Lançamentos</span>
                  </TabsTrigger>
                  <TabsTrigger value="invoices" variant="wrap" className="gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Notas Fiscais</span>
                  </TabsTrigger>
                  <TabsTrigger value="reconciliation" variant="wrap" className="gap-2">
                    <GitCompare className="w-4 h-4" />
                    <span>Conciliação</span>
                  </TabsTrigger>
                  <TabsTrigger value="dre" variant="wrap" className="gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>DRE</span>
                  </TabsTrigger>
                  <TabsTrigger value="cost-centers" variant="wrap" className="gap-2">
                    <FolderTree className="w-4 h-4" />
                    <span>Centros de Custo</span>
                  </TabsTrigger>
                  <TabsTrigger value="cashflow" variant="wrap" className="gap-2">
                    <Wallet className="w-4 h-4" />
                    <span>Fluxo de Caixa</span>
                  </TabsTrigger>
                  <TabsTrigger value="alerts" variant="wrap" className="gap-2">
                    <Bell className="w-4 h-4" />
                    <span>Alertas</span>
                  </TabsTrigger>
                  <TabsTrigger value="audit" variant="wrap" className="gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Auditoria</span>
                  </TabsTrigger>
                  <TabsTrigger value="profitability" variant="wrap" className="gap-2">
                    <PieChart className="w-4 h-4" />
                    <span>Rentabilidade</span>
                  </TabsTrigger>
                  <TabsTrigger value="collaborators" variant="wrap" className="gap-2">
                    <Users className="w-4 h-4" />
                    <span>Colaboradores</span>
                  </TabsTrigger>
                  <TabsTrigger value="tax-settings" variant="wrap" className="gap-2">
                    <Calculator className="w-4 h-4" />
                    <span>Config. Fiscal</span>
                  </TabsTrigger>
                  </TabsList>

                  {/* Minimalist Divider */}
                  <div className="relative mt-8 mb-2">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-border/30" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-4">
                        <div className="w-1 h-1 rounded-full bg-border" />
                      </span>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="pt-8 pb-8 px-0">
                  <TabsContent value="dashboard" className="mt-0 animate-in fade-in-50 duration-300">
                    <AdvancedFinancialDashboard />
                  </TabsContent>

                  <TabsContent value="transactions" className="mt-0 animate-in fade-in-50 duration-300">
                    <TransactionList />
                  </TabsContent>

                  <TabsContent value="invoices" className="mt-0 animate-in fade-in-50 duration-300">
                    <InvoiceList />
                  </TabsContent>

                  <TabsContent value="reconciliation" className="mt-0 animate-in fade-in-50 duration-300">
                    <BankReconciliationPanel />
                  </TabsContent>

                  <TabsContent value="dre" className="mt-0 animate-in fade-in-50 duration-300">
                    <DREReport />
                  </TabsContent>

                  <TabsContent value="cost-centers" className="mt-0 animate-in fade-in-50 duration-300">
                    <CostCenterManager />
                  </TabsContent>

                  <TabsContent value="cashflow" className="mt-0 animate-in fade-in-50 duration-300">
                    <div className="space-y-6">
                      <CashFlowForecastChart />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <h3 className="text-base font-medium">Receitas Previstas</h3>
                          </div>
                          <TransactionList filters={{ type: "income", status: "pending" }} />
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <h3 className="text-base font-medium">Despesas Previstas</h3>
                          </div>
                          <TransactionList filters={{ type: "expense", status: "pending" }} />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="alerts" className="mt-0 animate-in fade-in-50 duration-300">
                    <FinancialAlertsPanel />
                  </TabsContent>

                  <TabsContent value="audit" className="mt-0 animate-in fade-in-50 duration-300">
                    <FinancialAuditPanel />
                  </TabsContent>

                  <TabsContent value="profitability" className="mt-0 animate-in fade-in-50 duration-300">
                    <ProjectProfitabilityPanel />
                  </TabsContent>

                  <TabsContent value="collaborators" className="mt-0 animate-in fade-in-50 duration-300">
                    <CollaboratorManager />
                  </TabsContent>

                  <TabsContent value="tax-settings" className="mt-0 animate-in fade-in-50 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <TaxSettingsPanel />
                      </div>
                      <div>
                        <TaxCalculatorWidget />
                      </div>
                    </div>
                  </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    </PermissionGuard>
  );
}
