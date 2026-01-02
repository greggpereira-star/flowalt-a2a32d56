import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { TransactionList } from "@/components/financial/TransactionList";
import { TransactionForm } from "@/components/financial/TransactionForm";
import { TransactionEditModal } from "@/components/financial/TransactionEditModal";
import { AdvancedFinancialDashboard } from "@/components/financial/AdvancedFinancialDashboard";
import { CollaboratorManager } from "@/components/financial/CollaboratorManager";
import { InvoiceList } from "@/components/financial/InvoiceList";
import { InvoiceForm } from "@/components/financial/InvoiceForm";
import { InvoiceEditModal } from "@/components/financial/InvoiceEditModal";
import { InvoiceXMLImporter } from "@/components/financial/InvoiceXMLImporter";
import { CostCenterManager } from "@/components/financial/CostCenterManager";
import { DREReport } from "@/components/financial/DREReport";
import { FinancialAlertsPanel } from "@/components/financial/FinancialAlertsPanel";
import { BankReconciliationPanel } from "@/components/financial/BankReconciliationPanel";
import { CashFlowForecastChart } from "@/components/financial/CashFlowForecastChart";
import { CashFlowPendingPanel } from "@/components/financial/CashFlowPendingPanel";
import { FinancialAuditPanel } from "@/components/financial/FinancialAuditPanel";
import { ProjectProfitabilityPanel } from "@/components/financial/ProjectProfitabilityPanel";
import { TaxSettingsPanel } from "@/components/financial/TaxSettingsPanel";
import { TaxCalculatorWidget } from "@/components/financial/TaxCalculatorWidget";
import { TaxGuidesPanel } from "@/components/financial/TaxGuidesPanel";
import { RetentionsPanel } from "@/components/financial/RetentionsPanel";
import { OFXImporter } from "@/components/financial/OFXImporter";
import { DDAPanel } from "@/components/financial/DDAPanel";
import { InventoryDashboard } from "@/components/inventory/InventoryDashboard";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Transaction } from "@/hooks/useFinancial";
import { Invoice } from "@/hooks/useInvoices";
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
  Receipt,
  FileCheck,
  Package,
  CreditCard,
} from "lucide-react";
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAccessLogging } from '@/hooks/useAccessLogging';

export default function FinancialPage() {
  usePageTracking('financial');
  const { logFinancialAccess } = useAccessLogging();
  const { canViewSalaries } = usePermissions();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    logFinancialAccess('dashboard_view');
  }, [logFinancialAccess]);

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
  };
  
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
                  <OFXImporter />
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
                  {canViewSalaries && (
                    <TabsTrigger value="collaborators" variant="wrap" className="gap-2">
                      <Users className="w-4 h-4" />
                      <span>Colaboradores</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="tax-guides" variant="wrap" className="gap-2">
                    <FileCheck className="w-4 h-4" />
                    <span>Guias Fiscais</span>
                  </TabsTrigger>
                  <TabsTrigger value="retentions" variant="wrap" className="gap-2">
                    <Receipt className="w-4 h-4" />
                    <span>Retenções</span>
                  </TabsTrigger>
                  <TabsTrigger value="tax-settings" variant="wrap" className="gap-2">
                    <Calculator className="w-4 h-4" />
                    <span>Config. Fiscal</span>
                  </TabsTrigger>
                  <TabsTrigger value="dda" variant="wrap" className="gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span>DDA</span>
                  </TabsTrigger>
                  <TabsTrigger value="inventory" variant="wrap" className="gap-2">
                    <Package className="w-4 h-4" />
                    <span>Almoxarifado</span>
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
                    <TransactionList onEdit={handleEditTransaction} />
                  </TabsContent>

                  <TabsContent value="invoices" className="mt-0 animate-in fade-in-50 duration-300">
                    <InvoiceList onEdit={handleEditInvoice} />
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
                      <CashFlowPendingPanel onEdit={handleEditTransaction} />
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

                  {canViewSalaries && (
                    <TabsContent value="collaborators" className="mt-0 animate-in fade-in-50 duration-300">
                      <CollaboratorManager />
                    </TabsContent>
                  )}

                  <TabsContent value="tax-guides" className="mt-0 animate-in fade-in-50 duration-300">
                    <TaxGuidesPanel />
                  </TabsContent>

                  <TabsContent value="retentions" className="mt-0 animate-in fade-in-50 duration-300">
                    <RetentionsPanel />
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

                  <TabsContent value="dda" className="mt-0 animate-in fade-in-50 duration-300">
                    <DDAPanel />
                  </TabsContent>

                  <TabsContent value="inventory" className="mt-0 animate-in fade-in-50 duration-300">
                    <InventoryDashboard />
                  </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Edit Modal */}
        <TransactionEditModal
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transaction={editingTransaction}
        />

        {/* Invoice Edit Modal */}
        <InvoiceEditModal
          open={!!editingInvoice}
          onOpenChange={(open) => !open && setEditingInvoice(null)}
          invoice={editingInvoice}
        />
      </AppLayout>
    </PermissionGuard>
  );
}
