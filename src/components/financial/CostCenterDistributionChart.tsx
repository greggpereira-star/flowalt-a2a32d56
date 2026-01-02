import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, PieChart as PieChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostCenterData {
  id: string;
  name: string;
  color: string;
  totalSpent: number;
  salarySpent: number;
}

interface CostCenterDistributionChartProps {
  centersData: CostCenterData[];
  unassignedTotal: number;
  unassignedSalaryTotal: number;
  onUnassignedClick?: () => void;
}

export function CostCenterDistributionChart({
  centersData,
  unassignedTotal,
  unassignedSalaryTotal,
  onUnassignedClick,
}: CostCenterDistributionChartProps) {
  const chartData = useMemo(() => {
    const data = centersData
      .map((center) => ({
        name: center.name,
        value: center.totalSpent + center.salarySpent,
        color: center.color || "#3B82F6",
      }))
      .filter((item) => item.value > 0);

    const unassignedValue = unassignedTotal + unassignedSalaryTotal;
    if (unassignedValue > 0) {
      data.push({
        name: "Sem Centro de Custo",
        value: unassignedValue,
        color: "#9CA3AF",
      });
    }

    return data;
  }, [centersData, unassignedTotal, unassignedSalaryTotal]);

  const totalValue = chartData.reduce((acc, item) => acc + item.value, 0);
  const classifiedValue = totalValue - (unassignedTotal + unassignedSalaryTotal);
  const classificationPercentage = totalValue > 0 ? (classifiedValue / totalValue) * 100 : 100;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : 0;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-medium text-sm">{data.name}</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(data.value)}</p>
          <p className="text-xs text-muted-foreground">{percentage}% do total</p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {payload.map((entry: any, index: number) => (
          <button
            key={`legend-${index}`}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
              entry.payload.name === "Sem Centro de Custo"
                ? "hover:bg-amber-500/10 cursor-pointer"
                : "hover:bg-muted"
            )}
            onClick={() => {
              if (entry.payload.name === "Sem Centro de Custo" && onUnassignedClick) {
                onUnassignedClick();
              }
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </button>
        ))}
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            Distribuição por Centro de Custo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <PieChartIcon className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum gasto registrado no período</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            Distribuição por Centro de Custo
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              classificationPercentage >= 90
                ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                : classificationPercentage >= 70
                ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
                : "border-rose-500/30 text-rose-600 bg-rose-500/10"
            )}
          >
            {classificationPercentage >= 90 ? (
              <CheckCircle2 className="w-3 h-3 mr-1" />
            ) : (
              <AlertTriangle className="w-3 h-3 mr-1" />
            )}
            {classificationPercentage.toFixed(0)}% classificado
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Classification Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Cobertura de Classificação</span>
            <span
              className={cn(
                "font-medium",
                classificationPercentage >= 90
                  ? "text-emerald-600"
                  : classificationPercentage >= 70
                  ? "text-amber-600"
                  : "text-rose-600"
              )}
            >
              {formatCurrency(classifiedValue)} de {formatCurrency(totalValue)}
            </span>
          </div>
          <div className="relative">
            <Progress value={classificationPercentage} className="h-2" />
            {classificationPercentage < 100 && (
              <div
                className="absolute top-0 right-0 h-2 bg-gray-300 dark:bg-gray-600 rounded-r-full"
                style={{ width: `${100 - classificationPercentage}%` }}
              />
            )}
          </div>
          {classificationPercentage < 90 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              {(100 - classificationPercentage).toFixed(1)}% dos gastos não estão classificados
            </p>
          )}
        </div>

        {/* Donut Chart */}
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={entry.name === "Sem Centro de Custo" ? "#F59E0B" : "transparent"}
                    strokeWidth={entry.name === "Sem Centro de Custo" ? 2 : 0}
                    style={{ cursor: entry.name === "Sem Centro de Custo" ? "pointer" : "default" }}
                    onClick={() => {
                      if (entry.name === "Sem Centro de Custo" && onUnassignedClick) {
                        onUnassignedClick();
                      }
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderCustomLegend} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center Total */}
        <div className="text-center -mt-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
