import { startOfDay } from "date-fns";
import type { Transaction } from "@/hooks/useFinancial";

// Transações do tipo 'transfer' (transferência entre contas próprias) e do
// status 'cancelled' nunca entram nos cálculos do Painel Executivo — não são
// receita/despesa real nem estão de fato "em aberto".
export function isRelevantTransaction(t: Transaction): boolean {
  return t.type !== "transfer" && t.status !== "cancelled";
}

const OPEN_STATUSES = new Set(["pending", "overdue"]);
export function isOpen(t: Transaction): boolean {
  return OPEN_STATUSES.has(t.status);
}

// "Vencido" é sempre recalculado a partir de due_date, nunca a partir do
// status 'overdue' gravado — esse status pode não estar em dia se nada o
// mantém sincronizado em tempo real; a data é a fonte da verdade.
export function isOverdue(t: Transaction, today: Date): boolean {
  if (!isOpen(t)) return false;
  return startOfDay(new Date(t.due_date + "T00:00:00")) < startOfDay(today);
}

export interface PanelFilters {
  types: Array<"income" | "expense">; // vazio = todos
  statuses: Array<"pending" | "paid" | "overdue">; // vazio = todos
  monthFrom?: string; // "YYYY-MM"
  monthTo?: string; // "YYYY-MM"
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
}

// Aplica os filtros que os indicadores/gráficos respeitam. A projeção (fase
// futura) usa o conjunto bruto e ignora tipo/situação/período de propósito —
// ver nota na spec original.
export function filterForIndicators(all: Transaction[], filters: PanelFilters): Transaction[] {
  return all.filter((t) => {
    if (!isRelevantTransaction(t)) return false;
    if (filters.types.length > 0 && !filters.types.includes(t.type as "income" | "expense")) return false;
    if (filters.statuses.length > 0) {
      // "overdue" no filtro é um recorte de "pending" vencido, não o status bruto.
      const matchesStatus = filters.statuses.some((s) => {
        if (s === "overdue") return t.status === "pending" || t.status === "overdue";
        return t.status === s;
      });
      if (!matchesStatus) return false;
    }
    const mk = monthKey(t.due_date);
    if (filters.monthFrom && mk < filters.monthFrom) return false;
    if (filters.monthTo && mk > filters.monthTo) return false;
    return true;
  });
}

export interface TopIndicators {
  receitas: { total: number; count: number; recebido: number };
  despesas: { total: number; count: number; pago: number };
  saldoPeriodo: { total: number; margemPct: number | null };
  aReceber: { total: number };
  aPagar: { total: number };
  vencido: { total: number; count: number };
}

export function computeTopIndicators(filtered: Transaction[], today: Date = new Date()): TopIndicators {
  const income = filtered.filter((t) => t.type === "income");
  const expense = filtered.filter((t) => t.type === "expense");

  const receitasTotal = income.reduce((acc, t) => acc + Number(t.amount), 0);
  const despesasTotal = expense.reduce((acc, t) => acc + Number(t.amount), 0);
  const recebido = income.filter((t) => t.status === "paid").reduce((acc, t) => acc + Number(t.amount), 0);
  const pago = expense.filter((t) => t.status === "paid").reduce((acc, t) => acc + Number(t.amount), 0);

  const aReceber = income.filter(isOpen).reduce((acc, t) => acc + Number(t.amount), 0);
  const aPagar = expense.filter(isOpen).reduce((acc, t) => acc + Number(t.amount), 0);

  const vencidos = filtered.filter((t) => isOverdue(t, today));
  const vencidoTotal = vencidos.reduce((acc, t) => acc + Number(t.amount), 0);

  const saldoTotal = receitasTotal - despesasTotal;

  return {
    receitas: { total: receitasTotal, count: income.length, recebido },
    despesas: { total: despesasTotal, count: expense.length, pago },
    saldoPeriodo: { total: saldoTotal, margemPct: receitasTotal > 0 ? (saldoTotal / receitasTotal) * 100 : null },
    aReceber: { total: aReceber },
    aPagar: { total: aPagar },
    vencido: { total: vencidoTotal, count: vencidos.length },
  };
}

export interface MonthlyCashflowPoint {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "jan/26"
  fullMonthLabel: string; // "janeiro de 2026"
  income: number;
  expense: number;
  saldoMensal: number;
  saldoAcumulado: number;
  isFuture: boolean;
}

// Fluxo mensal: barras de receita/despesa + saldo (mensal ou acumulado, alternado
// na UI). Meses futuros (após o mês corrente) ficam marcados como "previsto" —
// a UI usa isFuture para aplicar o preenchimento hachurado.
export function computeMonthlyCashflow(filtered: Transaction[], today: Date = new Date()): MonthlyCashflowPoint[] {
  const buckets = new Map<string, { income: number; expense: number }>();
  for (const t of filtered) {
    const mk = monthKey(t.due_date);
    if (!buckets.has(mk)) buckets.set(mk, { income: 0, expense: 0 });
    const bucket = buckets.get(mk)!;
    if (t.type === "income") bucket.income += Number(t.amount);
    else if (t.type === "expense") bucket.expense += Number(t.amount);
  }

  const currentMonthKey = monthKey(startOfDay(today).toISOString());
  const sortedKeys = Array.from(buckets.keys()).sort();

  let acumulado = 0;
  return sortedKeys.map((mk) => {
    const { income, expense } = buckets.get(mk)!;
    const saldoMensal = income - expense;
    acumulado += saldoMensal;
    const [y, m] = mk.split("-").map(Number);
    const monthDate = new Date(y, m - 1, 1);
    return {
      monthKey: mk,
      monthLabel: monthDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
      fullMonthLabel: monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      income,
      expense,
      saldoMensal,
      saldoAcumulado: acumulado,
      isFuture: mk > currentMonthKey,
    };
  });
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  income: number;
  expense: number;
  total: number;
  count: number;
}

// Agrupa por categoria. `total` soma receita+despesa (magnitude) só para
// ordenar por relevância — a UI mostra receita/despesa separadas por linha.
export function computeCategoryBreakdown(filtered: Transaction[]): CategoryBreakdownItem[] {
  const map = new Map<string, CategoryBreakdownItem>();
  for (const t of filtered) {
    const id = t.category_id || "__uncategorized__";
    if (!map.has(id)) {
      map.set(id, {
        categoryId: t.category_id,
        categoryName: t.category?.name || "Sem categoria",
        income: 0,
        expense: 0,
        total: 0,
        count: 0,
      });
    }
    const item = map.get(id)!;
    if (t.type === "income") item.income += Number(t.amount);
    else if (t.type === "expense") item.expense += Number(t.amount);
    item.count += 1;
  }
  return Array.from(map.values())
    .map((item) => ({ ...item, total: item.income + item.expense }))
    .sort((a, b) => b.total - a.total);
}

export interface CostCenterBreakdownItem {
  costCenterId: string | null;
  total: number;
  count: number;
  percent: number;
}

// Donut de centro de custo — restrito a despesas, conforme a spec.
export function computeCostCenterBreakdown(filtered: Transaction[]): CostCenterBreakdownItem[] {
  const expenses = filtered.filter((t) => t.type === "expense");
  const totalExpense = expenses.reduce((acc, t) => acc + Number(t.amount), 0);

  const map = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const id = t.cost_center_id || "__uncategorized__";
    if (!map.has(id)) map.set(id, { total: 0, count: 0 });
    const bucket = map.get(id)!;
    bucket.total += Number(t.amount);
    bucket.count += 1;
  }

  return Array.from(map.entries())
    .map(([id, bucket]) => ({
      costCenterId: id === "__uncategorized__" ? null : id,
      total: bucket.total,
      count: bucket.count,
      percent: totalExpense > 0 ? (bucket.total / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function normalizeDescription(desc: string): string {
  return desc
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export interface RecurrenceItem {
  key: string;
  description: string;
  type: "income" | "expense";
  count: number;
  totalAmount: number;
  avgAmount: number;
  lastDueDate: string;
}

// Recorrências: agrupa por descrição normalizada (sem acento/caixa/espaços
// duplicados) + tipo. Só entra quem aparece 2+ vezes; top 8 por frequência.
export function computeRecurrences(filtered: Transaction[]): RecurrenceItem[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of filtered) {
    if (t.type !== "income" && t.type !== "expense") continue;
    const key = `${t.type}:${normalizeDescription(t.description)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const items: RecurrenceItem[] = [];
  for (const [key, items_] of groups) {
    if (items_.length < 2) continue;
    const sortedByDateDesc = items_.slice().sort((a, b) => (a.due_date < b.due_date ? 1 : -1));
    const totalAmount = items_.reduce((acc, t) => acc + Number(t.amount), 0);
    items.push({
      key,
      description: sortedByDateDesc[0].description,
      type: sortedByDateDesc[0].type as "income" | "expense",
      count: items_.length,
      totalAmount,
      avgAmount: totalAmount / items_.length,
      lastDueDate: sortedByDateDesc[0].due_date,
    });
  }

  return items.sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount).slice(0, 8);
}

export interface MonthlyAverages {
  avgIncome: number;
  avgExpense: number;
  monthsCounted: number;
}

// Base histórica para a projeção: média mensal de receita/despesa, só com
// meses já decorridos (até o mês corrente, inclusive). Usa o conjunto BRUTO
// (rawTransactions) de propósito — a projeção/ponto de equilíbrio deve
// ignorar os filtros de tipo/situação/período (spec), respeitando só
// categoria/centro de custo/colaborador/busca, que já vêm aplicados na query
// que produz `raw`. `raw` já exclui transfer/cancelled na própria query.
export function computeMonthlyAverages(raw: Transaction[], today: Date = new Date()): MonthlyAverages {
  const currentMonthKey = monthKey(startOfDay(today).toISOString());
  const buckets = new Map<string, { income: number; expense: number }>();

  for (const t of raw) {
    const mk = monthKey(t.due_date);
    if (mk > currentMonthKey) continue;
    if (!buckets.has(mk)) buckets.set(mk, { income: 0, expense: 0 });
    const bucket = buckets.get(mk)!;
    if (t.type === "income") bucket.income += Number(t.amount);
    else if (t.type === "expense") bucket.expense += Number(t.amount);
  }

  const months = Array.from(buckets.values());
  const monthsCounted = months.length;
  if (monthsCounted === 0) return { avgIncome: 0, avgExpense: 0, monthsCounted: 0 };

  return {
    avgIncome: months.reduce((acc, m) => acc + m.income, 0) / monthsCounted,
    avgExpense: months.reduce((acc, m) => acc + m.expense, 0) / monthsCounted,
    monthsCounted,
  };
}

export interface ProjectionPoint {
  monthKey: string;
  monthLabel: string;
  fullMonthLabel: string;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  cumulative: number;
}

// Projeção linear simples: estende a média histórica mensal para os próximos
// `monthsAhead` meses. Sem dado histórico (monthsCounted === 0), retorna []
// — nunca inventa uma projeção sem base real.
export function computeCashflowProjection(
  averages: MonthlyAverages,
  monthsAhead: number,
  today: Date = new Date(),
): ProjectionPoint[] {
  if (averages.monthsCounted === 0) return [];

  const base = startOfDay(today);
  const balance = averages.avgIncome - averages.avgExpense;
  let cumulative = 0;
  const points: ProjectionPoint[] = [];

  for (let i = 1; i <= monthsAhead; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    cumulative += balance;
    points.push({
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      monthLabel: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
      fullMonthLabel: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      projectedIncome: averages.avgIncome,
      projectedExpense: averages.avgExpense,
      projectedBalance: balance,
      cumulative,
    });
  }

  return points;
}

export interface BreakevenResult {
  despesaMedia: number;
  receitaMedia: number;
  margemDesejadaPct: number;
  receitaNecessaria: number;
  gap: number; // receitaNecessaria - receitaMedia; positivo = falta receita p/ bater a margem
}

// necessario = despesa / (1 - margem) — divisão, não multiplicação (spec).
// margem >= 100% é matematicamente indefinida/negativa; retorna null.
export function computeBreakeven(averages: MonthlyAverages, margemDesejadaPct: number): BreakevenResult | null {
  if (averages.monthsCounted === 0) return null;
  const margemFrac = margemDesejadaPct / 100;
  if (margemFrac >= 1) return null;

  const receitaNecessaria = averages.avgExpense / (1 - margemFrac);
  return {
    despesaMedia: averages.avgExpense,
    receitaMedia: averages.avgIncome,
    margemDesejadaPct,
    receitaNecessaria,
    gap: receitaNecessaria - averages.avgIncome,
  };
}

export interface OpenItem {
  id: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  due_date: string;
  status: Transaction["status"];
  isOverdueFlag: boolean;
}

// Em aberto: próximos 10 não pagos, ordenados por vencimento (mais próximo primeiro).
export function computeOpenItems(filtered: Transaction[], today: Date = new Date()): OpenItem[] {
  return filtered
    .filter(isOpen)
    .slice()
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0))
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      description: t.description,
      type: t.type as "income" | "expense",
      amount: Number(t.amount),
      due_date: t.due_date,
      status: t.status,
      isOverdueFlag: isOverdue(t, today),
    }));
}
