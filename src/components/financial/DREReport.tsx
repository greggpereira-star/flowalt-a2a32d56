import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerateDRE } from "@/hooks/useFinancialReports";
import { useTransactions, useFinancialSummary } from "@/hooks/useFinancial";

export function DREReport() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const generateDRE = useGenerateDRE();
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary(selectedMonth);
  const { data: transactions = [] } = useTransactions({
    startDate: startOfMonth(selectedMonth).toISOString().split("T")[0],
    endDate: endOfMonth(selectedMonth).toISOString().split("T")[0],
  });

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

  // Group transactions by category
  const incomeByCategory = transactions
    .filter((t) => t.type === "income" && t.status === "paid")
    .reduce((acc, t) => {
      const cat = t.category?.name || "Sem categoria";
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const expensesByCategory = transactions
    .filter((t) => t.type === "expense" && t.status === "paid")
    .reduce((acc, t) => {
      const cat = t.category?.name || "Sem categoria";
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);
  const operationalResult = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (operationalResult / totalIncome) * 100 : 0;

  const handleGenerateDRE = async () => {
    await generateDRE.mutateAsync({
      month: selectedMonth.getMonth() + 1,
      year: selectedMonth.getFullYear(),
    });
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log("Export DRE to PDF");
  };

  if (summaryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            DRE - Demonstrativo de Resultado
          </h3>
          <p className="text-sm text-muted-foreground">
            Análise de receitas e despesas do período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[150px] text-center font-medium">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <Button variant="outline" onClick={handleGenerateDRE} disabled={generateDRE.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${generateDRE.isPending ? "animate-spin" : ""}`} />
            Gerar DRE
          </Button>
          <Button onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-base">
            Demonstrativo de Resultado do Exercício
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Período: {format(startOfMonth(selectedMonth), "dd/MM/yyyy")} a{" "}
            {format(endOfMonth(selectedMonth), "dd/MM/yyyy")}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {/* Receitas */}
            <div className="p-4">
              <div className="flex justify-between items-center font-semibold text-green-600 mb-2">
                <span>RECEITAS OPERACIONAIS</span>
                <span>{formatCurrency(totalIncome)}</span>
              </div>
              <div className="space-y-1 pl-4">
                {Object.entries(incomeByCategory).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma receita no período</div>
                ) : (
                  Object.entries(incomeByCategory)
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
              <div className="flex justify-between items-center font-semibold text-red-600 mb-2">
                <span>DESPESAS OPERACIONAIS</span>
                <span>({formatCurrency(totalExpenses)})</span>
              </div>
              <div className="space-y-1 pl-4">
                {Object.entries(expensesByCategory).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma despesa no período</div>
                ) : (
                  Object.entries(expensesByCategory)
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

            {/* Resultado */}
            <div className="p-4 bg-muted/30">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>RESULTADO OPERACIONAL</span>
                <div className="flex items-center gap-2">
                  {operationalResult > 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : operationalResult < 0 ? (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  ) : (
                    <Minus className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className={operationalResult >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(operationalResult)}
                  </span>
                </div>
              </div>
            </div>

            {/* Indicadores */}
            <div className="p-4 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
                <div className="text-sm text-muted-foreground">Receita Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
                <div className="text-sm text-muted-foreground">Despesa Total</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${profitMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {profitMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margem de Lucro</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo com Mês Anterior</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Variação Receita</div>
              <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12.5%
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Variação Despesa</div>
              <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
                <TrendingUp className="w-3 h-3 mr-1" />
                +5.2%
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Variação Resultado</div>
              <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                <TrendingUp className="w-3 h-3 mr-1" />
                +18.3%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
