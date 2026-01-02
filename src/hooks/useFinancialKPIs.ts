import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useRealtimeSubscription } from "./useRealtimeSubscription";
import { startOfMonth, endOfMonth, subMonths, addMonths, format, differenceInDays } from "date-fns";

export interface TaxBreakdown {
  regime: string;
  das: number;
  irpj: number;
  csll: number;
  pis: number;
  cofins: number;
  iss: number;
  total: number;
  effectiveRate: number;
}

export interface FinancialKPIs {
  // Core Metrics
  revenue: number;
  expenses: number;
  netProfit: number;
  profitMargin: number;
  
  // EBITDA (simplified - expenses excluding depreciation/amortization)
  ebitda: number;
  ebitdaMargin: number;
  
  // Taxes
  taxes: TaxBreakdown;
  netProfitAfterTaxes: number;
  
  // Growth
  revenueGrowth: number;
  expenseGrowth: number;
  profitGrowth: number;
  
  // Cash Flow
  cashFlowOperational: number;
  cashFlowForecast: number[];
  
  // Aging Report
  aging: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  };
  
  // Budget
  budgetRealized: number;
  budgetPlanned: number;
  budgetVariance: number;
  
  // Averages
  avgTicket: number;
  avgPaymentTime: number;
  avgReceivableTime: number;
  
  // Counts
  totalTransactions: number;
  overdueCount: number;
  pendingCount: number;
  
  // Payroll
  payrollTotal: number;
  payrollCount: number;
}

export function useFinancialKPIs(selectedMonth?: Date) {
  const { currentWorkspace } = useWorkspace();
  const targetMonth = selectedMonth || new Date();
  
  const periodStart = startOfMonth(targetMonth);
  const periodEnd = endOfMonth(targetMonth);
  const prevPeriodStart = startOfMonth(subMonths(targetMonth, 1));
  const prevPeriodEnd = endOfMonth(subMonths(targetMonth, 1));

  // Realtime subscription para atualizar KPIs quando transações mudam
  useRealtimeSubscription({
    table: 'transactions',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [
      ['financial-kpis', currentWorkspace?.id || '', format(targetMonth, "yyyy-MM")],
      ['cashflow-projection', currentWorkspace?.id || ''],
      ['aging-report', currentWorkspace?.id || ''],
    ],
    enabled: !!currentWorkspace?.id,
  });

  return useQuery({
    queryKey: ["financial-kpis", currentWorkspace?.id, format(targetMonth, "yyyy-MM")],
    queryFn: async (): Promise<FinancialKPIs | null> => {
      if (!currentWorkspace?.id) return null;

      // Fetch current period transactions
      const { data: currentTransactions, error: currentError } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .gte("due_date", format(periodStart, "yyyy-MM-dd"))
        .lte("due_date", format(periodEnd, "yyyy-MM-dd"));

      if (currentError) throw currentError;

      // Fetch previous period for comparison
      const { data: prevTransactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .gte("due_date", format(prevPeriodStart, "yyyy-MM-dd"))
        .lte("due_date", format(prevPeriodEnd, "yyyy-MM-dd"));

      // Fetch all pending/overdue for aging
      const { data: pendingTransactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .in("status", ["pending", "overdue"])
        .eq("type", "income");

      // Fetch cost centers for budget
      const { data: costCenters } = await supabase
        .from("cost_centers")
        .select("budget_monthly")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true);

      // Fetch tax settings
      const { data: taxSettings } = await supabase
        .from("tax_settings")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .lte("effective_from", format(periodEnd, "yyyy-MM-dd"))
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch payroll for the month
      const { data: payrollData } = await supabase
        .from("collaborator_payroll")
        .select("net_salary, total_cost")
        .eq("workspace_id", currentWorkspace.id)
        .eq("reference_month", format(periodStart, "yyyy-MM-01"));

      const transactions = currentTransactions || [];
      const prev = prevTransactions || [];
      const pending = pendingTransactions || [];

      // Calculate core metrics (competência): considera paid + pending + overdue (exclui cancelled)
      const validTransactions = transactions.filter(t => t.status !== "cancelled");
      const incomeTransactions = validTransactions.filter(t => t.type === "income");
      const expenseTransactions = validTransactions.filter(t => t.type === "expense");

      const revenue = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
      const expenses = expenseTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
      const netProfit = revenue - expenses;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      // EBITDA (simplified - using operational expenses)
      const operationalExpenses = expenses * 0.85; // Assuming 15% is depreciation/amortization
      const ebitda = revenue - operationalExpenses;
      const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;

      // Calculate taxes based on settings
      let taxes: TaxBreakdown = {
        regime: 'simples_nacional',
        das: 0,
        irpj: 0,
        csll: 0,
        pis: 0,
        cofins: 0,
        iss: 0,
        total: 0,
        effectiveRate: 0,
      };

      if (taxSettings && revenue > 0) {
        taxes.regime = taxSettings.tax_regime;
        
        switch (taxSettings.tax_regime) {
          case 'simples_nacional':
            taxes.das = revenue * (Number(taxSettings.simples_aliquota_efetiva) / 100);
            taxes.total = taxes.das;
            break;
          case 'lucro_presumido': {
            const baseCalculo = revenue * (Number(taxSettings.lp_presuncao_servicos) / 100);
            taxes.irpj = baseCalculo * (Number(taxSettings.lp_irpj_aliquota) / 100);
            if (baseCalculo > 20000) {
              taxes.irpj += (baseCalculo - 20000) * (Number(taxSettings.lp_irpj_adicional) / 100);
            }
            taxes.csll = baseCalculo * (Number(taxSettings.lp_csll_aliquota) / 100);
            taxes.pis = revenue * (Number(taxSettings.lp_pis_aliquota) / 100);
            taxes.cofins = revenue * (Number(taxSettings.lp_cofins_aliquota) / 100);
            taxes.iss = revenue * (Number(taxSettings.iss_aliquota) / 100);
            taxes.total = taxes.irpj + taxes.csll + taxes.pis + taxes.cofins + taxes.iss;
            break;
          }
          case 'lucro_real':
            taxes.irpj = revenue * (Number(taxSettings.lr_irpj_aliquota) / 100);
            taxes.csll = revenue * (Number(taxSettings.lr_csll_aliquota) / 100);
            taxes.pis = revenue * (Number(taxSettings.lr_pis_aliquota) / 100);
            taxes.cofins = revenue * (Number(taxSettings.lr_cofins_aliquota) / 100);
            taxes.iss = revenue * (Number(taxSettings.iss_aliquota) / 100);
            taxes.total = taxes.irpj + taxes.csll + taxes.pis + taxes.cofins + taxes.iss;
            break;
        }
        taxes.effectiveRate = (taxes.total / revenue) * 100;
      } else if (revenue > 0) {
        // Default to 6% Simples if no settings
        taxes.das = revenue * 0.06;
        taxes.total = taxes.das;
        taxes.effectiveRate = 6;
      }

      const netProfitAfterTaxes = netProfit - taxes.total;

      // Payroll totals
      const payrollTotal = (payrollData || []).reduce((acc, p) => acc + Number(p.total_cost || 0), 0);
      const payrollCount = (payrollData || []).length;

      // Previous period metrics for growth (mesma regra de competência)
      const prevValid = prev.filter(t => t.status !== "cancelled");
      const prevRevenue = prevValid.filter(t => t.type === "income").reduce((acc, t) => acc + Number(t.amount), 0);
      const prevExpenses = prevValid.filter(t => t.type === "expense").reduce((acc, t) => acc + Number(t.amount), 0);
      const prevProfit = prevRevenue - prevExpenses;

      const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
      const expenseGrowth = prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : 0;
      const profitGrowth = prevProfit !== 0 ? ((netProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

      // Cash Flow (simplified)
      const cashFlowOperational = netProfit;

      // Cash Flow Forecast (next 6 months based on trend)
      const avgMonthlyRevenue = (revenue + prevRevenue) / 2;
      const avgMonthlyExpenses = (expenses + prevExpenses) / 2;
      const cashFlowForecast = Array.from({ length: 6 }, (_, i) => {
        const growthFactor = 1 + (revenueGrowth / 100) * 0.5; // Conservative forecast
        const projectedRevenue = avgMonthlyRevenue * Math.pow(growthFactor, i + 1);
        const projectedExpenses = avgMonthlyExpenses * (1 + (expenseGrowth / 100) * 0.3);
        return projectedRevenue - projectedExpenses;
      });

      // Aging Report
      const today = new Date();
      const aging = {
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        over90: 0,
      };

      pending.forEach(t => {
        const dueDate = new Date(t.due_date);
        const daysOverdue = differenceInDays(today, dueDate);
        const amount = Number(t.amount);

        if (daysOverdue <= 0) aging.current += amount;
        else if (daysOverdue <= 30) aging.days30 += amount;
        else if (daysOverdue <= 60) aging.days60 += amount;
        else if (daysOverdue <= 90) aging.days90 += amount;
        else aging.over90 += amount;
      });

      // Budget
      const budgetPlanned = (costCenters || []).reduce((acc, cc) => acc + (Number(cc.budget_monthly) || 0), 0);
      const budgetRealized = expenses;
      const budgetVariance = budgetPlanned > 0 ? ((budgetPlanned - budgetRealized) / budgetPlanned) * 100 : 0;

      // Averages
      const paidIncome = transactions.filter(t => t.type === "income" && t.status === "paid");
      const paidExpenses = transactions.filter(t => t.type === "expense" && t.status === "paid");
      const avgTicket = paidIncome.length > 0 ? revenue / paidIncome.length : 0;
      
      // Average payment time (for paid expenses)
      const paidWithDates = paidExpenses.filter(t => t.paid_date);
      const avgPaymentTime = paidWithDates.length > 0
        ? paidWithDates.reduce((acc, t) => {
            const due = new Date(t.due_date);
            const paid = new Date(t.paid_date!);
            return acc + differenceInDays(paid, due);
          }, 0) / paidWithDates.length
        : 0;

      // Average receivable time
      const receivedWithDates = paidIncome.filter(t => t.paid_date);
      const avgReceivableTime = receivedWithDates.length > 0
        ? receivedWithDates.reduce((acc, t) => {
            const due = new Date(t.due_date);
            const paid = new Date(t.paid_date!);
            return acc + differenceInDays(paid, due);
          }, 0) / receivedWithDates.length
        : 0;

      const overdueCount = transactions.filter(t => {
        if (t.status === "cancelled") return false;
        if (t.status === "overdue") return true;
        if (t.status !== "pending") return false;
        return new Date(t.due_date) < today;
      }).length;

      return {
        revenue,
        expenses,
        netProfit,
        profitMargin,
        ebitda,
        ebitdaMargin,
        taxes,
        netProfitAfterTaxes,
        revenueGrowth,
        expenseGrowth,
        profitGrowth,
        cashFlowOperational,
        cashFlowForecast,
        aging,
        budgetRealized,
        budgetPlanned,
        budgetVariance,
        avgTicket,
        avgPaymentTime,
        avgReceivableTime,
        totalTransactions: transactions.length,
        overdueCount,
        pendingCount: transactions.filter(t => t.status === "pending").length,
        payrollTotal,
        payrollCount,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCashFlowProjection(months: number = 12) {
  const { currentWorkspace } = useWorkspace();

  // Realtime subscription para atualizar projeção quando transações mudam
  useRealtimeSubscription({
    table: 'transactions',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [
      ['cashflow-projection', currentWorkspace?.id || '', months],
    ],
    enabled: !!currentWorkspace?.id,
  });

  return useQuery({
    queryKey: ["cashflow-projection", currentWorkspace?.id, months],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const today = new Date();
      const projections = [];

      for (let i = 0; i < months; i++) {
        const month = addMonths(today, i);
        const start = startOfMonth(month);
        const end = endOfMonth(month);

        // Get scheduled transactions
        const { data: scheduled } = await supabase
          .from("transactions")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .gte("due_date", format(start, "yyyy-MM-dd"))
          .lte("due_date", format(end, "yyyy-MM-dd"));

        const income = (scheduled || [])
          .filter(t => t.type === "income")
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const expenses = (scheduled || [])
          .filter(t => t.type === "expense")
          .reduce((acc, t) => acc + Number(t.amount), 0);

        projections.push({
          month: format(month, "MMM/yy"),
          income,
          expenses,
          balance: income - expenses,
          cumulative: 0, // Will be calculated below
        });
      }

      // Calculate cumulative balance
      let cumulative = 0;
      projections.forEach(p => {
        cumulative += p.balance;
        p.cumulative = cumulative;
      });

      return projections;
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useAgingReport() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["aging-report", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data: pending } = await supabase
        .from("transactions")
        .select(`
          *,
          client:clients(id, name)
        `)
        .eq("workspace_id", currentWorkspace.id)
        .in("status", ["pending", "overdue"])
        .eq("type", "income")
        .order("due_date", { ascending: true });

      const today = new Date();
      const grouped = {
        current: [] as typeof pending,
        days30: [] as typeof pending,
        days60: [] as typeof pending,
        days90: [] as typeof pending,
        over90: [] as typeof pending,
      };

      (pending || []).forEach(t => {
        const dueDate = new Date(t.due_date);
        const daysOverdue = differenceInDays(today, dueDate);

        if (daysOverdue <= 0) grouped.current?.push(t);
        else if (daysOverdue <= 30) grouped.days30?.push(t);
        else if (daysOverdue <= 60) grouped.days60?.push(t);
        else if (daysOverdue <= 90) grouped.days90?.push(t);
        else grouped.over90?.push(t);
      });

      return grouped;
    },
    enabled: !!currentWorkspace?.id,
  });
}
