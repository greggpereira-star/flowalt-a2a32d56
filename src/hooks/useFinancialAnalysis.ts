import { useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type {
  TopIndicators, MonthlyCashflowPoint, ProjectionPoint, BreakevenResult,
  CategoryBreakdownItem, CostCenterBreakdownItem, RecurrenceItem, OpenItem,
} from "@/lib/financialPanelCalculations";

export type AnalysisType = "panorama" | "onde_cortar" | "riscos_caixa" | "bater_meta";

export interface FinancialAnalysisResult {
  analysis: string;
  analysis_type: AnalysisType;
  analysis_label: string;
  generated_at: string;
  filters_summary: string;
}

interface AnalysisInput {
  analysisType: AnalysisType;
  filtersSummary: string;
  indicators: TopIndicators;
  monthlyCashflow: MonthlyCashflowPoint[];
  projection: ProjectionPoint[];
  breakeven: BreakevenResult | null;
  categoryBreakdown: CategoryBreakdownItem[];
  costCenterBreakdown: CostCenterBreakdownItem[];
  costCenterNames: Map<string, string>;
  recurrences: RecurrenceItem[];
  openItems: OpenItem[];
}

// Payload agregado — só números já calculados, nunca linhas de lançamento
// individuais (nome/valor/data brutos ficam de fora de propósito).
function buildAggregatedPayload(input: AnalysisInput) {
  return {
    indicadores: {
      receitas: input.indicators.receitas,
      despesas: input.indicators.despesas,
      saldo_periodo: input.indicators.saldoPeriodo,
      a_receber: input.indicators.aReceber,
      a_pagar: input.indicators.aPagar,
      vencido: input.indicators.vencido,
    },
    fluxo_mensal: input.monthlyCashflow.map((m) => ({
      mes: m.fullMonthLabel,
      receita: m.income,
      despesa: m.expense,
      saldo_mensal: m.saldoMensal,
      saldo_acumulado: m.saldoAcumulado,
      previsto: m.isFuture,
    })),
    projecao: input.projection.map((p) => ({
      mes: p.fullMonthLabel,
      receita_projetada: p.projectedIncome,
      despesa_projetada: p.projectedExpense,
      saldo_projetado: p.projectedBalance,
      acumulado: p.cumulative,
    })),
    ponto_equilibrio: input.breakeven ? {
      despesa_media_mensal: input.breakeven.despesaMedia,
      receita_media_mensal: input.breakeven.receitaMedia,
      margem_desejada_pct: input.breakeven.margemDesejadaPct,
      receita_necessaria: input.breakeven.receitaNecessaria,
      gap: input.breakeven.gap,
    } : null,
    por_categoria: input.categoryBreakdown.map((c) => ({
      categoria: c.categoryName,
      receita: c.income,
      despesa: c.expense,
      lancamentos: c.count,
    })),
    por_centro_de_custo: input.costCenterBreakdown.map((c) => ({
      centro_de_custo: (c.costCenterId && input.costCenterNames.get(c.costCenterId)) || "Sem centro de custo",
      total_despesa: c.total,
      percentual: c.percent,
    })),
    recorrencias: input.recurrences.map((r) => ({
      descricao: r.description,
      tipo: r.type,
      ocorrencias: r.count,
      valor_total: r.totalAmount,
      valor_medio: r.avgAmount,
      ultima_data: r.lastDueDate,
    })),
    em_aberto: input.openItems.map((o) => ({
      descricao: o.description,
      tipo: o.type,
      valor: o.amount,
      vencimento: o.due_date,
      vencido: o.isOverdueFlag,
    })),
  };
}

export function useFinancialAnalysis() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AnalysisInput): Promise<FinancialAnalysisResult> => {
      if (!currentWorkspace?.id) throw new Error("Nenhum workspace selecionado.");
      const aggregated_data = buildAggregatedPayload(input);

      const { data, error } = await supabase.functions.invoke("analyze-financial-panel", {
        body: {
          workspace_id: currentWorkspace.id,
          analysis_type: input.analysisType,
          aggregated_data,
          filters_summary: input.filtersSummary,
        },
      });
      if (error) throw new Error(error.message || "Falha ao gerar análise.");
      if (!data || data.error) throw new Error(data?.error || "Falha ao gerar análise.");
      return data as FinancialAnalysisResult;
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao gerar análise", description: error.message, variant: "destructive" });
    },
  });
}
