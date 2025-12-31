import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerateDRE } from "@/hooks/useFinancialReports";
import { useTransactions } from "@/hooks/useFinancial";
import { useTaxSettings, useLocalTaxCalculation } from "@/hooks/useTaxSettings";
import { generatePDFReport, downloadPDF, type ReportData } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const regimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

export function DREReport() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const generateDRE = useGenerateDRE();
  const { data: taxSettings } = useTaxSettings();
  const { calculateTaxes } = useLocalTaxCalculation();

  // Current period
  const currentPeriodStart = startOfMonth(selectedMonth);
  const currentPeriodEnd = endOfMonth(selectedMonth);

  // Previous period for comparison
  const previousMonth = subMonths(selectedMonth, 1);
  const previousPeriodStart = startOfMonth(previousMonth);
  const previousPeriodEnd = endOfMonth(previousMonth);

  // Fetch current period transactions
  const { data: currentTransactions = [], isLoading: currentLoading } = useTransactions({
    startDate: currentPeriodStart.toISOString().split("T")[0],
    endDate: currentPeriodEnd.toISOString().split("T")[0],
  });

  // Fetch previous period transactions for comparison
  const { data: previousTransactions = [], isLoading: previousLoading } = useTransactions({
    startDate: previousPeriodStart.toISOString().split("T")[0],
    endDate: previousPeriodEnd.toISOString().split("T")[0],
  });

  const isLoading = currentLoading || previousLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const navigateMonth = (direction: number) => {
    setSelectedMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  // Calculate DRE data for a given transaction list
  const calculateDREData = (transactions: typeof currentTransactions) => {
    const incomeByCategory = transactions
      .filter((t) => t.type === "income" && t.status === "paid")
      .reduce((acc, t) => {
        const cat = t.category?.name || "Sem categoria";
        acc[cat] = (acc[cat] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    const expensesByCategory = transactions
      .filter((t) => t.type === "expense" && t.status === "paid")
      .reduce((acc, t) => {
        const cat = t.category?.name || "Sem categoria";
        acc[cat] = (acc[cat] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
    const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);
    const operationalResult = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (operationalResult / totalIncome) * 100 : 0;

    return {
      incomeByCategory,
      expensesByCategory,
      totalIncome,
      totalExpenses,
      operationalResult,
      profitMargin,
    };
  };

  // Current period data
  const currentData = useMemo(
    () => calculateDREData(currentTransactions),
    [currentTransactions]
  );

  // Previous period data for comparison
  const previousData = useMemo(
    () => calculateDREData(previousTransactions),
    [previousTransactions]
  );

  // Calculate taxes based on regime
  const currentTaxes = useMemo(
    () => calculateTaxes(currentData.totalIncome),
    [currentData.totalIncome, calculateTaxes]
  );

  const previousTaxes = useMemo(
    () => calculateTaxes(previousData.totalIncome),
    [previousData.totalIncome, calculateTaxes]
  );

  // Net profit after taxes
  const netProfitAfterTaxes = currentData.operationalResult - currentTaxes.total_taxes;
  const prevNetProfitAfterTaxes = previousData.operationalResult - previousTaxes.total_taxes;

  // Calculate variations
  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const variations = {
    income: calculateVariation(currentData.totalIncome, previousData.totalIncome),
    expenses: calculateVariation(currentData.totalExpenses, previousData.totalExpenses),
    result: calculateVariation(currentData.operationalResult, previousData.operationalResult),
    taxes: calculateVariation(currentTaxes.total_taxes, previousTaxes.total_taxes),
    netResult: calculateVariation(netProfitAfterTaxes, prevNetProfitAfterTaxes),
  };

  const handleGenerateDRE = async () => {
    await generateDRE.mutateAsync({
      month: selectedMonth.getMonth(),
      year: selectedMonth.getFullYear(),
    });
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const reportData: ReportData = {
        title: "DRE - Demonstrativo de Resultado",
        subtitle: format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR }),
        generatedAt: new Date(),
        sections: [
          {
            title: "Resumo do Período",
            type: "summary",
            summary: [
              { label: "Receita Total", value: formatCurrency(currentData.totalIncome) },
              { label: "Despesa Total", value: formatCurrency(currentData.totalExpenses) },
              { label: "Resultado Op.", value: formatCurrency(currentData.operationalResult) },
              { label: "Margem", value: `${currentData.profitMargin.toFixed(1)}%` },
            ],
          },
          {
            title: "Receitas por Categoria",
            type: "table",
            data: {
              headers: ["Categoria", "Valor"],
              rows: Object.entries(currentData.incomeByCategory).length > 0
                ? Object.entries(currentData.incomeByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => [category, formatCurrency(amount)])
                : [["Nenhuma receita no período", "-"]],
            },
          },
          {
            title: "Despesas por Categoria",
            type: "table",
            data: {
              headers: ["Categoria", "Valor"],
              rows: Object.entries(currentData.expensesByCategory).length > 0
                ? Object.entries(currentData.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => [category, formatCurrency(amount)])
                : [["Nenhuma despesa no período", "-"]],
            },
          },
          {
            title: `Impostos (${regimeLabels[currentTaxes.regime] || "Simples Nacional"})`,
            type: "table",
            data: {
              headers: ["Tributo", "Valor"],
              rows: [
                ...(currentTaxes.das > 0 ? [["DAS (Simples Nacional)", formatCurrency(currentTaxes.das)]] : []),
                ...(currentTaxes.irpj > 0 ? [["IRPJ", formatCurrency(currentTaxes.irpj)]] : []),
                ...(currentTaxes.csll > 0 ? [["CSLL", formatCurrency(currentTaxes.csll)]] : []),
                ...(currentTaxes.pis > 0 ? [["PIS", formatCurrency(currentTaxes.pis)]] : []),
                ...(currentTaxes.cofins > 0 ? [["COFINS", formatCurrency(currentTaxes.cofins)]] : []),
                ...(currentTaxes.iss > 0 ? [["ISS", formatCurrency(currentTaxes.iss)]] : []),
                ["Total de Impostos", formatCurrency(currentTaxes.total_taxes)],
                ["Carga Tributária Efetiva", `${currentTaxes.effective_rate.toFixed(2)}%`],
              ],
            },
          },
          {
            title: "Resultado Final",
            type: "summary",
            summary: [
              { label: "Resultado Operacional", value: formatCurrency(currentData.operationalResult) },
              { label: "(-) Impostos", value: formatCurrency(currentTaxes.total_taxes) },
              { label: "Resultado Líquido", value: formatCurrency(netProfitAfterTaxes) },
            ],
          },
          {
            title: "Comparativo com Mês Anterior",
            type: "table",
            data: {
              headers: ["Métrica", "Mês Atual", "Mês Anterior", "Variação"],
              rows: [
                [
                  "Receitas",
                  formatCurrency(currentData.totalIncome),
                  formatCurrency(previousData.totalIncome),
                  `${variations.income >= 0 ? "+" : ""}${variations.income.toFixed(1)}%`,
                ],
                [
                  "Despesas",
                  formatCurrency(currentData.totalExpenses),
                  formatCurrency(previousData.totalExpenses),
                  `${variations.expenses >= 0 ? "+" : ""}${variations.expenses.toFixed(1)}%`,
                ],
                [
                  "Impostos",
                  formatCurrency(currentTaxes.total_taxes),
                  formatCurrency(previousTaxes.total_taxes),
                  `${variations.taxes >= 0 ? "+" : ""}${variations.taxes.toFixed(1)}%`,
                ],
                [
                  "Resultado Líquido",
                  formatCurrency(netProfitAfterTaxes),
                  formatCurrency(prevNetProfitAfterTaxes),
                  `${variations.netResult >= 0 ? "+" : ""}${variations.netResult.toFixed(1)}%`,
                ],
              ],
            },
          },
        ],
      };

      const doc = generatePDFReport(reportData);
      const filename = `DRE_${format(selectedMonth, "yyyy-MM")}`;
      downloadPDF(doc, filename);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const renderVariationBadge = (variation: number, invertColors = false) => {
    const isPositive = variation >= 0;
    const showPositive = invertColors ? !isPositive : isPositive;

    return (
      <Badge
        className={cn(
          "gap-1",
          showPositive
            ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
            : "bg-rose-500/20 text-rose-600 border-rose-500/30"
        )}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {isPositive ? "+" : ""}
        {variation.toFixed(1)}%
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            DRE - Demonstrativo de Resultado
          </h3>
          <p className="text-sm text-muted-foreground">
            Análise de receitas e despesas do período
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[150px] text-center font-medium capitalize">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 hidden sm:block" />
          <Button
            variant="outline"
            onClick={handleGenerateDRE}
            disabled={generateDRE.isPending}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", generateDRE.isPending && "animate-spin")}
            />
            Gerar DRE
          </Button>
          <Button onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Main DRE Card */}
      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Demonstrativo de Resultado do Exercício
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Período: {format(currentPeriodStart, "dd/MM/yyyy")} a{" "}
            {format(currentPeriodEnd, "dd/MM/yyyy")}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {/* Receitas */}
            <div className="p-4">
              <div className="flex justify-between items-center font-semibold text-emerald-600 mb-2">
                <span>RECEITAS OPERACIONAIS</span>
                <span>{formatCurrency(currentData.totalIncome)}</span>
              </div>
              <div className="space-y-1 pl-4">
                {Object.entries(currentData.incomeByCategory).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhuma receita no período
                  </div>
                ) : (
                  Object.entries(currentData.incomeByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span>{formatCurrency(amount)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Despesas */}
            <div className="p-4">
              <div className="flex justify-between items-center font-semibold text-rose-600 mb-2">
                <span>DESPESAS OPERACIONAIS</span>
                <span>({formatCurrency(currentData.totalExpenses)})</span>
              </div>
              <div className="space-y-1 pl-4">
                {Object.entries(currentData.expensesByCategory).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhuma despesa no período
                  </div>
                ) : (
                  Object.entries(currentData.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span>({formatCurrency(amount)})</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <Separator />

            {/* Resultado Operacional */}
            <div className="p-4 bg-muted/30">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>RESULTADO OPERACIONAL (EBITDA)</span>
                <span
                  className={
                    currentData.operationalResult >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }
                >
                  {formatCurrency(currentData.operationalResult)}
                </span>
              </div>
            </div>

            {/* Impostos */}
            <div className="p-4">
              <div className="flex justify-between items-center font-semibold text-amber-600 mb-2">
                <div className="flex items-center gap-2">
                  <span>IMPOSTOS SOBRE RECEITA</span>
                  <Badge variant="outline" className="text-xs">
                    {regimeLabels[currentTaxes.regime] || "Simples Nacional"}
                  </Badge>
                </div>
                <span>({formatCurrency(currentTaxes.total_taxes)})</span>
              </div>
              <div className="space-y-1 pl-4">
                {currentTaxes.das > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">DAS (Simples Nacional)</span>
                    <span>({formatCurrency(currentTaxes.das)})</span>
                  </div>
                )}
                {currentTaxes.irpj > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IRPJ</span>
                    <span>({formatCurrency(currentTaxes.irpj)})</span>
                  </div>
                )}
                {currentTaxes.csll > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CSLL</span>
                    <span>({formatCurrency(currentTaxes.csll)})</span>
                  </div>
                )}
                {currentTaxes.pis > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PIS</span>
                    <span>({formatCurrency(currentTaxes.pis)})</span>
                  </div>
                )}
                {currentTaxes.cofins > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">COFINS</span>
                    <span>({formatCurrency(currentTaxes.cofins)})</span>
                  </div>
                )}
                {currentTaxes.iss > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ISS</span>
                    <span>({formatCurrency(currentTaxes.iss)})</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Carga Tributária Efetiva</span>
                  <span className="font-medium">{currentTaxes.effective_rate.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Resultado Líquido */}
            <div className="p-4 bg-primary/5">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>RESULTADO LÍQUIDO (após impostos)</span>
                <div className="flex items-center gap-2">
                  {netProfitAfterTaxes > 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ) : netProfitAfterTaxes < 0 ? (
                    <TrendingDown className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Minus className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span
                    className={
                      netProfitAfterTaxes >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }
                  >
                    {formatCurrency(netProfitAfterTaxes)}
                  </span>
                </div>
              </div>
            </div>

            {/* Indicadores */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600">
                  {formatCurrency(currentData.totalIncome)}
                </div>
                <div className="text-sm text-muted-foreground">Receita Bruta</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-rose-600">
                  {formatCurrency(currentData.totalExpenses)}
                </div>
                <div className="text-sm text-muted-foreground">Despesas</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-600">
                  {formatCurrency(currentTaxes.total_taxes)}
                </div>
                <div className="text-sm text-muted-foreground">Impostos</div>
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    "text-xl font-bold",
                    netProfitAfterTaxes >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  )}
                >
                  {formatCurrency(netProfitAfterTaxes)}
                </div>
                <div className="text-sm text-muted-foreground">Lucro Líquido</div>
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    "text-xl font-bold",
                    currentData.profitMargin >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {currentData.totalIncome > 0 
                    ? ((netProfitAfterTaxes / currentData.totalIncome) * 100).toFixed(1)
                    : "0.0"}%
                </div>
                <div className="text-sm text-muted-foreground">Margem Líquida</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativo com Mês Anterior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Comparativo com {format(previousMonth, "MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Receitas */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/30">
              <div className="text-sm text-muted-foreground">Variação Receita</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(currentData.totalIncome)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Anterior: {formatCurrency(previousData.totalIncome)}
                  </div>
                </div>
                {renderVariationBadge(variations.income)}
              </div>
            </div>

            {/* Despesas */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/30">
              <div className="text-sm text-muted-foreground">Variação Despesa</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(currentData.totalExpenses)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Anterior: {formatCurrency(previousData.totalExpenses)}
                  </div>
                </div>
                {renderVariationBadge(variations.expenses, true)}
              </div>
            </div>

            {/* Resultado */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/30">
              <div className="text-sm text-muted-foreground">Variação Resultado</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(currentData.operationalResult)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Anterior: {formatCurrency(previousData.operationalResult)}
                  </div>
                </div>
                {renderVariationBadge(variations.result)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
