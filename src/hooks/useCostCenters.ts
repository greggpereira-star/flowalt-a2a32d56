import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useRealtimeSubscription } from "./useRealtimeSubscription";
import { toast } from "sonner";

export interface CostCenter {
  id: string;
  workspace_id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  parent_id: string | null;
  budget_monthly: number;
  budget_yearly: number;
  is_active: boolean;
  responsible_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  parent?: CostCenter;
  spent_monthly?: number;
  spent_yearly?: number;
}

export function useCostCenters() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["cost-centers", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as CostCenter[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCostCenterWithBudget(costCenterId?: string) {
  const { currentWorkspace } = useWorkspace();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  return useQuery({
    queryKey: ["cost-center-budget", costCenterId, currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !costCenterId) return null;

      // Get cost center
      const { data: costCenter, error: ccError } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("id", costCenterId)
        .single();

      if (ccError) throw ccError;

      // Get monthly spent
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
      const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
      
      const { data: monthlyData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("cost_center_id", costCenterId)
        .eq("type", "expense")
        .eq("status", "paid")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd);

      // Get yearly spent
      const yearStart = new Date(currentYear, 0, 1).toISOString().split("T")[0];
      const yearEnd = new Date(currentYear, 11, 31).toISOString().split("T")[0];
      
      const { data: yearlyData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("cost_center_id", costCenterId)
        .eq("type", "expense")
        .eq("status", "paid")
        .gte("due_date", yearStart)
        .lte("due_date", yearEnd);

      const spentMonthly = monthlyData?.reduce((acc, t) => acc + Number(t.amount), 0) || 0;
      const spentYearly = yearlyData?.reduce((acc, t) => acc + Number(t.amount), 0) || 0;

      return {
        ...costCenter,
        spent_monthly: spentMonthly,
        spent_yearly: spentYearly,
      } as CostCenter;
    },
    enabled: !!currentWorkspace?.id && !!costCenterId,
  });
}

export interface CostCenterWithActual extends CostCenter {
  actual_spent?: number;
}

export function useCostCentersWithBudget() {
  const { currentWorkspace } = useWorkspace();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Realtime subscription para atualizar quando transações mudam
  useRealtimeSubscription({
    table: 'transactions',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [
      ['cost-centers-with-budget', currentWorkspace?.id || ''],
    ],
    enabled: !!currentWorkspace?.id,
  });

  return useQuery({
    queryKey: ["cost-centers-with-budget", currentWorkspace?.id],
    queryFn: async (): Promise<CostCenterWithActual[]> => {
      if (!currentWorkspace?.id) return [];

      // Get all cost centers
      const { data: costCenters, error: ccError } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true)
        .order("name");

      if (ccError) throw ccError;
      if (!costCenters) return [];

      // Get monthly spent for each cost center
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
      const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

      const { data: transactions } = await supabase
        .from("transactions")
        .select("cost_center_id, amount")
        .eq("workspace_id", currentWorkspace.id)
        .eq("type", "expense")
        .eq("status", "paid")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd);

      // Calculate spent per cost center
      const spentByCostCenter: Record<string, number> = {};
      transactions?.forEach((t) => {
        if (t.cost_center_id) {
          spentByCostCenter[t.cost_center_id] = (spentByCostCenter[t.cost_center_id] || 0) + Number(t.amount);
        }
      });

      return costCenters.map((cc) => ({
        ...cc,
        actual_spent: spentByCostCenter[cc.id] || 0,
      })) as CostCenterWithActual[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateCostCenter() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (costCenter: {
      name: string;
      code?: string;
      description?: string;
      color?: string;
      parent_id?: string;
      budget_monthly?: number;
      budget_yearly?: number;
      responsible_user_id?: string | null;
    }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("cost_centers")
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: userData.user?.id,
          ...costCenter,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      toast.success("Centro de custo criado");
    },
    onError: (error) => {
      toast.error("Erro ao criar centro de custo", { description: error.message });
    },
  });
}

export function useUpdateCostCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CostCenter> & { id: string }) => {
      const { data, error } = await supabase
        .from("cost_centers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      toast.success("Centro de custo atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar", { description: error.message });
    },
  });
}

export function useDeleteCostCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cost_centers")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      toast.success("Centro de custo desativado");
    },
    onError: (error) => {
      toast.error("Erro ao desativar", { description: error.message });
    },
  });
}
