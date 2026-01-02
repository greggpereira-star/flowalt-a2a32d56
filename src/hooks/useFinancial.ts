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
  metadata: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory;
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
}) {
  const { currentWorkspace } = useWorkspace();

  // Realtime subscription para transações
  useRealtimeSubscription({
    table: 'transactions',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [
      ['transactions', currentWorkspace?.id || ''],
      ['financial-summary', currentWorkspace?.id || ''],
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
          category:financial_categories(*)
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
      status?: "pending" | "paid" | "cancelled" | "overdue";
      paid_date?: string;
      recurrence?: "none" | "monthly" | "yearly";
      installment_number?: number;
      total_installments?: number;
      invoice_number?: string;
      notes?: string;
    }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: userData.user?.id,
          ...transaction,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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

      const income = data
        .filter(t => t.type === "income" && t.status === "paid")
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const expenses = data
        .filter(t => t.type === "expense" && t.status === "paid")
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
