import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { ProjectionPoint, BreakevenResult } from "@/lib/financialPanelCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const INCOME_COLOR = "hsl(142, 76%, 36%)";
const EXPENSE_COLOR = "hsl(0, 84%, 60%)";
const CUMULATIVE_COLOR = "hsl(217, 91%, 60%)";

interface ExecutivePanelProjectionProps {
  projection: ProjectionPoint[];
  breakeven: BreakevenResult | null;
  margemDesejadaPct: number;
  onMargemDesejadaPctChange: (value: number) => void;
  isLoading?: boolean;
}

export function ExecutivePanelProjection({
  projection, breakeven, margemDesejadaPct, onMargemDesejadaPctChange, isLoading,
}: ExecutivePanelProjectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Projeção de Fluxo de Caixa</CardTitle>
          <p className="text-xs text-muted-foreground">
            Baseada na média mensal de receita e despesa do histórico filtrado
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : projection.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">
              Sem histórico suficiente para projetar com os filtros atuais.
            </p>
          ) : (
            <>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projection} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="projIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={INCOME_COLOR} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={INCOME_COLOR} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="projExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={EXPENSE_COLOR} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={EXPENSE_COLOR} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="projCumulative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CUMULATIVE_COLOR} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CUMULATIVE_COLOR} stopOpacity={0} />
                      </linearGradient>
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
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "projectedIncome" ? "Receita projetada" : name === "projectedExpense" ? "Despesa projetada" : "Acumulado",
                      ]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullMonthLabel || label}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="projectedIncome" stroke={INCOME_COLOR} strokeWidth={2} fillOpacity={1} fill="url(#projIncome)" name="projectedIncome" />
                    <Area type="monotone" dataKey="projectedExpense" stroke={EXPENSE_COLOR} strokeWidth={2} fillOpacity={1} fill="url(#projExpense)" name="projectedExpense" />
                    <Area type="monotone" dataKey="cumulative" stroke={CUMULATIVE_COLOR} strokeWidth={2.5} fillOpacity={1} fill="url(#projCumulative)" name="cumulative" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-5 pt-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} />
                  <span className="text-muted-foreground">Receita projetada</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} />
                  <span className="text-muted-foreground">Despesa projetada</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CUMULATIVE_COLOR }} />
                  <span className="text-muted-foreground">Acumulado</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Ponto de Equilíbrio</CardTitle>
          <p className="text-xs text-muted-foreground">
            Receita mensal necessária para atingir a margem desejada
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="margem-desejada" className="text-xs">Margem desejada (%)</Label>
            <Input
              id="margem-desejada"
              type="number"
              min={0}
              max={99}
              step={1}
              value={margemDesejadaPct}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) onMargemDesejadaPctChange(Math.min(99, Math.max(0, v)));
              }}
              className="h-9 w-28"
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !breakeven ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem histórico suficiente para calcular o ponto de equilíbrio com os filtros atuais.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Despesa média/mês</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(breakeven.despesaMedia)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receita média/mês</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(breakeven.receitaMedia)}</p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/30 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Receita necessária p/ {breakeven.margemDesejadaPct}% de margem</p>
                <p className="text-xl font-semibold tabular-nums">{formatCurrency(breakeven.receitaNecessaria)}</p>
                <p className="text-[10px] text-muted-foreground">necessário = despesa ÷ (1 − margem)</p>
              </div>

              <div className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                breakeven.gap > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
              )}>
                <span>{breakeven.gap > 0 ? "Falta para bater a meta" : "Meta batida (superávit)"}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(Math.abs(breakeven.gap))}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
