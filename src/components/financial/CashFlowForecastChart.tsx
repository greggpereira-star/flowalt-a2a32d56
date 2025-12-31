import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useCashFlowProjection } from "@/hooks/useFinancialKPIs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: Math.abs(value) >= 1000000 ? "compact" : "standard",
  }).format(value);
};

export function CashFlowForecastChart() {
  const { data: projections, isLoading } = useCashFlowProjection(12);

  if (isLoading) {
    return (
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const data = projections || [];
  const lastBalance = data[data.length - 1]?.cumulative || 0;
  const firstBalance = data[0]?.cumulative || 0;
  const trend = lastBalance - firstBalance;
  
  const trendInfo = trend > 0 
    ? { label: "Tendência positiva", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/30" }
    : trend < 0 
    ? { label: "Tendência negativa", icon: TrendingDown, color: "text-rose-500", bg: "bg-rose-500/5 border-rose-500/30" }
    : { label: "Estável", icon: Minus, color: "text-muted-foreground", bg: "bg-muted" };

  // Find months where cumulative goes negative
  const criticalMonths = data.filter(d => d.cumulative < 0);

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Projeção de Fluxo de Caixa</CardTitle>
          <Badge variant="outline" className={`gap-1.5 ${trendInfo.bg}`}>
            <trendInfo.icon className={`w-3 h-3 ${trendInfo.color}`} />
            <span className={trendInfo.color}>{trendInfo.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Próximo Mês</p>
            <p className={`text-lg font-semibold mt-1 ${data[0]?.balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {formatCurrency(data[0]?.balance || 0)}
            </p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Em 6 Meses</p>
            <p className={`text-lg font-semibold mt-1 ${(data[5]?.cumulative || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {formatCurrency(data[5]?.cumulative || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Em 12 Meses</p>
            <p className={`text-lg font-semibold mt-1 ${lastBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {formatCurrency(lastBalance)}
            </p>
          </div>
        </div>

        {/* Warning for negative months */}
        {criticalMonths.length > 0 && (
          <div className="px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20 text-sm text-rose-600">
            ⚠️ Alerta: {criticalMonths.length} mês(es) com saldo negativo projetado
          </div>
        )}

        {/* Chart */}
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
              <XAxis 
                dataKey="month" 
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
                dx={-10}
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
                  name === "income" ? "Receitas" : name === "expenses" ? "Despesas" : "Acumulado"
                ]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIncome)"
                name="Receitas"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExpenses)"
                name="Despesas"
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorCumulative)"
                name="Acumulado"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 pt-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-muted-foreground">Receitas</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-rose-500" />
            <span className="text-muted-foreground">Despesas</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-muted-foreground">Acumulado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
