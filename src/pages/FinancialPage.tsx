import { lazy, Suspense, useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useGlobalModal } from "@/contexts/GlobalModalContext";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { TransactionEditModal } from "@/components/financial/TransactionEditModal";
import { InvoiceEditModal } from "@/components/financial/InvoiceEditModal";
import { InvoiceXMLImporter } from "@/components/financial/InvoiceXMLImporter";
import { OFXImporter } from "@/components/financial/OFXImporter";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

// Cada aba carrega seu próprio código sob demanda: antes, o arquivo importava
// todos os ~20 painéis de uma vez (inclusive os que puxam recharts/jspdf),
// gerando um único bundle de +1MB que o navegador baixava e executava por
// inteiro só para mostrar a aba "Dashboard". Com lazy(), abrir o Financeiro
// carrega só o essencial; cada aba paga seu próprio custo, só quando é aberta.
const AdvancedFinancialDashboard = lazy(() => import("@/components/financial/AdvancedFinancialDashboard").then(m => ({ default: m.AdvancedFinancialDashboard })));
const ExecutivePanel = lazy(() => import("@/components/financial/ExecutivePanel").then(m => ({ default: m.ExecutivePanel })));
const TransactionList = lazy(() => import("@/components/financial/TransactionList").then(m => ({ default: m.TransactionList })));
const InvoiceList = lazy(() => import("@/components/financial/InvoiceList").then(m => ({ default: m.InvoiceList })));
const BankReconciliationPanel = lazy(() => import("@/components/financial/BankReconciliationPanel").then(m => ({ default: m.BankReconciliationPanel })));
const DREReport = lazy(() => import("@/components/financial/DREReport").then(m => ({ default: m.DREReport })));
const CostCenterManager = lazy(() => import("@/components/financial/CostCenterManager").then(m => ({ default: m.CostCenterManager })));
const CashFlowForecastChart = lazy(() => import("@/components/financial/CashFlowForecastChart").then(m => ({ default: m.CashFlowForecastChart })));
const CashFlowPendingPanel = lazy(() => import("@/components/financial/CashFlowPendingPanel").then(m => ({ default: m.CashFlowPendingPanel })));
const FinancialAlertsPanel = lazy(() => import("@/components/financial/FinancialAlertsPanel").then(m => ({ default: m.FinancialAlertsPanel })));
const FinancialAuditPanel = lazy(() => import("@/components/financial/FinancialAuditPanel").then(m => ({ default: m.FinancialAuditPanel })));
const ProjectProfitabilityPanel = lazy(() => import("@/components/financial/ProjectProfitabilityPanel").then(m => ({ default: m.ProjectProfitabilityPanel })));
const CollaboratorManager = lazy(() => import("@/components/financial/CollaboratorManager").then(m => ({ default: m.CollaboratorManager })));
const TaxGuidesPanel = lazy(() => import("@/components/financial/TaxGuidesPanel").then(m => ({ default: m.TaxGuidesPanel })));
const RetentionsPanel = lazy(() => import("@/components/financial/RetentionsPanel").then(m => ({ default: m.RetentionsPanel })));
const TaxSettingsPanel = lazy(() => import("@/components/financial/TaxSettingsPanel").then(m => ({ default: m.TaxSettingsPanel })));
const TaxCalculatorWidget = lazy(() => import("@/components/financial/TaxCalculatorWidget").then(m => ({ default: m.TaxCalculatorWidget })));
const DDAPanel = lazy(() => import("@/components/financial/DDAPanel").then(m => ({ default: m.DDAPanel })));
const InventoryDashboard = lazy(() => import("@/components/inventory/InventoryDashboard").then(m => ({ default: m.InventoryDashboard })));
const InvoiceGenerator = lazy(() => import("@/components/financial/InvoiceGenerator").then(m => ({ default: m.InvoiceGenerator })));
const ProcessMappingCanvas = lazy(() => import("@/components/processes/ProcessMappingCanvas").then(m => ({ default: m.ProcessMappingCanvas })));
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
  GitBranch,
  Gauge,
} from "lucide-react";
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAccessLogging } from '@/hooks/useAccessLogging';

type TabItem = { value: string; label: string; Icon: React.ElementType; salaries?: boolean };

// Abas agrupadas por categoria — usado tanto na navegação desktop (pílulas)
// quanto no seletor dropdown mobile, evitando duplicação.
const TAB_GROUPS: { label: string; items: TabItem[] }[] = [
  {
    label: "Visão Geral",
    items: [
      { value: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { value: "transactions", label: "Lançamentos", Icon: ArrowLeftRight },
      { value: "invoices", label: "Notas Fiscais", Icon: FileText },
      { value: "cashflow", label: "Fluxo de Caixa", Icon: Wallet },
    ],
  },
  {
    label: "Análise",
    items: [
      { value: "executive-panel", label: "Painel Executivo", Icon: Gauge },
      { value: "dre", label: "DRE", Icon: TrendingUp },
      { value: "cost-centers", label: "Centros de Custo", Icon: FolderTree },
      { value: "profitability", label: "Rentabilidade", Icon: PieChart },
      { value: "alerts", label: "Alertas", Icon: Bell },
      { value: "audit", label: "Auditoria", Icon: Shield },
    ],
  },
  {
    label: "Fiscal & Bancário",
    items: [
      { value: "reconciliation", label: "Conciliação", Icon: GitCompare },
      { value: "tax-guides", label: "Guias Fiscais", Icon: FileCheck },
      { value: "retentions", label: "Retenções", Icon: Receipt },
      { value: "tax-settings", label: "Config. Fiscal", Icon: Calculator },
      { value: "dda", label: "DDA", Icon: CreditCard },
    ],
  },
  {
    label: "Gestão",
    items: [
      { value: "collaborators", label: "Colaboradores", Icon: Users, salaries: true },
      { value: "inventory", label: "Almoxarifado", Icon: Package },
      { value: "invoice-generator", label: "Gerar Invoice", Icon: FileText },
      { value: "processes", label: "Processos", Icon: GitBranch },
    ],
  },
];

const ALL_TABS: TabItem[] = TAB_GROUPS.flatMap((g) => g.items);

const TabFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

export default function FinancialPage() {
  usePageTracking('financial');
  const { logFinancialAccess } = useAccessLogging();
  const { openModal } = useGlobalModal();
  const { canViewSalaries } = usePermissions();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  const visibleTabs = ALL_TABS.filter((t) => !t.salaries || canViewSalaries);
  const activeTabItem = ALL_TABS.find((t) => t.value === activeTab) ?? ALL_TABS[0];


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

      <div className="flex flex-col h-full bg-muted/20">

          {/* Header Section */}
          <div className="bg-background border-b border-border/30">
            <div className="px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-5 sm:pb-8">
              {/* Title Row */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Financeiro</h1>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Gestão financeira e inteligência contábil
                  </p>
                </div>
                {/* Ações do cabeçalho: no mobile, duas linhas simétricas de 2 botões,
                    todos rotulados e proporcionais; no desktop, tudo em linha. */}
                <div className="flex flex-col gap-2 w-full lg:w-auto lg:flex-row lg:items-center lg:gap-3">
                  {/* Ações primárias — lado a lado, mesma largura */}
                  <div className="grid grid-cols-2 gap-2 lg:flex lg:gap-3">
                    <Button
                      onClick={() => openModal('invoice')}
                      size="sm"
                      className="w-full lg:w-auto justify-center text-xs sm:text-sm px-2 lg:h-10"
                    >
                      <Plus className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">Nova Nota Fiscal</span>
                    </Button>
                    <Button
                      onClick={() => openModal('transaction')}
                      size="sm"
                      className="w-full lg:w-auto justify-center text-xs sm:text-sm px-2 lg:h-10"
                    >
                      <Plus className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">Novo Lançamento</span>
                    </Button>
                  </div>
                  {/* Importações — secundárias, com rótulo claro */}
                  <div className="grid grid-cols-2 gap-2 lg:flex lg:gap-3">
                    <OFXImporter />
                    <InvoiceXMLImporter />
                  </div>
                </div>
              </div>

              {/* Breathing Space */}
              <div className="mt-5 sm:mt-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
                  {/* Mobile: seletor dropdown agrupado (mais claro que 18 abas roláveis) */}
                  <div className="md:hidden">
                    <Select value={activeTab} onValueChange={setActiveTab}>
                      <SelectTrigger className="w-full h-11 bg-card font-medium">
                        <span className="flex items-center gap-2.5">
                          <activeTabItem.Icon className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{activeTabItem.label}</span>
                        </span>
                      </SelectTrigger>
                      <SelectContent className="max-h-[70vh]">
                        {TAB_GROUPS.map((group) => {
                          const items = group.items.filter((t) => !t.salaries || canViewSalaries);
                          if (items.length === 0) return null;
                          return (
                            <SelectGroup key={group.label}>
                              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                                {group.label}
                              </SelectLabel>
                              {items.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  <span className="flex items-center gap-2.5">
                                    <t.Icon className="w-4 h-4 text-muted-foreground" />
                                    {t.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Desktop: pílulas geradas a partir da mesma config */}
                  <TabsList
                    variant="wrap"
                    className="hidden md:flex w-full min-w-0 gap-2 flex-wrap justify-center max-w-4xl"
                  >
                    {visibleTabs.map((t) => (
                      <TabsTrigger key={t.value} value={t.value} variant="wrap" className="gap-2">
                        <t.Icon className="w-4 h-4" />
                        <span>{t.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* Divisor minimalista — só no desktop, entre as pílulas e o conteúdo */}
                  <div className="relative mt-8 mb-2 hidden md:block">
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
                  <div className="pt-5 sm:pt-8 pb-8 px-0">
                  <TabsContent value="dashboard" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><AdvancedFinancialDashboard /></Suspense>
                  </TabsContent>

                  <TabsContent value="transactions" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><TransactionList onEdit={handleEditTransaction} /></Suspense>
                  </TabsContent>

                  <TabsContent value="invoices" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><InvoiceList onEdit={handleEditInvoice} /></Suspense>
                  </TabsContent>

                  <TabsContent value="reconciliation" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><BankReconciliationPanel /></Suspense>
                  </TabsContent>

                  <TabsContent value="executive-panel" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><ExecutivePanel onViewTransactions={() => setActiveTab("transactions")} /></Suspense>
                  </TabsContent>

                  <TabsContent value="dre" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><DREReport /></Suspense>
                  </TabsContent>

                  <TabsContent value="cost-centers" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><CostCenterManager /></Suspense>
                  </TabsContent>

                  <TabsContent value="cashflow" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}>
                      <div className="space-y-6">
                        <CashFlowForecastChart />
                        <CashFlowPendingPanel onEdit={handleEditTransaction} />
                      </div>
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="alerts" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><FinancialAlertsPanel /></Suspense>
                  </TabsContent>

                  <TabsContent value="audit" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><FinancialAuditPanel /></Suspense>
                  </TabsContent>

                  <TabsContent value="profitability" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><ProjectProfitabilityPanel /></Suspense>
                  </TabsContent>

                  {canViewSalaries && (
                    <TabsContent value="collaborators" className="mt-0 animate-in fade-in-50 duration-300">
                      <Suspense fallback={<TabFallback />}><CollaboratorManager /></Suspense>
                    </TabsContent>
                  )}

                  <TabsContent value="tax-guides" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><TaxGuidesPanel /></Suspense>
                  </TabsContent>

                  <TabsContent value="retentions" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><RetentionsPanel /></Suspense>
                  </TabsContent>

                  <TabsContent value="tax-settings" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                          <TaxSettingsPanel />
                        </div>
                        <div>
                          <TaxCalculatorWidget />
                        </div>
                      </div>
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="dda" className="mt-0 animate-in fade-in-50 duration-300">
                    <Suspense fallback={<TabFallback />}><DDAPanel /></Suspense>
                  </TabsContent>

                   <TabsContent value="inventory" className="mt-0 animate-in fade-in-50 duration-300">
                     <Suspense fallback={<TabFallback />}><InventoryDashboard /></Suspense>
                   </TabsContent>

                   <TabsContent value="invoice-generator" className="mt-0 animate-in fade-in-50 duration-300">
                     <Suspense fallback={<TabFallback />}><InvoiceGenerator /></Suspense>
                   </TabsContent>

                   <TabsContent value="processes" className="mt-0 animate-in fade-in-50 duration-300">
                     <Suspense fallback={<TabFallback />}><ProcessMappingCanvas /></Suspense>
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
    </PermissionGuard>

  );
}
