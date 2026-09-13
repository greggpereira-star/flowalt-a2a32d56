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

      const valid = monthTransactions.filter(t => t.status !== "cancelled");

      const income = valid
        .filter(t => t.type === "income")
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const expenses = valid
        .filter(t => t.type === "expense")
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Evolução Mensal</CardTitle>
          <Badge variant="outline" className={`gap-1.5 ${trendInfo.bg}`}>
            <trendInfo.icon className={`w-3 h-3 ${trendInfo.color}`} />
            <span className={trendInfo.color}>{trendInfo.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Eixo único (R$): barras Receita/Despesa + linha de Resultado.
            A Margem % foi removida do plot (era eixo duplo) e vive no tooltip. */}
        <div className="h-[240px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
              <XAxis
                dataKey="month"
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string, item: { payload?: { margin?: number } }) => {
                  if (name === "Resultado") {
                    const m = item?.payload?.margin ?? 0;
                    return [`${formatCurrency(value)}  ·  margem ${m.toFixed(1)}%`, name];
                  }
                  return [formatCurrency(value), name];
                }}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullMonth || label}
              />
              <Bar dataKey="income" fill="hsl(142, 76%, 40%)" radius={[3, 3, 0, 0]} maxBarSize={22} name="Receitas" />
              <Bar dataKey="expenses" fill="hsl(0, 72%, 55%)" radius={[3, 3, 0, 0]} maxBarSize={22} name="Despesas" />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="hsl(217, 91%, 55%)"
                strokeWidth={2}
                dot={{ fill: "hsl(217, 91%, 55%)", strokeWidth: 2, stroke: "hsl(var(--card))", r: 4 }}
                name="Resultado"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-muted-foreground">Receitas</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm bg-rose-500" />
            <span className="text-muted-foreground">Despesas</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-0.5 bg-blue-500" />
            <span className="text-muted-foreground">Resultado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
