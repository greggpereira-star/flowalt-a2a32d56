import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from "recharts";
import { FinancialKPIs } from "@/hooks/useFinancialKPIs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgingReportChartProps {
  aging: FinancialKPIs["aging"] | undefined;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const COLORS = {
  current: "hsl(142, 76%, 36%)", // emerald
  days30: "hsl(45, 93%, 47%)",   // amber
  days60: "hsl(27, 96%, 61%)",   // orange
  days90: "hsl(0, 84%, 60%)",    // rose
  over90: "hsl(0, 72%, 51%)",    // red
};

export function AgingReportChart({ aging }: AgingReportChartProps) {
  const data = useMemo(() => {
    if (!aging) return [];
    
    return [
      { name: "A vencer", value: aging.current, color: COLORS.current, key: "current" },
      { name: "1-30 dias", value: aging.days30, color: COLORS.days30, key: "days30" },
      { name: "31-60 dias", value: aging.days60, color: COLORS.days60, key: "days60" },
      { name: "61-90 dias", value: aging.days90, color: COLORS.days90, key: "days90" },
      { name: "+90 dias", value: aging.over90, color: COLORS.over90, key: "over90" },
    ];
  }, [aging]);

  const totalReceivables = aging 
    ? aging.current + aging.days30 + aging.days60 + aging.days90 + aging.over90 
    : 0;
  
  const overdueAmount = aging 
    ? aging.days30 + aging.days60 + aging.days90 + aging.over90 
    : 0;

  const healthScore = totalReceivables > 0 
    ? Math.max(0, 100 - (overdueAmount / totalReceivables) * 100)
    : 100;

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: "Saudável", variant: "success" as const, icon: CheckCircle2 };
    if (score >= 50) return { label: "Atenção", variant: "warning" as const, icon: Clock };
    return { label: "Crítico", variant: "danger" as const, icon: AlertTriangle };
  };

  const healthStatus = getHealthStatus(healthScore);

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Aging de Recebíveis</CardTitle>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1.5 font-medium",
              healthStatus.variant === "success" && "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
              healthStatus.variant === "warning" && "border-amber-500/30 bg-amber-500/5 text-amber-600",
              healthStatus.variant === "danger" && "border-rose-500/30 bg-rose-500/5 text-rose-600"
            )}
          >
            <healthStatus.icon className="w-3 h-3" />
            {healthStatus.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-lg font-semibold mt-1">{formatCurrency(totalReceivables)}</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencidos</p>
            <p className="text-lg font-semibold mt-1 text-rose-500">{formatCurrency(overdueAmount)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Score</p>
            <p className={cn(
              "text-lg font-semibold mt-1",
              healthScore >= 80 ? "text-emerald-500" : healthScore >= 50 ? "text-amber-500" : "text-rose-500"
            )}>
              {healthScore.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[180px]">
          {data.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  className="text-xs"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={70}
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
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Nenhum recebível pendente
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2">
          {data.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 text-xs">
              <div 
                className="w-2.5 h-2.5 rounded-sm" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
