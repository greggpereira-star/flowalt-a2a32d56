import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface DREData {
  receitas: {
    operacionais: number;
    naoOperacionais: number;
    total: number;
  };
  deducoes: {
    impostos: number;
    descontos: number;
    total: number;
  };
  receitaLiquida: number;
  custos: {
    producao: number;
    servicos: number;
    total: number;
  };
  lucroBruto: number;
  despesas: {
    administrativas: number;
    comerciais: number;
    financeiras: number;
    pessoal: number;
    outras: number;
    total: number;
  };
  lucroOperacional: number;
  resultadoLiquido: number;
}

export interface FinancialReport {
  id: string;
  workspace_id: string;
  report_type: 'dre' | 'balance' | 'cashflow' | 'by_client' | 'by_project' | 'by_cost_center';
  period_start: string;
  period_end: string;
  period_type: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  data: DREData | Record<string, unknown>;
  previous_period_data: DREData | Record<string, unknown> | null;
  variation_percentage: number | null;
  status: 'draft' | 'final' | 'approved';
  approved_by: string | null;
  approved_at: string | null;
  generated_by: string | null;
  generated_at: string;
  created_at: string;
}

export function useFinancialReports(reportType?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["financial-reports", currentWorkspace?.id, reportType],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      let query = supabase
        .from("financial_reports")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("period_start", { ascending: false });

      if (reportType) {
        query = query.eq("report_type", reportType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialReport[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useGenerateDRE() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const periodStart = startOfMonth(new Date(year, month));
      const periodEnd = endOfMonth(new Date(year, month));
      const prevPeriodStart = startOfMonth(subMonths(periodStart, 1));
      const prevPeriodEnd = endOfMonth(subMonths(periodEnd, 1));

      // Fetch current period transactions
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("*, category:financial_categories(*)")
        .eq("workspace_id", currentWorkspace.id)
        .gte("due_date", format(periodStart, "yyyy-MM-dd"))
        .lte("due_date", format(periodEnd, "yyyy-MM-dd"))
        .eq("status", "paid");

      if (txError) throw txError;

      // Fetch previous period for comparison
      const { data: prevTransactions } = await supabase
        .from("transactions")
        .select("*, category:financial_categories(*)")
        .eq("workspace_id", currentWorkspace.id)
        .gte("due_date", format(prevPeriodStart, "yyyy-MM-dd"))
        .lte("due_date", format(prevPeriodEnd, "yyyy-MM-dd"))
        .eq("status", "paid");

      // Calculate DRE
      const calculateDRE = (txs: typeof transactions): DREData => {
        const income = txs?.filter(t => t.type === "income") || [];
        const expenses = txs?.filter(t => t.type === "expense") || [];

        const receitasTotal = income.reduce((acc, t) => acc + Number(t.amount), 0);
        const despesasTotal = expenses.reduce((acc, t) => acc + Number(t.amount), 0);

        // Simplified DRE structure - in production would use categories
        return {
          receitas: {
            operacionais: receitasTotal * 0.95,
            naoOperacionais: receitasTotal * 0.05,
            total: receitasTotal,
          },
          deducoes: {
            impostos: receitasTotal * 0.08,
            descontos: 0,
            total: receitasTotal * 0.08,
          },
          receitaLiquida: receitasTotal * 0.92,
          custos: {
            producao: despesasTotal * 0.3,
            servicos: despesasTotal * 0.1,
            total: despesasTotal * 0.4,
          },
          lucroBruto: (receitasTotal * 0.92) - (despesasTotal * 0.4),
          despesas: {
            administrativas: despesasTotal * 0.15,
            comerciais: despesasTotal * 0.1,
            financeiras: despesasTotal * 0.05,
            pessoal: despesasTotal * 0.25,
            outras: despesasTotal * 0.05,
            total: despesasTotal * 0.6,
          },
          lucroOperacional: (receitasTotal * 0.92) - despesasTotal,
          resultadoLiquido: (receitasTotal * 0.92) - despesasTotal,
        };
      };

      const dreData = calculateDRE(transactions || []);
      const prevDreData = calculateDRE(prevTransactions || []);

      const variation = prevDreData.resultadoLiquido !== 0 
        ? ((dreData.resultadoLiquido - prevDreData.resultadoLiquido) / Math.abs(prevDreData.resultadoLiquido)) * 100 
        : 0;

      const { data: userData } = await supabase.auth.getUser();

      const reportData = {
        workspace_id: currentWorkspace.id,
        report_type: 'dre',
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        period_type: 'monthly',
        data: JSON.parse(JSON.stringify(dreData)),
        previous_period_data: JSON.parse(JSON.stringify(prevDreData)),
        variation_percentage: variation,
        generated_by: userData.user?.id || null,
        generated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("financial_reports")
        .insert([reportData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      toast.success("DRE gerado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao gerar DRE", { description: error.message });
    },
  });
}

export function useFinancialAlerts() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["financial-alerts", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      const { data, error } = await supabase
        .from("financial_alerts")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active")
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("financial_alerts")
        .update({
          status: "acknowledged",
          acknowledged_by: userData.user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-alerts"] });
    },
  });
}
