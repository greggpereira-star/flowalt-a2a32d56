import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { MonthlyCashflowPoint } from "@/lib/financialPanelCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const INCOME_COLOR = "hsl(142, 76%, 40%)";
const EXPENSE_COLOR = "hsl(0, 72%, 55%)";
const BALANCE_COLOR = "hsl(217, 91%, 55%)";

interface ExecutivePanelMonthlyChartProps {
  data: MonthlyCashflowPoint[];
  isLoading?: boolean;
}

export function ExecutivePanelMonthlyChart({ data, isLoading }: ExecutivePanelMonthlyChartProps) {
  const [balanceMode, setBalanceMode] = useState<"mensal" | "acumulado">("mensal");

  const firstFutureLabel = useMemo(() => data.find((d) => d.isFuture)?.monthLabel, [data]);
  const hasFuture = !!firstFutureLabel;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Fluxo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum lançamento no período selecionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Fluxo Mensal</CardTitle>
          <div className="inline-flex rounded-md border border-border/60 p-0.5">
            <Button
              type="button"
              variant={balanceMode === "mensal" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setBalanceMode("mensal")}
            >
              Saldo mensal
            </Button>
            <Button
              type="button"
              variant={balanceMode === "acumulado" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setBalanceMode("acumulado")}
            >
              Saldo acumulado
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <pattern id="hatchIncome" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill={INCOME_COLOR} fillOpacity={0.25} />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={INCOME_COLOR} strokeWidth="2" />
                </pattern>
                <pattern id="hatchExpense" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill={EXPENSE_COLOR} fillOpacity={0.25} />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={EXPENSE_COLOR} strokeWidth="2" />
                </pattern>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
              <XAxis dataKey="monthLabel" className="text-xs text-muted-foreground" axisLine={false} tickLine={false} dy={8} />
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
                formatter={(value: number, name: string, item: { payload?: MonthlyCashflowPoint }) => {
                  const label = name === "income" ? "Receitas" : name === "expense" ? "Despesas" : "Saldo";
                  const suffix = item?.payload?.isFuture ? " (previsto)" : "";
                  return [`${formatCurrency(value)}${suffix}`, label];
                }}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullMonthLabel || label}
              />
              {hasFuture && (
                <ReferenceLine
                  x={firstFutureLabel}
                  strokeDasharray="4 4"
                  stroke="hsl(var(--muted-foreground))"
                  label={{ value: "Previsto →", position: "insideTopRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
              )}
              <Bar dataKey="income" radius={[3, 3, 0, 0]} maxBarSize={22} name="income">
                {data.map((d, i) => (
                  <Cell key={i} fill={d.isFuture ? "url(#hatchIncome)" : INCOME_COLOR} />
                ))}
              </Bar>
              <Bar dataKey="expense" radius={[3, 3, 0, 0]} maxBarSize={22} name="expense">
                {data.map((d, i) => (
                  <Cell key={i} fill={d.isFuture ? "url(#hatchExpense)" : EXPENSE_COLOR} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey={balanceMode === "mensal" ? "saldoMensal" : "saldoAcumulado"}
                stroke={BALANCE_COLOR}
                strokeWidth={2}
                dot={{ fill: BALANCE_COLOR, strokeWidth: 2, stroke: "hsl(var(--card))", r: 4 }}
                name="saldo"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} />
            <span className="text-muted-foreground">Receitas</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} />
            <span className="text-muted-foreground">Despesas</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-0.5" style={{ backgroundColor: BALANCE_COLOR }} />
            <span className="text-muted-foreground">
              Saldo {balanceMode === "mensal" ? "mensal" : "acumulado"}
            </span>
          </div>
          {hasFuture && (
            <div className={cn("flex items-center gap-2 text-xs")}>
              <div className="w-3 h-3 rounded-sm border border-muted-foreground/40" style={{ backgroundImage: "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 3px)", color: "hsl(var(--muted-foreground))" }} />
              <span className="text-muted-foreground">Previsto (mês futuro)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
