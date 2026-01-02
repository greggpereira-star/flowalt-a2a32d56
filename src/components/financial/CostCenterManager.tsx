import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FolderTree,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput, parseCurrencyToNumber } from "@/components/ui/currency-input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCostCenters, useCostCentersWithBudget, useCreateCostCenter, useDeleteCostCenter, CostCenterWithActual, CostCenter } from "@/hooks/useCostCenters";
import { useTransactions } from "@/hooks/useFinancial";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useExternalCollaborators } from "@/hooks/useExternalCollaborators";
import { cn } from "@/lib/utils";
import { generatePDFReport, downloadPDF, ReportData } from "@/lib/pdfGenerator";
import { useToast } from "@/hooks/use-toast";
import { CostCenterEditModal } from "./CostCenterEditModal";

const costCenterSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  budget_monthly: z.string().optional(),
  budget_yearly: z.string().optional(),
  parent_id: z.string().optional(),
  responsible_user_id: z.string().optional(),
});

type FormData = z.infer<typeof costCenterSchema>;

export function CostCenterManager() {
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  
  const { data: costCenters = [], isLoading: loadingCenters } = useCostCenters();
  const { data: centersWithBudget = [], isLoading: loadingBudget } = useCostCentersWithBudget();
  const { data: members = [] } = useWorkspaceMembers();
  const createCostCenter = useCreateCostCenter();
  const deleteCostCenter = useDeleteCostCenter();
  const { data: externalCollaborators = [] } = useExternalCollaborators();

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  
  const { data: transactions = [] } = useTransactions({
    type: "expense",
    startDate: format(monthStart, "yyyy-MM-dd"),
    endDate: format(monthEnd, "yyyy-MM-dd"),
  });

  // Calculate collaborator salaries by cost center
  const collaboratorSalaryByCenter = useMemo(() => {
    const salaries: Record<string, { total: number; collaborators: { name: string; salary: number }[] }> = {};
    
    externalCollaborators
      .filter(c => c.is_active && c.cost_center_id)
      .forEach(c => {
        const centerId = c.cost_center_id!;
        if (!salaries[centerId]) {
          salaries[centerId] = { total: 0, collaborators: [] };
        }
        const salary = c.base_salary || 0;
        salaries[centerId].total += salary;
        salaries[centerId].collaborators.push({ name: c.full_name, salary });
      });
    
    return salaries;
  }, [externalCollaborators]);

  const form = useForm<FormData>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      color: "#3B82F6",
      budget_monthly: "",
      budget_yearly: "",
      parent_id: "",
      responsible_user_id: "",
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCurrencyPlain = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const navigateMonth = (direction: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  // Calculate detailed report data - MUST be before export functions
  const costCenterReport = useMemo(() => {
    const byCenter: Record<string, {
      center: CostCenterWithActual;
      transactions: typeof transactions;
      totalSpent: number;
      salarySpent: number;
      collaborators: { name: string; salary: number }[];
      budgetUsed: number;
    }> = {};

    // Initialize all centers
    centersWithBudget.forEach(center => {
      const salaryData = collaboratorSalaryByCenter[center.id] || { total: 0, collaborators: [] };
      byCenter[center.id] = {
        center,
        transactions: [],
        totalSpent: 0,
        salarySpent: salaryData.total,
        collaborators: salaryData.collaborators,
        budgetUsed: 0,
      };
    });

    // Group transactions by center
    transactions.forEach(t => {
      if (t.cost_center_id && byCenter[t.cost_center_id]) {
        byCenter[t.cost_center_id].transactions.push(t);
        byCenter[t.cost_center_id].totalSpent += Number(t.amount);
      }
    });

    // Calculate budget usage (including salaries)
    Object.values(byCenter).forEach(item => {
      const totalWithSalary = item.totalSpent + item.salarySpent;
      if (item.center.budget_monthly && item.center.budget_monthly > 0) {
        item.budgetUsed = (totalWithSalary / item.center.budget_monthly) * 100;
      }
    });

    // Transactions without center
    const unassigned = transactions.filter(t => !t.cost_center_id);
    const unassignedTotal = unassigned.reduce((acc, t) => acc + Number(t.amount), 0);

    // Collaborators without center
    const unassignedCollaborators = externalCollaborators.filter(c => c.is_active && !c.cost_center_id);
    const unassignedSalaryTotal = unassignedCollaborators.reduce((acc, c) => acc + (c.base_salary || 0), 0);

    // Totals
    const totalBudget = centersWithBudget.reduce((acc, c) => acc + (c.budget_monthly || 0), 0);
    const totalTransactionsSpent = Object.values(byCenter).reduce((acc, item) => acc + item.totalSpent, 0) + unassignedTotal;
    const totalSalarySpent = Object.values(byCenter).reduce((acc, item) => acc + item.salarySpent, 0) + unassignedSalaryTotal;
    const totalSpent = totalTransactionsSpent + totalSalarySpent;
    const overallUsage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      byCenter: Object.values(byCenter).sort((a, b) => (b.totalSpent + b.salarySpent) - (a.totalSpent + a.salarySpent)),
      unassigned,
      unassignedTotal,
      unassignedCollaborators,
      unassignedSalaryTotal,
      totalBudget,
      totalSpent,
      totalTransactionsSpent,
      totalSalarySpent,
      overallUsage,
    };
  }, [centersWithBudget, transactions, collaboratorSalaryByCenter, externalCollaborators]);

  // Export to PDF
  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const monthName = format(selectedMonth, "MMMM yyyy", { locale: ptBR });
      
      const pdfReport: ReportData = {
        title: "Relatório de Centros de Custo",
        subtitle: `Execução Orçamentária - ${monthName}`,
        generatedAt: new Date(),
        sections: [
          {
            title: "Resumo Geral",
            type: "summary",
            summary: [
              { label: "Centros Ativos", value: centersWithBudget.length },
              { label: "Orçamento Total", value: formatCurrency(costCenterReport.totalBudget) },
              { label: "Total Gasto", value: formatCurrency(costCenterReport.totalSpent) },
              { label: "Execução", value: `${costCenterReport.overallUsage.toFixed(1)}%` },
            ],
          },
          {
            title: "Detalhamento por Centro de Custo",
            type: "table",
            data: {
              headers: ["Centro de Custo", "Código", "Orçamento", "Despesas", "Salários", "Total", "Saldo", "% Exec.", "Status"],
              rows: [
                ...costCenterReport.byCenter.map((item) => {
                  const totalWithSalary = item.totalSpent + item.salarySpent;
                  const saldo = (item.center.budget_monthly || 0) - totalWithSalary;
                  const status = item.center.budget_monthly && item.center.budget_monthly > 0
                    ? (item.budgetUsed >= 100 ? "Excedido" : item.budgetUsed >= 80 ? "Atenção" : "OK")
                    : "N/A";
                  
                  return [
                    item.center.name,
                    item.center.code || "-",
                    item.center.budget_monthly ? formatCurrency(item.center.budget_monthly) : "-",
                    formatCurrency(item.totalSpent),
                    item.salarySpent > 0 ? formatCurrency(item.salarySpent) : "-",
                    formatCurrency(totalWithSalary),
                    item.center.budget_monthly ? formatCurrency(saldo) : "-",
                    item.center.budget_monthly ? `${item.budgetUsed.toFixed(1)}%` : "-",
                    status,
                  ];
                }),
                ...((costCenterReport.unassigned.length > 0 || costCenterReport.unassignedSalaryTotal > 0) ? [[
                  "Sem Centro de Custo",
                  "-",
                  "-",
                  formatCurrency(costCenterReport.unassignedTotal),
                  costCenterReport.unassignedSalaryTotal > 0 ? formatCurrency(costCenterReport.unassignedSalaryTotal) : "-",
                  formatCurrency(costCenterReport.unassignedTotal + costCenterReport.unassignedSalaryTotal),
                  "-",
                  "-",
                  "Não classificado",
                ]] : []),
                [
                  "TOTAL",
                  "",
                  formatCurrency(costCenterReport.totalBudget),
                  formatCurrency(costCenterReport.totalTransactionsSpent),
                  formatCurrency(costCenterReport.totalSalarySpent),
                  formatCurrency(costCenterReport.totalSpent),
                  formatCurrency(costCenterReport.totalBudget - costCenterReport.totalSpent),
                  `${costCenterReport.overallUsage.toFixed(1)}%`,
                  "",
                ],
              ],
            },
          },
        ],
      };

      const doc = generatePDFReport(pdfReport);
      downloadPDF(doc, `centros-custo-${format(selectedMonth, "yyyy-MM")}`);
      
      toast({
        title: "PDF exportado",
        description: "Relatório de centros de custo exportado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Excel (CSV format for compatibility)
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const monthName = format(selectedMonth, "MMMM yyyy", { locale: ptBR });
      
      // Build CSV content with BOM for Excel UTF-8 compatibility
      const BOM = "\uFEFF";
      const headers = ["Centro de Custo", "Código", "Orçamento", "Despesas", "Salários", "Total", "Saldo", "% Execução", "Status"];
      
      const rows = costCenterReport.byCenter.map((item) => {
        const totalWithSalary = item.totalSpent + item.salarySpent;
        const saldo = (item.center.budget_monthly || 0) - totalWithSalary;
        const status = item.center.budget_monthly && item.center.budget_monthly > 0
          ? (item.budgetUsed >= 100 ? "Excedido" : item.budgetUsed >= 80 ? "Atenção" : "OK")
          : "N/A";
        
        return [
          item.center.name,
          item.center.code || "-",
          item.center.budget_monthly ? formatCurrencyPlain(item.center.budget_monthly) : "-",
          formatCurrencyPlain(item.totalSpent),
          item.salarySpent > 0 ? formatCurrencyPlain(item.salarySpent) : "-",
          formatCurrencyPlain(totalWithSalary),
          item.center.budget_monthly ? formatCurrencyPlain(saldo) : "-",
          item.center.budget_monthly ? `${item.budgetUsed.toFixed(1)}%` : "-",
          status,
        ];
      });

      // Add unassigned row if exists
      if (costCenterReport.unassigned.length > 0 || costCenterReport.unassignedSalaryTotal > 0) {
        rows.push([
          "Sem Centro de Custo",
          "-",
          "-",
          formatCurrencyPlain(costCenterReport.unassignedTotal),
          costCenterReport.unassignedSalaryTotal > 0 ? formatCurrencyPlain(costCenterReport.unassignedSalaryTotal) : "-",
          formatCurrencyPlain(costCenterReport.unassignedTotal + costCenterReport.unassignedSalaryTotal),
          "-",
          "-",
          "Não classificado",
        ]);
      }

      // Add total row
      rows.push([
        "TOTAL",
        "",
        formatCurrencyPlain(costCenterReport.totalBudget),
        formatCurrencyPlain(costCenterReport.totalTransactionsSpent),
        formatCurrencyPlain(costCenterReport.totalSalarySpent),
        formatCurrencyPlain(costCenterReport.totalSpent),
        formatCurrencyPlain(costCenterReport.totalBudget - costCenterReport.totalSpent),
        `${costCenterReport.overallUsage.toFixed(1)}%`,
        "",
      ]);

      const csvContent = BOM + [
        `Relatório de Centros de Custo - ${monthName}`,
        "",
        headers.join(";"),
        ...rows.map(row => row.join(";")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `centros-custo-${format(selectedMonth, "yyyy-MM")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Excel exportado",
        description: "Relatório exportado em formato CSV (compatível com Excel).",
      });
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCenterData = selectedCenterId 
    ? costCenterReport.byCenter.find(d => d.center.id === selectedCenterId) 
    : null;

  const onSubmit = async (data: FormData) => {
    try {
      await createCostCenter.mutateAsync({
        name: data.name,
        code: data.code || undefined,
        description: data.description || undefined,
        color: data.color || "#3B82F6",
        budget_monthly: data.budget_monthly ? parseCurrencyToNumber(data.budget_monthly) : 0,
        budget_yearly: data.budget_yearly ? parseCurrencyToNumber(data.budget_yearly) : 0,
        parent_id: data.parent_id || undefined,
        responsible_user_id: data.responsible_user_id || null,
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Erro ao criar centro de custo:", error);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este centro de custo?")) {
      deleteCostCenter.mutate(id);
    }
  };

  const getBudgetStatus = (percentage: number) => {
    if (percentage >= 100) return { color: "bg-rose-500", textColor: "text-rose-600", status: "Excedido", icon: TrendingUp };
    if (percentage >= 80) return { color: "bg-amber-500", textColor: "text-amber-600", status: "Atenção", icon: AlertTriangle };
    return { color: "bg-emerald-500", textColor: "text-emerald-600", status: "OK", icon: TrendingDown };
  };

  const isLoading = loadingCenters || loadingBudget;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderTree className="w-5 h-5" />
            Centros de Custo
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie centros de custo e controle orçamentos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Centro de Custo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Centro de Custo</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Marketing" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: MKT-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Descrição do centro de custo..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="budget_monthly"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Orçamento Mensal</FormLabel>
                          <FormControl>
                            <CurrencyInput value={field.value || ""} onChange={field.onChange} placeholder="0,00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="budget_yearly"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Orçamento Anual</FormLabel>
                          <FormControl>
                            <CurrencyInput value={field.value || ""} onChange={field.onChange} placeholder="0,00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="responsible_user_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sócio Responsável</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {members.map((member) => (
                              <SelectItem key={member.user_id} value={member.user_id}>
                                {member.profile?.full_name || member.profile?.email || "Usuário"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input type="color" className="w-12 h-10 p-1" {...field} />
                            <Input placeholder="#3B82F6" {...field} className="flex-1" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parent_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Centro de Custo Pai</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Nenhum (raiz)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum (raiz)</SelectItem>
                            {costCenters.map((cc) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.code ? `${cc.code} - ` : ""}{cc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createCostCenter.isPending}>
                      {createCostCenter.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Modal */}
      <CostCenterEditModal
        open={!!editingCenter}
        onOpenChange={(open) => !open && setEditingCenter(null)}
        costCenter={editingCenter}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <FolderTree className="w-4 h-4" />
              <span className="text-xs font-medium">Centros Ativos</span>
            </div>
            <p className="text-2xl font-bold">{centersWithBudget.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-medium">Orçamento Total</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(costCenterReport.totalBudget)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Total Gasto</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(costCenterReport.totalSpent)}</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "bg-gradient-to-br border",
          costCenterReport.overallUsage >= 100 
            ? "from-rose-500/10 to-rose-500/5 border-rose-500/20"
            : costCenterReport.overallUsage >= 80
            ? "from-amber-500/10 to-amber-500/5 border-amber-500/20"
            : "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
        )}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={cn(
                "w-4 h-4",
                costCenterReport.overallUsage >= 100 ? "text-rose-600" : costCenterReport.overallUsage >= 80 ? "text-amber-600" : "text-emerald-600"
              )} />
              <span className="text-xs font-medium">Execução</span>
            </div>
            <p className="text-2xl font-bold">{costCenterReport.overallUsage.toFixed(1)}%</p>
            <Progress value={Math.min(costCenterReport.overallUsage, 100)} className="h-1 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Cards View / Report View */}
      <Tabs defaultValue="report" className="w-full">
        <TabsList>
          <TabsTrigger value="cards" className="gap-2">
            <FolderTree className="w-4 h-4" />
            Visão em Cards
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Relatório Detalhado
          </TabsTrigger>
        </TabsList>

        {/* Cards View */}
        <TabsContent value="cards" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {centersWithBudget.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum centro de custo cadastrado
                </CardContent>
              </Card>
            ) : (
              centersWithBudget.map((center) => {
                const budgetUsed = center.budget_monthly && center.actual_spent 
                  ? (center.actual_spent / center.budget_monthly) * 100 
                  : 0;
                const budgetStatus = center.budget_monthly && center.budget_monthly > 0
                  ? getBudgetStatus(budgetUsed)
                  : null;

                return (
                  <Card key={center.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: center.color || "#3B82F6" }}
                          />
                          <CardTitle className="text-base">{center.name}</CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedCenterId(center.id)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingCenter(center)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(center.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {center.code && (
                        <Badge variant="outline" className="w-fit text-xs">
                          {center.code}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {center.description && (
                        <p className="text-sm text-muted-foreground">{center.description}</p>
                      )}

                      {center.budget_monthly && center.budget_monthly > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Orçamento Mensal</span>
                            <span className="font-medium">{formatCurrency(center.budget_monthly)}</span>
                          </div>
                          <Progress value={Math.min(budgetUsed, 100)} className="h-2" />
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Gasto: {formatCurrency(center.actual_spent || 0)}
                            </span>
                            {budgetStatus && (
                              <Badge className={`${budgetStatus.color} text-white`}>
                                {budgetStatus.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem orçamento definido</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Report View */}
        <TabsContent value="report" className="mt-4 space-y-6">
          {/* Summary Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Execução Orçamentária - {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={isExporting}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead className="text-right">Orçamento</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Salários</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">% Execução</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCenterReport.byCenter.map((item) => {
                    const totalWithSalary = item.totalSpent + item.salarySpent;
                    const saldo = (item.center.budget_monthly || 0) - totalWithSalary;
                    const status = item.center.budget_monthly && item.center.budget_monthly > 0
                      ? getBudgetStatus(item.budgetUsed)
                      : null;

                    return (
                      <TableRow key={item.center.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: item.center.color || "#3B82F6" }}
                            />
                            <div>
                              <p className="font-medium">{item.center.name}</p>
                              {item.center.code && (
                                <p className="text-xs text-muted-foreground">{item.center.code}</p>
                              )}
                              {item.collaborators.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {item.collaborators.length} colaborador{item.collaborators.length > 1 ? "es" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.center.budget_monthly ? formatCurrency(item.center.budget_monthly) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.totalSpent)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {item.salarySpent > 0 ? formatCurrency(item.salarySpent) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totalWithSalary)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          saldo >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {item.center.budget_monthly ? formatCurrency(saldo) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.center.budget_monthly && item.center.budget_monthly > 0 ? (
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={Math.min(item.budgetUsed, 100)} className="w-16 h-2" />
                              <span className="text-sm w-12">{item.budgetUsed.toFixed(1)}%</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {status ? (
                            <Badge className={cn(status.color, "text-white")}>
                              {status.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline">N/A</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedCenterId(item.center.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {/* Unassigned Row */}
                  {(costCenterReport.unassigned.length > 0 || costCenterReport.unassignedSalaryTotal > 0) && (
                    <TableRow className="bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                          <div>
                            <p className="font-medium text-muted-foreground">Sem Centro de Custo</p>
                            <p className="text-xs text-muted-foreground">
                              {costCenterReport.unassigned.length} lançamentos
                              {costCenterReport.unassignedCollaborators.length > 0 && 
                                `, ${costCenterReport.unassignedCollaborators.length} colaboradores`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(costCenterReport.unassignedTotal)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {costCenterReport.unassignedSalaryTotal > 0 ? formatCurrency(costCenterReport.unassignedSalaryTotal) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">
                        {formatCurrency(costCenterReport.unassignedTotal + costCenterReport.unassignedSalaryTotal)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">Não classificado</Badge>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}

                  {/* Total Row */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(costCenterReport.totalBudget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(costCenterReport.totalTransactionsSpent)}</TableCell>
                    <TableCell className="text-right text-amber-600">{formatCurrency(costCenterReport.totalSalarySpent)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(costCenterReport.totalSpent)}</TableCell>
                    <TableCell className={cn(
                      "text-right",
                      (costCenterReport.totalBudget - costCenterReport.totalSpent) >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {formatCurrency(costCenterReport.totalBudget - costCenterReport.totalSpent)}
                    </TableCell>
                    <TableCell className="text-right">{costCenterReport.overallUsage.toFixed(1)}%</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={!!selectedCenterId} onOpenChange={() => setSelectedCenterId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: selectedCenterData?.center.color || "#3B82F6" }}
              />
              {selectedCenterData?.center.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCenterData && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Orçamento</p>
                    <p className="text-lg font-bold">
                      {selectedCenterData.center.budget_monthly 
                        ? formatCurrency(selectedCenterData.center.budget_monthly) 
                        : "Não definido"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Realizado</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedCenterData.totalSpent)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Execução</p>
                    <p className="text-lg font-bold">{selectedCenterData.budgetUsed.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions List */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  Lançamentos ({selectedCenterData.transactions.length})
                </h4>
                {selectedCenterData.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum lançamento neste período
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCenterData.transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">
                            {format(new Date(t.due_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {t.category?.name || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(t.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
