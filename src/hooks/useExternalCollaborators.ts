import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface ExternalCollaborator {
  id: string;
  workspace_id: string;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  hire_date: string | null;
  termination_date: string | null;
  contract_type: string | null;
  job_title: string | null;
  department: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  base_salary: number | null;
  weekly_hours: number | null;
  address: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  emergency_contact: {
    name?: string;
    phone?: string;
    relationship?: string;
  } | null;
  documents: Array<{
    name?: string;
    url?: string;
    expiry_date?: string;
  }> | null;
  notes: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExternalCollaboratorInput {
  full_name: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  hire_date?: string;
  termination_date?: string;
  contract_type?: string;
  job_title?: string;
  department?: string;
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;
  pix_key?: string;
  base_salary?: number;
  weekly_hours?: number;
  address?: ExternalCollaborator["address"];
  emergency_contact?: ExternalCollaborator["emergency_contact"];
  documents?: ExternalCollaborator["documents"];
  notes?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}

export function useExternalCollaborators() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["external-collaborators", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("external_collaborators")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("full_name");

      if (error) throw error;
      return data as ExternalCollaborator[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useExternalCollaborator(id: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["external-collaborator", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("external_collaborators")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ExternalCollaborator;
    },
    enabled: !!id && !!currentWorkspace?.id,
  });
}

export function useCreateExternalCollaborator() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (input: ExternalCollaboratorInput) => {
      if (!currentWorkspace?.id) throw new Error("Workspace não encontrado");

      const { data, error } = await supabase
        .from("external_collaborators")
        .insert({
          workspace_id: currentWorkspace.id,
          full_name: input.full_name,
          cpf: input.cpf || null,
          rg: input.rg || null,
          birth_date: input.birth_date || null,
          hire_date: input.hire_date || null,
          termination_date: input.termination_date || null,
          contract_type: input.contract_type || "clt",
          job_title: input.job_title || null,
          department: input.department || null,
          bank_name: input.bank_name || null,
          bank_agency: input.bank_agency || null,
          bank_account: input.bank_account || null,
          pix_key: input.pix_key || null,
          base_salary: input.base_salary || 0,
          weekly_hours: input.weekly_hours || 40,
          address: input.address || {},
          emergency_contact: input.emergency_contact || {},
          documents: input.documents || [],
          notes: input.notes || null,
          phone: input.phone || null,
          email: input.email || null,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      // Log salary history if salary > 0
      if (input.base_salary && input.base_salary > 0) {
        await supabase.from("external_collaborator_salary_history").insert({
          collaborator_id: data.id,
          previous_salary: 0,
          new_salary: input.base_salary,
          reason: "Cadastro inicial",
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-collaborators"] });
      toast.success("Colaborador cadastrado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating external collaborator:", error);
      toast.error("Erro ao cadastrar colaborador");
    },
  });
}

export function useUpdateExternalCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ExternalCollaboratorInput & { id: string }) => {
      // Get current salary to compare
      const { data: current } = await supabase
        .from("external_collaborators")
        .select("base_salary")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("external_collaborators")
        .update({
          full_name: input.full_name,
          cpf: input.cpf || null,
          rg: input.rg || null,
          birth_date: input.birth_date || null,
          hire_date: input.hire_date || null,
          termination_date: input.termination_date || null,
          contract_type: input.contract_type || "clt",
          job_title: input.job_title || null,
          department: input.department || null,
          bank_name: input.bank_name || null,
          bank_agency: input.bank_agency || null,
          bank_account: input.bank_account || null,
          pix_key: input.pix_key || null,
          base_salary: input.base_salary || 0,
          weekly_hours: input.weekly_hours || 40,
          address: input.address || {},
          emergency_contact: input.emergency_contact || {},
          documents: input.documents || [],
          notes: input.notes || null,
          phone: input.phone || null,
          email: input.email || null,
          is_active: input.is_active ?? true,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log salary change if different
      if (current && input.base_salary !== undefined && current.base_salary !== input.base_salary) {
        await supabase.from("external_collaborator_salary_history").insert({
          collaborator_id: id,
          previous_salary: current.base_salary || 0,
          new_salary: input.base_salary,
          reason: "Atualização de salário",
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["external-collaborator"] });
      toast.success("Colaborador atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating external collaborator:", error);
      toast.error("Erro ao atualizar colaborador");
    },
  });
}

export function useDeleteExternalCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("external_collaborators")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-collaborators"] });
      toast.success("Colaborador removido com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting external collaborator:", error);
      toast.error("Erro ao remover colaborador");
    },
  });
}

export function useExternalCollaboratorSalaryHistory(collaboratorId: string) {
  return useQuery({
    queryKey: ["external-collaborator-salary-history", collaboratorId],
    queryFn: async () => {
      if (!collaboratorId) return [];

      const { data, error } = await supabase
        .from("external_collaborator_salary_history")
        .select("*")
        .eq("collaborator_id", collaboratorId)
        .order("effective_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!collaboratorId,
  });
}
