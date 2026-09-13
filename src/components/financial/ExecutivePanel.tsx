import { useMemo, useRef, useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Clock, AlertTriangle, ChevronDown, X, Search, Repeat, ArrowRight, Inbox, Mail, Loader2,
} from "lucide-react";
import {
  useFinancialPanel, usePanelCollaboratorOptions, usePanelCostCenterOptions, EMPTY_PANEL_FILTERS,
  type PanelFilterState,
} from "@/hooks/useFinancialPanel";
import { useSendFinancialReport } from "@/hooks/useSendFinancialReport";
import { useFinancialAnalysis, type AnalysisType, type FinancialAnalysisResult } from "@/hooks/useFinancialAnalysis";
import { useCategories } from "@/hooks/useFinancial";
import { useCostCenters } from "@/hooks/useCostCenters";
import { cn } from "@/lib/utils";
import { ExecutivePanelMonthlyChart } from "./ExecutivePanelMonthlyChart";
import { ExecutivePanelProjection } from "./ExecutivePanelProjection";
import { ExecutivePanelAnalysis } from "./ExecutivePanelAnalysis";
import type {
  CategoryBreakdownItem, CostCenterBreakdownItem, RecurrenceItem, OpenItem,
} from "@/lib/financialPanelCalculations";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + "%";

const formatMonthLabel = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

const formatDate = (dateStr: string) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");

const TYPE_LABELS: Record<string, string> = { income: "Receita", expense: "Despesa" };
const STATUS_LABELS: Record<string, string> = { pending: "Pendente", paid: "Pago", overdue: "Vencido" };

function describeFilters(
  filters: PanelFilterState,
  lookups: {
    categories: { id: string; name: string }[];
    costCenters: { id: string; name: string }[];
    collaboratorOptions: { id: string; full_name: string }[];
  },
): string {
  const parts: string[] = [];
  if (filters.types.length > 0) parts.push(`Tipo: ${filters.types.map((t) => TYPE_LABELS[t] || t).join("/")}`);
  if (filters.statuses.length > 0) parts.push(`Situação: ${filters.statuses.map((s) => STATUS_LABELS[s] || s).join("/")}`);
  if (filters.costCenterIds.length > 0) {
    const names = filters.costCenterIds.map((id) => lookups.costCenters.find((c) => c.id === id)?.name || id);
    parts.push(`Centro de Custo: ${names.join(", ")}`);
  }
  if (filters.categoryId) {
    parts.push(`Categoria: ${lookups.categories.find((c) => c.id === filters.categoryId)?.name || filters.categoryId}`);
  }
  if (filters.collaboratorId) {
    parts.push(`Colaborador: ${lookups.collaboratorOptions.find((c) => c.id === filters.collaboratorId)?.full_name || filters.collaboratorId}`);
  }
  if (filters.monthFrom || filters.monthTo) {
    parts.push(`Período: ${filters.monthFrom || "início"} até ${filters.monthTo || "hoje"}`);
  }
  if (filters.search) parts.push(`Busca: "${filters.search}"`);
  return parts.length > 0 ? parts.join(" · ") : "Nenhum filtro aplicado";
}

interface MultiSelectOption {
  value: string;
  label: string;
}

function MultiSelectFilter({
  label, options, selected, onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9">
          <span>{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{selected.length}</Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="space-y-1">
          {options.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
              <Checkbox
                id={`msf-${label}-${opt.value}`}
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <Label htmlFor={`msf-${label}-${opt.value}`} className="text-sm font-normal cursor-pointer flex-1">
                {opt.label}
              </Label>
            </div>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhuma opção disponível.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface IndicatorCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle: string;
  tone?: "positive" | "negative" | "neutral" | "warning";
  isLoading?: boolean;
}

function IndicatorCard({ icon: Icon, label, value, subtitle, tone = "neutral", isLoading }: IndicatorCardProps) {
  const toneClasses = {
    positive: "text-success bg-success/10",
    negative: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
    neutral: "text-primary bg-primary/10",
  }[tone];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tracking-tight mt-1 truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
          </div>
          <div className={cn("flex items-center justify-center h-9 w-9 rounded-lg shrink-0", toneClasses)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function CategoryBreakdownCard({ data, isLoading }: { data: CategoryBreakdownItem[]; isLoading?: boolean }) {
  const maxTotal = Math.max(1, ...data.map((d) => d.total));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <EmptyBlock message="Nenhum lançamento categorizado no período." />
        ) : (
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {data.map((item) => (
              <div key={item.categoryId ?? "sem-categoria"} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium truncate">{item.categoryName}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{item.count} lanç.</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  {item.income > 0 && (
                    <div className="h-full bg-success" style={{ width: `${(item.income / maxTotal) * 100}%` }} />
                  )}
                  {item.expense > 0 && (
                    <div className="h-full bg-destructive" style={{ width: `${(item.expense / maxTotal) * 100}%` }} />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.income > 0 ? `+${formatCurrency(item.income)}` : ""}</span>
                  <span>{item.expense > 0 ? `-${formatCurrency(item.expense)}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CostCenterOption { id: string; name: string; color: string }

function CostCenterDonutCard({
  data, options, isLoading,
}: { data: CostCenterBreakdownItem[]; options: CostCenterOption[]; isLoading?: boolean }) {
  const lookup = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  // Itens sem centro de custo (ou com id que não resolve a nenhum registro —
  // ex.: centro excluído) são somados numa única fatia "Sem centro de custo",
  // em vez de uma fatia distinta e indistinguível por id bruto.
  const chartData = useMemo(() => {
    const named: { name: string; value: number; percent: number; color: string }[] = [];
    let semCentro = { value: 0, percent: 0 };

    for (const item of data) {
      const opt = item.costCenterId ? lookup.get(item.costCenterId) : undefined;
      if (opt) {
        named.push({ name: opt.name, value: item.total, percent: item.percent, color: opt.color });
      } else {
        semCentro = { value: semCentro.value + item.total, percent: semCentro.percent + item.percent };
      }
    }
    if (semCentro.value > 0) {
      named.push({ name: "Sem centro de custo", ...semCentro, color: "hsl(var(--muted-foreground))" });
    }
    return named;
  }, [data, lookup]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Centro de Custo</CardTitle>
        <p className="text-xs text-muted-foreground">Distribuição das despesas do período</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : chartData.length === 0 ? (
          <EmptyBlock message="Nenhuma despesa com centro de custo no período." />
        ) : (
          <>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string, item: { payload?: { percent?: number } }) => [
                      `${formatCurrency(value)} (${(item?.payload?.percent ?? 0).toFixed(1)}%)`, name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-2">
              {chartData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground truncate max-w-[140px]">{entry.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecurrencesCard({ data, isLoading }: { data: RecurrenceItem[]; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Recorrências</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <EmptyBlock message="Nenhum lançamento recorrente identificado no período." />
        ) : (
          <div className="space-y-1">
            {data.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.count}x · média {formatCurrency(item.avgAmount)} · última em {formatDate(item.lastDueDate)}
                  </p>
                </div>
                <span className={cn("text-sm font-semibold shrink-0 tabular-nums", item.type === "income" ? "text-success" : "text-destructive")}>
                  {item.type === "income" ? "+" : "-"}{formatCurrency(item.totalAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpenItemsCard({
  data, isLoading, onViewTransactions,
}: { data: OpenItem[]; isLoading?: boolean; onViewTransactions?: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Em Aberto</CardTitle>
          {onViewTransactions && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={onViewTransactions}>
              Ver em Lançamentos <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <EmptyBlock message="Nenhum lançamento em aberto." />
        ) : (
          <div className="space-y-1">
            {data.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{formatDate(item.due_date)}</span>
                    {item.isOverdueFlag && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] border-warning/40 text-warning bg-warning/10">
                        Vencido
                      </Badge>
                    )}
                  </div>
                </div>
                <span className={cn("text-sm font-semibold shrink-0 tabular-nums", item.type === "income" ? "text-success" : "text-destructive")}>
                  {item.type === "income" ? "+" : "-"}{formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecutivePanel({ onViewTransactions }: { onViewTransactions?: () => void }) {
  const {
    filters, setFilters, isLoading, indicators, rawTransactions,
    monthlyCashflow, categoryBreakdown, costCenterBreakdown, recurrences, openItems,
    projection, breakeven, margemDesejadaPct, setMargemDesejadaPct,
  } = useFinancialPanel();
  const { data: categories = [] } = useCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: costCenterOptions = [] } = usePanelCostCenterOptions();
  const { data: collaboratorOptions = [] } = usePanelCollaboratorOptions();
  const sendReport = useSendFinancialReport();
  const reportRef = useRef<HTMLDivElement>(null);
  const analysis = useFinancialAnalysis();
  const [analysisResult, setAnalysisResult] = useState<FinancialAnalysisResult | null>(null);
  const [pendingAnalysisType, setPendingAnalysisType] = useState<AnalysisType | null>(null);

  const availableMonths = useMemo(() => {
    const set = new Set(rawTransactions.map((t) => t.due_date.slice(0, 7)));
    return Array.from(set).sort();
  }, [rawTransactions]);

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    filters.costCenterIds.length > 0 ||
    !!filters.categoryId ||
    !!filters.collaboratorId ||
    !!filters.monthFrom ||
    !!filters.monthTo ||
    !!filters.search;

  const filtersSummary = useMemo(
    () => describeFilters(filters, { categories, costCenters, collaboratorOptions }),
    [filters, categories, costCenters, collaboratorOptions],
  );

  const handleSendReport = () => {
    if (!reportRef.current) return;
    sendReport.mutate({ pageElements: [reportRef.current], filtersSummary });
  };

  const costCenterNames = useMemo(
    () => new Map(costCenterOptions.map((c) => [c.id, c.name])),
    [costCenterOptions],
  );

  const handleRequestAnalysis = (analysisType: AnalysisType) => {
    setPendingAnalysisType(analysisType);
    analysis.mutate(
      {
        analysisType,
        filtersSummary,
        indicators,
        monthlyCashflow,
        projection,
        breakeven,
        categoryBreakdown,
        costCenterBreakdown,
        costCenterNames,
        recurrences,
        openItems,
      },
      {
        onSuccess: (result) => setAnalysisResult(result),
        onSettled: () => setPendingAnalysisType(null),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Painel Executivo</h2>
          <p className="text-xs text-muted-foreground">{filtersSummary}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleSendReport}
          disabled={sendReport.isPending || isLoading}
        >
          {sendReport.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          Enviar por e-mail
        </Button>
      </div>

      {/* Barra de filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Tipo"
              options={[{ value: "income", label: "Receita" }, { value: "expense", label: "Despesa" }]}
              selected={filters.types}
              onChange={(types) => setFilters((f) => ({ ...f, types: types as ("income" | "expense")[] }))}
            />
            <MultiSelectFilter
              label="Situação"
              options={[
                { value: "pending", label: "Pendente" },
                { value: "paid", label: "Pago" },
                { value: "overdue", label: "Vencido" },
              ]}
              selected={filters.statuses}
              onChange={(statuses) => setFilters((f) => ({ ...f, statuses: statuses as ("pending" | "paid" | "overdue")[] }))}
            />
            <MultiSelectFilter
              label="Centro de Custo"
              options={costCenters.map((c) => ({ value: c.id, label: c.name }))}
              selected={filters.costCenterIds}
              onChange={(costCenterIds) => setFilters((f) => ({ ...f, costCenterIds }))}
            />

            <Select
              value={filters.categoryId || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v === "all" ? undefined : v }))}
            >
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select
              value={filters.collaboratorId || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, collaboratorId: v === "all" ? undefined : v }))}
            >
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Colaborador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores</SelectItem>
                {collaboratorOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select
              value={filters.monthFrom || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, monthFrom: v === "all" ? undefined : v }))}
            >
              <SelectTrigger className="h-9 w-[110px]"><SelectValue placeholder="De" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">De</SelectItem>
                {availableMonths.map((m) => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select
              value={filters.monthTo || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, monthTo: v === "all" ? undefined : v }))}
            >
              <SelectTrigger className="h-9 w-[110px]"><SelectValue placeholder="Até" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Até</SelectItem>
                {availableMonths.map((m) => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar na descrição..."
                className="h-9 pl-8"
                value={filters.search || ""}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={() => setFilters(EMPTY_PANEL_FILTERS)}>
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Escopo do PDF por e-mail: indicadores + fluxo mensal + projeção
          (sem categoria/centro/recorrências/em aberto, sem tabela de lançamentos). */}
      <div ref={reportRef} className="space-y-6">
      {/* Indicadores do topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <IndicatorCard
          icon={TrendingUp}
          label="Receitas"
          value={formatCurrency(indicators.receitas.total)}
          subtitle={`${indicators.receitas.count} lançamento${indicators.receitas.count === 1 ? "" : "s"} · ${formatCurrency(indicators.receitas.recebido)} recebido`}
          tone="positive"
          isLoading={isLoading}
        />
        <IndicatorCard
          icon={TrendingDown}
          label="Despesas"
          value={formatCurrency(indicators.despesas.total)}
          subtitle={`${indicators.despesas.count} lançamento${indicators.despesas.count === 1 ? "" : "s"} · ${formatCurrency(indicators.despesas.pago)} pago`}
          tone="negative"
          isLoading={isLoading}
        />
        <IndicatorCard
          icon={Wallet}
          label="Saldo do Período"
          value={formatCurrency(indicators.saldoPeriodo.total)}
          subtitle={indicators.saldoPeriodo.margemPct !== null ? `Margem: ${formatPercent(indicators.saldoPeriodo.margemPct)}` : "Sem receita no período"}
          tone={indicators.saldoPeriodo.total >= 0 ? "positive" : "negative"}
          isLoading={isLoading}
        />
        <IndicatorCard
          icon={Clock}
          label="A Receber"
          value={formatCurrency(indicators.aReceber.total)}
          subtitle="Receitas em aberto"
          tone="neutral"
          isLoading={isLoading}
        />
        <IndicatorCard
          icon={Clock}
          label="A Pagar"
          value={formatCurrency(indicators.aPagar.total)}
          subtitle="Despesas em aberto"
          tone="neutral"
          isLoading={isLoading}
        />
        <IndicatorCard
          icon={AlertTriangle}
          label="Vencido"
          value={formatCurrency(indicators.vencido.total)}
          subtitle={`${indicators.vencido.count} lançamento${indicators.vencido.count === 1 ? "" : "s"} vencido${indicators.vencido.count === 1 ? "" : "s"}`}
          tone="warning"
          isLoading={isLoading}
        />
      </div>

      {/* Fluxo mensal */}
      <ExecutivePanelMonthlyChart data={monthlyCashflow} isLoading={isLoading} />

      {/* Projeção + Ponto de equilíbrio */}
      <ExecutivePanelProjection
        projection={projection}
        breakeven={breakeven}
        margemDesejadaPct={margemDesejadaPct}
        onMargemDesejadaPctChange={setMargemDesejadaPct}
        isLoading={isLoading}
      />

      {/* Análise por IA */}
      <ExecutivePanelAnalysis
        result={analysisResult}
        pendingType={pendingAnalysisType}
        onRequest={handleRequestAnalysis}
      />
      </div>

      {/* Por categoria + Centro de custo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdownCard data={categoryBreakdown} isLoading={isLoading} />
        <CostCenterDonutCard
          data={costCenterBreakdown}
          options={costCenterOptions}
          isLoading={isLoading}
        />
      </div>

      {/* Recorrências + Em aberto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecurrencesCard data={recurrences} isLoading={isLoading} />
        <OpenItemsCard data={openItems} isLoading={isLoading} onViewTransactions={onViewTransactions} />
      </div>
    </div>
  );
}
