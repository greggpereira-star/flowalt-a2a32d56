import { useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdvancedKPICards } from "./AdvancedKPICards";
import { AgingReportChart } from "./AgingReportChart";
import { CashFlowForecastChart } from "./CashFlowForecastChart";
import { BudgetVsRealizedChart } from "./BudgetVsRealizedChart";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { useFinancialKPIs } from "@/hooks/useFinancialKPIs";
import { Skeleton } from "@/components/ui/skeleton";

export function AdvancedFinancialDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { data: kpis, isLoading, refetch } = useFinancialKPIs(selectedMonth);

  const navigateMonth = (direction: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Dashboard Financeiro</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão executiva e indicadores avançados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetch()}
            className="h-9 w-9"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigateMonth(-1)}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigateMonth(1)}
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <AdvancedKPICards kpis={kpis} isLoading={isLoading} />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendChart selectedMonth={selectedMonth} />
        <AgingReportChart aging={kpis?.aging} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CashFlowForecastChart />
        <BudgetVsRealizedChart />
      </div>
    </div>
  );
}
