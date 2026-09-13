import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useRealtimeSubscription } from "./useRealtimeSubscription";
import type { Transaction } from "./useFinancial";
import {
  filterForIndicators,
  computeTopIndicators,
  computeMonthlyCashflow,
  computeCategoryBreakdown,
  computeCostCenterBreakdown,
  computeRecurrences,
  computeOpenItems,
  computeMonthlyAverages,
  computeCashflowProjection,
  computeBreakeven,
  type PanelFilters,
} from "@/lib/financialPanelCalculations";

const PROJECTION_MONTHS_AHEAD = 6;
const DEFAULT_MARGEM_DESEJADA_PCT = 20;

export interface PanelCollaboratorOption {
  id: string; // workspace_members.id — o mesmo valor gravado em transactions.collaborator_id
  full_name: string;
}

/** Lista leve de colaboradores só com id + nome, para popular o filtro —
 * evita puxar o registro completo de RH (CPF, salário etc.) de useCollaborators(). */
export function usePanelCollaboratorOptions() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["financial-panel-collaborator-options", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, profile:profiles!workspace_members_profiles_fkey(full_name)")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true);

      if (error) throw error;

      return (data as unknown as Array<{ id: string; profile: { full_name: string | null } | null }>)
        .map((m) => ({ id: m.id, full_name: m.profile?.full_name || "Sem nome" }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)) as PanelCollaboratorOption[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export interface PanelCostCenterOption {
  id: string;
  name: string;
  color: string;
}

/** Lista de centros de custo para o donut do Painel Executivo — inclui
 * inativos, ao contrário de useCostCenters(). Sem isso, lançamentos antigos
 * ligados a um centro de custo desativado caem todos num "Sem centro de
 * custo" genérico e indistinguível uns dos outros no gráfico. */
export function usePanelCostCenterOptions() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["financial-panel-cost-center-options", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, name, color")
        .eq("workspace_id", currentWorkspace.id);

      if (error) throw error;
      return data as PanelCostCenterOption[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export interface PanelFilterState extends PanelFilters {
  costCenterIds: string[];
  categoryId?: string;
  collaboratorId?: string;
  search?: string;
}

export const EMPTY_PANEL_FILTERS: PanelFilterState = {
  types: [],
  statuses: [],
  costCenterIds: [],
};

/**
 * Busca o conjunto bruto de transações do Painel Executivo. Só aplica no
 * banco os filtros que TODOS os blocos (inclusive a projeção) devem
 * respeitar: categoria, centro de custo, colaborador e busca textual —
 * mais a exclusão permanente de 'transfer'/'cancelled'. Tipo, situação e
 * período ficam de fora da query e são aplicados depois, em memória,
 * porque a projeção precisa ignorá-los (ver financialPanelCalculations.ts).
 */
function useRawPanelTransactions(scopeFilters: {
  costCenterIds: string[];
  categoryId?: string;
  collaboratorId?: string;
  search?: string;
}) {
  const { currentWorkspace } = useWorkspace();
  const { costCenterIds, categoryId, collaboratorId, search } = scopeFilters;

  useRealtimeSubscription({
    table: "transactions",
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [["financial-panel-raw", currentWorkspace?.id || ""]],
    enabled: !!currentWorkspace?.id,
  });

  return useQuery({
    queryKey: [
      "financial-panel-raw",
      currentWorkspace?.id,
      costCenterIds.slice().sort().join(","),
      categoryId,
      collaboratorId,
      search,
    ],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from("transactions")
        .select(`
          *,
          category:financial_categories(*),
          collaborator:workspace_members!transactions_collaborator_id_fkey(
            profile:profiles!workspace_members_profiles_fkey(full_name, email)
          )
        `)
        .eq("workspace_id", currentWorkspace.id)
        .neq("type", "transfer")
        .neq("status", "cancelled");

      if (costCenterIds.length > 0) query = query.in("cost_center_id", costCenterIds);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (collaboratorId) query = query.eq("collaborator_id", collaboratorId);
      if (search?.trim()) query = query.ilike("description", `%${search.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook principal do Painel Executivo: estado dos filtros + dados agregados
 * do bloco de indicadores do topo. Blocos futuros (fluxo mensal, projeção,
 * categoria, etc.) consomem `rawTransactions` da mesma forma.
 */
export function useFinancialPanel() {
  const [filters, setFilters] = useState<PanelFilterState>(EMPTY_PANEL_FILTERS);
  const [margemDesejadaPct, setMargemDesejadaPct] = useState(DEFAULT_MARGEM_DESEJADA_PCT);

  const rawQuery = useRawPanelTransactions({
    costCenterIds: filters.costCenterIds,
    categoryId: filters.categoryId,
    collaboratorId: filters.collaboratorId,
    search: filters.search,
  });

  const filteredForIndicators = useMemo(() => {
    return filterForIndicators(rawQuery.data || [], {
      types: filters.types,
      statuses: filters.statuses,
      monthFrom: filters.monthFrom,
      monthTo: filters.monthTo,
    });
  }, [rawQuery.data, filters.types, filters.statuses, filters.monthFrom, filters.monthTo]);

  const indicators = useMemo(() => computeTopIndicators(filteredForIndicators), [filteredForIndicators]);
  const monthlyCashflow = useMemo(() => computeMonthlyCashflow(filteredForIndicators), [filteredForIndicators]);
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(filteredForIndicators), [filteredForIndicators]);
  const costCenterBreakdown = useMemo(() => computeCostCenterBreakdown(filteredForIndicators), [filteredForIndicators]);
  const recurrences = useMemo(() => computeRecurrences(filteredForIndicators), [filteredForIndicators]);
  const openItems = useMemo(() => computeOpenItems(filteredForIndicators), [filteredForIndicators]);

  // Projeção e ponto de equilíbrio usam o conjunto BRUTO (rawTransactions),
  // não filteredForIndicators — ignoram tipo/situação/período de propósito,
  // respeitando só categoria/centro de custo/colaborador/busca (já aplicados
  // na query de rawTransactions).
  const monthlyAverages = useMemo(() => computeMonthlyAverages(rawQuery.data || []), [rawQuery.data]);
  const projection = useMemo(
    () => computeCashflowProjection(monthlyAverages, PROJECTION_MONTHS_AHEAD),
    [monthlyAverages],
  );
  const breakeven = useMemo(
    () => computeBreakeven(monthlyAverages, margemDesejadaPct),
    [monthlyAverages, margemDesejadaPct],
  );

  return {
    filters,
    setFilters,
    isLoading: rawQuery.isLoading,
    error: rawQuery.error,
    rawTransactions: rawQuery.data || [],
    filteredForIndicators,
    indicators,
    monthlyCashflow,
    categoryBreakdown,
    costCenterBreakdown,
    recurrences,
    openItems,
    monthlyAverages,
    projection,
    margemDesejadaPct,
    setMargemDesejadaPct,
    breakeven,
  };
}
