import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCostCentersWithBudget } from "@/hooks/useCostCenters";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function BudgetVsRealizedChart() {
  const { data: costCenters, isLoading } = useCostCentersWithBudget();

  const chartData = useMemo(() => {
    if (!costCenters) return [];
    
    return costCenters
      .filter(cc => (cc.budget_monthly || 0) > 0)
      .slice(0, 8)
      .map(cc => ({
        name: cc.name.length > 12 ? cc.name.substring(0, 12) + "..." : cc.name,
        fullName: cc.name,
        budget: cc.budget_monthly || 0,
        realized: cc.actual_spent || 0,
        variance: ((cc.budget_monthly || 0) - (cc.actual_spent || 0)),
        percentage: cc.budget_monthly ? ((cc.actual_spent || 0) / cc.budget_monthly) * 100 : 0,
      }));
  }, [costCenters]);
  const summary = useMemo(() => {
    if (!costCenters) return { totalBudget: 0, totalRealized: 0, variance: 0, percentage: 0 };
    
    const totalBudget = costCenters.reduce((acc, cc) => acc + (cc.budget_monthly || 0), 0);
    const totalRealized = costCenters.reduce((acc, cc) => acc + (cc.actual_spent || 0), 0);
    const variance = totalBudget - totalRealized;
    const percentage = totalBudget > 0 ? (totalRealized / totalBudget) * 100 : 0;
    
    return { totalBudget, totalRealized, variance, percentage };
  }, [costCenters]);

  const getStatusInfo = (percentage: number) => {
    if (percentage <= 80) return { label: "Saudável", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/30" };
    if (percentage <= 100) return { label: "Atenção", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/5 border-amber-500/30" };
    return { label: "Excedido", icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/5 border-rose-500/30" };
  };

  const statusInfo = getStatusInfo(summary.percentage);

  if (isLoading) {
    return (
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Orçado vs Realizado</CardTitle>
          <Badge variant="outline" className={`gap-1.5 ${statusInfo.bg}`}>
            <statusInfo.icon className={`w-3 h-3 ${statusInfo.color}`} />
            <span className={statusInfo.color}>{statusInfo.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-3 p-4 rounded-lg bg-muted/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Execução Geral</span>
            <span className="font-medium">{summary.percentage.toFixed(1)}%</span>
          </div>
          <Progress 
            value={Math.min(summary.percentage, 100)} 
            className={cn(
              "h-2.5",
              summary.percentage > 100 && "[&>div]:bg-rose-500",
              summary.percentage > 80 && summary.percentage <= 100 && "[&>div]:bg-amber-500",
              summary.percentage <= 80 && "[&>div]:bg-emerald-500"
            )}
          />
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Orçado</p>
              <p className="text-sm font-semibold mt-0.5">{formatCurrency(summary.totalBudget)}</p>
            </div>
            <div className="text-center border-x border-border/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Realizado</p>
              <p className="text-sm font-semibold mt-0.5">{formatCurrency(summary.totalRealized)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Variação</p>
              <p className={cn(
                "text-sm font-semibold mt-0.5",
                summary.variance >= 0 ? "text-emerald-500" : "text-rose-500"
              )}>
                {formatCurrency(summary.variance)}
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                <XAxis 
                  type="number"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  className="text-xs"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  width={90}
                  className="text-xs"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "budget" ? "Orçado" : "Realizado"
                  ]}
                  labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                />
                <Bar 
                  dataKey="budget" 
                  fill="hsl(var(--muted-foreground))" 
                  opacity={0.3}
                  radius={[0, 4, 4, 0]} 
                  barSize={16}
                  name="Orçado"
                />
                <Bar 
                  dataKey="realized" 
                  radius={[0, 4, 4, 0]} 
                  barSize={16}
                  name="Realizado"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.percentage > 100 
                          ? "hsl(0, 84%, 60%)" 
                          : entry.percentage > 80 
                          ? "hsl(45, 93%, 47%)" 
                          : "hsl(142, 76%, 36%)"
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Nenhum centro de custo com orçamento configurado
          </div>
        )}

        {/* Legend */}
        <div className="flex justify-center gap-6 pt-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
            <span className="text-muted-foreground">Orçado</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-muted-foreground">Realizado (≤80%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-muted-foreground">Atenção (80-100%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-rose-500" />
            <span className="text-muted-foreground">Excedido (&gt;100%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
