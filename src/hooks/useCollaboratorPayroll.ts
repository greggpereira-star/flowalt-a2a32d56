import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

export interface CollaboratorBenefits {
  id: string;
  collaborator_id: string;
  workspace_id: string;
  vt_enabled: boolean;
  vt_value: number;
  vt_discount_percentage: number;
  va_enabled: boolean;
  va_value: number;
  vr_enabled: boolean;
  vr_value: number;
  health_plan_enabled: boolean;
  health_plan_value: number;
  health_plan_employee_percentage: number;
  dental_plan_enabled: boolean;
  dental_plan_value: number;
  gym_enabled: boolean;
  gym_value: number;
  parking_enabled: boolean;
  parking_value: number;
  bonus_enabled: boolean;
  bonus_type: string;
  bonus_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollaboratorPayroll {
  id: string;
  collaborator_id: string;
  workspace_id: string;
  reference_month: string;
  payment_date: string | null;
  base_salary: number;
  overtime_hours: number;
  overtime_value: number;
  bonus: number;
  commission: number;
  vt_value: number;
  va_value: number;
  vr_value: number;
  health_plan_value: number;
  dental_plan_value: number;
  other_benefits: number;
  inss_value: number;
  inss_percentage: number;
  irrf_value: number;
  irrf_base: number;
  vt_discount: number;
  health_plan_discount: number;
  other_discounts: number;
  other_discounts_description: string | null;
  fgts_value: number;
  fgts_percentage: number;
  inss_patronal: number;
  provision_13th: number;
  provision_vacation: number;
  provision_vacation_13th: number;
  gross_salary: number;
  total_discounts: number;
  net_salary: number;
  total_cost: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  collaborator?: {
    id: string;
    full_name: string | null;
    member?: {
      function_title: string | null;
      department: string | null;
      profile?: {
        full_name: string | null;
        email: string;
        avatar_url: string | null;
      };
    };
  };
}

export interface CollaboratorAbsence {
  id: string;
  collaborator_id: string;
  workspace_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  is_paid: boolean;
  vacation_bonus: boolean;
  vacation_bonus_days: number;
  vacation_value: number;
  vacation_third: number;
  total_value: number;
  document_url: string | null;
  document_type: string | null;
  status: string;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VacationBalance {
  id: string;
  collaborator_id: string;
  workspace_id: string;
  acquisition_start: string;
  acquisition_end: string;
  concession_start: string;
  concession_end: string;
  total_days: number;
  days_taken: number;
  days_remaining: number;
  days_sold: number;
  status: string;
  is_expired: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Hook para buscar benefícios de um colaborador
export function useCollaboratorBenefits(collaboratorId: string) {
  return useQuery({
    queryKey: ["collaborator-benefits", collaboratorId],
    queryFn: async () => {
      if (!collaboratorId) return null;

      const { data, error } = await supabase
        .from("collaborator_benefits")
        .select("*")
        .eq("collaborator_id", collaboratorId)
        .maybeSingle();

      if (error) throw error;
      return data as CollaboratorBenefits | null;
    },
    enabled: !!collaboratorId,
  });
}

// Hook para atualizar benefícios
export function useUpdateBenefits() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      collaboratorId,
      ...benefits
    }: Partial<CollaboratorBenefits> & { collaboratorId: string }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data: existing } = await supabase
        .from("collaborator_benefits")
        .select("id")
        .eq("collaborator_id", collaboratorId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("collaborator_benefits")
          .update(benefits)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("collaborator_benefits")
          .insert({
            collaborator_id: collaboratorId,
            workspace_id: currentWorkspace.id,
            ...benefits,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collaborator-benefits", variables.collaboratorId] });
      toast({ title: "Benefícios atualizados com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar benefícios", description: error.message, variant: "destructive" });
    },
  });
}

// Hook para buscar folhas de pagamento
export function usePayrolls(referenceMonth?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["payrolls", currentWorkspace?.id, referenceMonth],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from("collaborator_payroll")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("reference_month", { ascending: false });

      if (referenceMonth) {
        query = query.eq("reference_month", referenceMonth);
      }

      const { data: payrolls, error } = await query;
      if (error) throw error;

      // Buscar dados dos colaboradores
      const collaboratorIds = [...new Set(payrolls.map(p => p.collaborator_id))];
      
      const { data: collaborators } = await supabase
        .from("collaborator_details")
        .select(`
          id,
          full_name,
          member_id
        `)
        .in("id", collaboratorIds);

      // Buscar membros e profiles
      const memberIds = collaborators?.map(c => c.member_id) || [];
      const { data: members } = await supabase
        .from("workspace_members")
        .select("id, function_title, department, user_id")
        .in("id", memberIds);

      const userIds = members?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

      return payrolls.map(payroll => {
        const collaborator = collaborators?.find(c => c.id === payroll.collaborator_id);
        const member = members?.find(m => m.id === collaborator?.member_id);
        const profile = profiles?.find(p => p.id === member?.user_id);

        return {
          ...payroll,
          collaborator: collaborator ? {
            ...collaborator,
            member: member ? {
              ...member,
              profile,
            } : undefined,
          } : undefined,
        } as CollaboratorPayroll;
      });
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Hook para gerar folha de pagamento
export function useGeneratePayroll() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ referenceMonth }: { referenceMonth: Date }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const monthStr = referenceMonth.toISOString().slice(0, 10);

      const { data, error } = await supabase.rpc("generate_payroll", {
        p_workspace_id: currentWorkspace.id,
        p_reference_month: monthStr,
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      toast({ title: `${count} folhas de pagamento geradas` });
    },
    onError: (error) => {
      toast({ title: "Erro ao gerar folha", description: error.message, variant: "destructive" });
    },
  });
}

// Hook para aprovar folha de pagamento
export function useApprovePayroll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ payrollId }: { payrollId: string }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("collaborator_payroll")
        .update({
          status: "approved",
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", payrollId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      toast({ title: "Folha aprovada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao aprovar folha", description: error.message, variant: "destructive" });
    },
  });
}

// Hook para buscar ausências
export function useAbsences(collaboratorId?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["absences", currentWorkspace?.id, collaboratorId],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from("collaborator_absences")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("start_date", { ascending: false });

      if (collaboratorId) {
        query = query.eq("collaborator_id", collaboratorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CollaboratorAbsence[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Hook para criar ausência
export function useCreateAbsence() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (absence: Partial<CollaboratorAbsence> & { collaborator_id: string; absence_type: string; start_date: string; end_date: string; days_count: number }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("collaborator_absences")
        .insert({
          ...absence,
          workspace_id: currentWorkspace.id,
          requested_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["vacation-balance"] });
      toast({ title: "Ausência registrada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar ausência", description: error.message, variant: "destructive" });
    },
  });
}

// Hook para buscar saldo de férias
export function useVacationBalance(collaboratorId?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["vacation-balance", currentWorkspace?.id, collaboratorId],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from("collaborator_vacation_balance")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("acquisition_start", { ascending: false });

      if (collaboratorId) {
        query = query.eq("collaborator_id", collaboratorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as VacationBalance[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Hook para analytics de colaboradores
export function useCollaboratorAnalytics() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["collaborator-analytics", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      // Buscar dados de colaboradores
      const { data: collaborators } = await supabase
        .from("collaborator_details")
        .select("id, base_salary, weekly_hours, hire_date, contract_type")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true);

      // Buscar benefícios
      const { data: benefits } = await supabase
        .from("collaborator_benefits")
        .select("*")
        .eq("workspace_id", currentWorkspace.id);

      // Buscar última folha
      const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
      const { data: payrolls } = await supabase
        .from("collaborator_payroll")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("reference_month", currentMonth);

      // Calcular métricas
      const totalCollaborators = collaborators?.length || 0;
      const totalBaseSalary = collaborators?.reduce((acc, c) => acc + (c.base_salary || 0), 0) || 0;
      const totalWeeklyHours = collaborators?.reduce((acc, c) => acc + (c.weekly_hours || 40), 0) || 0;
      
      const totalBenefits = benefits?.reduce((acc, b) => {
        return acc + 
          (b.vt_value || 0) + 
          (b.va_value || 0) + 
          (b.vr_value || 0) + 
          (b.health_plan_value || 0) + 
          (b.dental_plan_value || 0);
      }, 0) || 0;

      const totalNetSalary = payrolls?.reduce((acc, p) => acc + (p.net_salary || 0), 0) || 0;
      const totalCost = payrolls?.reduce((acc, p) => acc + (p.total_cost || 0), 0) || 0;
      const totalINSS = payrolls?.reduce((acc, p) => acc + (p.inss_value || 0), 0) || 0;
      const totalIRRF = payrolls?.reduce((acc, p) => acc + (p.irrf_value || 0), 0) || 0;
      const totalFGTS = payrolls?.reduce((acc, p) => acc + (p.fgts_value || 0), 0) || 0;
      const totalProvisions = payrolls?.reduce((acc, p) => acc + (p.provision_13th || 0) + (p.provision_vacation || 0), 0) || 0;

      // Distribuição por tipo de contrato
      const contractDistribution = collaborators?.reduce((acc, c) => {
        const type = c.contract_type || "clt";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalCollaborators,
        totalBaseSalary,
        totalWeeklyHours,
        totalBenefits,
        totalNetSalary,
        totalCost,
        totalINSS,
        totalIRRF,
        totalFGTS,
        totalProvisions,
        contractDistribution,
        avgSalary: totalCollaborators > 0 ? totalBaseSalary / totalCollaborators : 0,
        avgCost: totalCollaborators > 0 ? totalCost / totalCollaborators : 0,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
