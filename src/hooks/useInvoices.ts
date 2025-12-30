import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface Invoice {
  id: string;
  workspace_id: string;
  invoice_number: string;
  invoice_series: string | null;
  invoice_type: 'nfse' | 'nfe' | 'nfce';
  access_key: string | null;
  gross_amount: number;
  net_amount: number;
  tax_amount: number;
  taxes: Record<string, number> | null;
  issue_date: string;
  due_date: string | null;
  status: 'emitida' | 'cancelada' | 'substituida' | 'pendente';
  client_id: string | null;
  transaction_id: string | null;
  card_id: string | null;
  recipient_name: string | null;
  recipient_document: string | null;
  recipient_email: string | null;
  description: string | null;
  service_code: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  source: string;
  external_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: { name: string; id: string };
  transaction?: { description: string; id: string; amount: number };
}

export function useInvoices(filters?: {
  status?: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  unlinked?: boolean;
}) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["invoices", currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      let query = supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name),
          transaction:transactions(id, description, amount)
        `)
        .eq("workspace_id", currentWorkspace.id)
        .order("issue_date", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.clientId) {
        query = query.eq("client_id", filters.clientId);
      }
      if (filters?.startDate) {
        query = query.gte("issue_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("issue_date", filters.endDate);
      }
      if (filters?.unlinked) {
        query = query.is("transaction_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (invoice: {
      invoice_number: string;
      issue_date: string;
      gross_amount?: number;
      net_amount?: number;
      tax_amount?: number;
      invoice_type?: string;
      invoice_series?: string | null;
      status?: string;
      client_id?: string | null;
      transaction_id?: string | null;
      card_id?: string | null;
      recipient_name?: string | null;
      recipient_document?: string | null;
      recipient_email?: string | null;
      service_code?: string | null;
      description?: string | null;
      pdf_url?: string | null;
      xml_url?: string | null;
    }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: userData.user?.id,
          ...invoice,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Nota fiscal cadastrada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar nota fiscal", { description: error.message });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, client, transaction, ...updates }: Partial<Invoice> & { id: string }) => {
      // Remove relational fields that can't be updated directly
      const cleanUpdates = { ...updates };
      delete (cleanUpdates as any).client;
      delete (cleanUpdates as any).transaction;
      delete (cleanUpdates as any).metadata;
      
      const { data, error } = await supabase
        .from("invoices")
        .update(cleanUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Nota fiscal atualizada");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar", { description: error.message });
    },
  });
}

export function useLinkInvoiceToTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, transactionId }: { invoiceId: string; transactionId: string }) => {
      const { data, error } = await supabase
        .from("invoices")
        .update({ transaction_id: transactionId })
        .eq("id", invoiceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Nota fiscal vinculada à transação");
    },
    onError: (error) => {
      toast.error("Erro ao vincular", { description: error.message });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Nota fiscal excluída");
    },
    onError: (error) => {
      toast.error("Erro ao excluir", { description: error.message });
    },
  });
}

export function useInvoiceSummary(month?: Date) {
  const { currentWorkspace } = useWorkspace();
  const targetMonth = month || new Date();
  
  const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  return useQuery({
    queryKey: ["invoice-summary", currentWorkspace?.id, startOfMonth.toISOString()],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .gte("issue_date", startOfMonth.toISOString().split("T")[0])
        .lte("issue_date", endOfMonth.toISOString().split("T")[0]);

      if (error) throw error;

      const total = data.filter(i => i.status === 'emitida').reduce((acc, i) => acc + Number(i.net_amount), 0);
      const totalTax = data.filter(i => i.status === 'emitida').reduce((acc, i) => acc + Number(i.tax_amount), 0);
      const pending = data.filter(i => i.status === 'pendente').length;
      const unlinked = data.filter(i => !i.transaction_id && i.status === 'emitida').length;

      return {
        count: data.filter(i => i.status === 'emitida').length,
        total,
        totalTax,
        pending,
        unlinked,
        invoices: data as Invoice[],
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
