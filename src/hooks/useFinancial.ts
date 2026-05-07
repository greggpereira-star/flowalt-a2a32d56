import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "./useRealtimeSubscription";

export interface FinancialCategory {
  id: string;
  workspace_id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  color: string | null;
  icon: string | null;
  is_system: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  category_id: string | null;
  collaborator_id: string | null;
  client_id: string | null;
  card_id: string | null;
  cost_center_id: string | null;
  type: "income" | "expense" | "transfer";
  status: "pending" | "paid" | "cancelled" | "overdue";
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  recurrence: "none" | "monthly" | "yearly";
  installment_number: number | null;
  total_installments: number | null;
  parent_transaction_id: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  notes: string | null;
  supplier_name: string | null;
  metadata: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory;
  collaborator?: {
    profile: {
      full_name: string | null;
      email: string;
    } | null;
  };
}

export function useCategories() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["financial-categories", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");

      if (error) throw error;
      return data as FinancialCategory[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useTransactions(filters?: {
  type?: "income" | "expense" | "transfer";
  status?: "pending" | "paid" | "cancelled" | "overdue";
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  collaboratorId?: string;
  costCenterId?: string;
}) {
  const { currentWorkspace } = useWorkspace();

  // Realtime subscription para transações - invalida todas as queries financeiras
  useRealtimeSubscription({
    table: 'transactions',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [
      ['transactions', currentWorkspace?.id || ''],
      ['transactions', currentWorkspace?.id || '', filters],
      ['financial-summary', currentWorkspace?.id || ''],
      ['financial-kpis', currentWorkspace?.id || ''],
      ['cashflow-projection', currentWorkspace?.id || ''],
      ['aging-report', currentWorkspace?.id || ''],
      ['cost-centers-with-budget', currentWorkspace?.id || ''],
    ],
    enabled: !!currentWorkspace?.id,
  });

  return useQuery({
    queryKey: ["transactions", currentWorkspace?.id, filters],
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
        .order("due_date", { ascending: false });

      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.startDate) {
        query = query.gte("due_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("due_date", filters.endDate);
      }
      if (filters?.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }
      if (filters?.collaboratorId) {
        query = query.eq("collaborator_id", filters.collaboratorId);
      }
      if (filters?.costCenterId) {
        query = query.eq("cost_center_id", filters.costCenterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (category: {
      name: string;
      type: "income" | "expense" | "transfer";
      color?: string;
      icon?: string;
    }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data, error } = await supabase
        .from("financial_categories")
        .insert({
          workspace_id: currentWorkspace.id,
          ...category,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
      toast({ title: "Categoria criada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (transaction: {
      description: string;
      amount: number;
      type: "income" | "expense" | "transfer";
      due_date: string;
      category_id?: string;
      collaborator_id?: string;
      client_id?: string;
      card_id?: string;
      cost_center_id?: string;
      status?: "pending" | "paid" | "cancelled" | "overdue";
      paid_date?: string;
      recurrence?: "none" | "monthly" | "yearly";
      installment_number?: number;
      total_installments?: number;
      invoice_number?: string;
      notes?: string;
      supplier_name?: string;
    }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // If recurring, generate entries based on total_installments
      if (transaction.recurrence && transaction.recurrence !== "none") {
        const defaultCount = transaction.recurrence === "monthly" ? 12 : 2;
        const months = transaction.total_installments && transaction.total_installments >= 2
          ? transaction.total_installments
          : defaultCount;
        const intervalMonths = transaction.recurrence === "monthly" ? 1 : 12;
        
        const entries = Array.from({ length: months }, (_, i) => {
          const baseDate = new Date(transaction.due_date + "T12:00:00");
          baseDate.setMonth(baseDate.getMonth() + (i * intervalMonths));
          
          return {
            workspace_id: currentWorkspace.id,
            created_by: userId,
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            due_date: baseDate.toISOString().split("T")[0],
            category_id: transaction.category_id,
            client_id: transaction.client_id,
            cost_center_id: transaction.cost_center_id,
            status: i === 0 ? (transaction.status || "pending") : "pending",
            recurrence: transaction.recurrence,
            installment_number: i + 1,
            total_installments: months,
            invoice_number: transaction.invoice_number,
            notes: transaction.notes,
            supplier_name: transaction.supplier_name,
            card_id: transaction.card_id,
            collaborator_id: transaction.collaborator_id,
            parent_transaction_id: undefined as string | undefined,
          };
        });

        // Insert first entry to get its ID as parent
        const { data: firstEntry, error: firstError } = await supabase
          .from("transactions")
          .insert(entries[0])
          .select()
          .single();

        if (firstError) throw firstError;

        // Insert remaining entries with parent_transaction_id
        if (entries.length > 1) {
          const remainingEntries = entries.slice(1).map(e => ({
            ...e,
            parent_transaction_id: firstEntry.id,
          }));

          const { error: batchError } = await supabase
            .from("transactions")
            .insert(remainingEntries);

          if (batchError) throw batchError;
        }

        return firstEntry;
      }

      // Single (non-recurring) transaction
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: userId,
          ...transaction,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidar todas as queries financeiras para refletir o novo lançamento
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-projection"] });
      queryClient.invalidateQueries({ queryKey: ["aging-report"] });
      queryClient.invalidateQueries({ queryKey: ["cost-centers-with-budget"] });
      toast({ title: "Lançamento criado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar lançamento", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, category, metadata, ...updates }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidar todas as queries financeiras
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-projection"] });
      queryClient.invalidateQueries({ queryKey: ["aging-report"] });
      queryClient.invalidateQueries({ queryKey: ["cost-centers-with-budget"] });
      toast({ title: "Lançamento atualizado" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidar todas as queries financeiras
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-projection"] });
      queryClient.invalidateQueries({ queryKey: ["aging-report"] });
      queryClient.invalidateQueries({ queryKey: ["cost-centers-with-budget"] });
      toast({ title: "Lançamento excluído" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });
}

export function useFinancialSummary(month?: Date) {
  const { currentWorkspace } = useWorkspace();
  const targetMonth = month || new Date();
  
  const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  return useQuery({
    queryKey: ["financial-summary", currentWorkspace?.id, startOfMonth.toISOString()],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .gte("due_date", startOfMonth.toISOString().split("T")[0])
        .lte("due_date", endOfMonth.toISOString().split("T")[0]);

      if (error) throw error;

      const valid = data.filter(t => t.status !== "cancelled");

      const income = valid
        .filter(t => t.type === "income")
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const expenses = valid
        .filter(t => t.type === "expense")
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const pending = data
        .filter(t => t.status === "pending")
        .reduce((acc, t) => {
          if (t.type === "income") return acc + Number(t.amount);
          return acc - Number(t.amount);
        }, 0);

      const overdue = data.filter(t => {
        const dueDate = new Date(t.due_date);
        return t.status === "pending" && dueDate < new Date();
      });

      return {
        income,
        expenses,
        balance: income - expenses,
        pending,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((acc, t) => acc + Number(t.amount), 0),
        transactions: data as Transaction[],
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
