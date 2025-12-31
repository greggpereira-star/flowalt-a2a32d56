import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions } from "@/hooks/useFinancial";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface MonthlyTrendChartProps {
  selectedMonth: Date;
}

export function MonthlyTrendChart({ selectedMonth }: MonthlyTrendChartProps) {
  const months = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => subMonths(selectedMonth, 5 - i))
  , [selectedMonth]);

  const { data: allTransactions = [], isLoading } = useTransactions({
    startDate: format(startOfMonth(months[0]), "yyyy-MM-dd"),
    endDate: format(endOfMonth(selectedMonth), "yyyy-MM-dd"),
  });

  const chartData = useMemo(() => {
    return months.map(month => {
      const monthTransactions = allTransactions.filter(t => {
        const date = new Date(t.due_date);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      });

      const income = monthTransactions
        .filter(t => t.type === "income" && t.status === "paid")
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const expenses = monthTransactions
        .filter(t => t.type === "expense" && t.status === "paid")
        .reduce((acc, t) => acc + Number(t.amount), 0);

      return {
        month: format(month, "MMM", { locale: ptBR }),
        fullMonth: format(month, "MMMM yyyy", { locale: ptBR }),
        income,
        expenses,
        profit: income - expenses,
        margin: income > 0 ? ((income - expenses) / income) * 100 : 0,
      };
    });
  }, [months, allTransactions]);

  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const recent = chartData.slice(-3).reduce((acc, d) => acc + d.profit, 0) / 3;
    const earlier = chartData.slice(0, 3).reduce((acc, d) => acc + d.profit, 0) / 3;
    return earlier !== 0 ? ((recent - earlier) / Math.abs(earlier)) * 100 : 0;
  }, [chartData]);

  const trendInfo = trend > 5 
    ? { label: "Em alta", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/30" }
    : trend < -5 
    ? { label: "Em queda", icon: TrendingDown, color: "text-rose-500", bg: "bg-rose-500/5 border-rose-500/30" }
    : { label: "Estável", icon: Minus, color: "text-muted-foreground", bg: "bg-muted" };

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
          <CardTitle className="text-base font-semibold">Evolução Mensal</CardTitle>
          <Badge variant="outline" className={`gap-1.5 ${trendInfo.bg}`}>
            <trendInfo.icon className={`w-3 h-3 ${trendInfo.color}`} />
            <span className={trendInfo.color}>{trendInfo.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
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
                yAxisId="left"
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
                dx={-10}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
                domain={[-50, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}
                formatter={(value: number, name: string) => {
                  if (name === "margin") return [`${value.toFixed(1)}%`, "Margem"];
                  return [formatCurrency(value), name === "income" ? "Receitas" : name === "expenses" ? "Despesas" : "Resultado"];
                }}
                labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label}
              />
              <Bar 
                yAxisId="left"
                dataKey="income" 
                fill="hsl(142, 76%, 36%)" 
                radius={[4, 4, 0, 0]} 
                barSize={28}
                name="Receitas"
              />
              <Bar 
                yAxisId="left"
                dataKey="expenses" 
                fill="hsl(0, 84%, 60%)" 
                radius={[4, 4, 0, 0]} 
                barSize={28}
                name="Despesas"
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="profit"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#profitGradient)"
                name="Resultado"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="margin"
                stroke="hsl(280, 87%, 65%)"
                strokeWidth={2}
                dot={{ fill: "hsl(280, 87%, 65%)", strokeWidth: 0, r: 4 }}
                name="Margem"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 pt-4">
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
            <span className="text-muted-foreground">Resultado</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-0.5 bg-purple-500" />
            <span className="text-muted-foreground">Margem %</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
