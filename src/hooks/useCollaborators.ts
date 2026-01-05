import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

export interface CollaboratorDetails {
  id: string;
  member_id: string;
  workspace_id: string;
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  hire_date: string | null;
  contract_type: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  base_salary: number | null;
  partner_percentage: number | null;
  weekly_hours: number | null;
  address: Record<string, string> | null;
  emergency_contact: Record<string, string> | null;
  documents: Array<{ name: string; url: string; expiry_date?: string }> | unknown[] | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  member?: {
    id: string;
    user_id: string;
    function_title: string | null;
    department: string | null;
    profile?: {
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    };
  };
}

export interface SalaryHistory {
  id: string;
  collaborator_id: string;
  workspace_id: string;
  previous_salary: number | null;
  new_salary: number;
  effective_date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export function useCollaborators() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["collaborators", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // First get workspace members
      const { data: members, error: membersError } = await supabase
        .from("workspace_members")
        .select(`
          id,
          user_id,
          function_title,
          department,
          is_active
        `)
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true);

      if (membersError) throw membersError;

      // Get profiles for members
      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get user roles for members
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .eq("workspace_id", currentWorkspace.id);

      if (rolesError) throw rolesError;

      // Get collaborator details
      const memberIds = members.map(m => m.id);
      const { data: details, error: detailsError } = await supabase
        .from("collaborator_details")
        .select("*")
        .in("member_id", memberIds);

      if (detailsError) throw detailsError;

      // Combine data
      return members.map(member => {
        const profile = profiles.find(p => p.id === member.user_id);
        const detail = details.find(d => d.member_id === member.id);
        const userRole = roles.find(r => r.user_id === member.user_id);

        // Always return member_id even if no details exist yet
        return {
          ...detail,
          id: detail?.id || null,
          member_id: detail?.member_id || member.id,
          workspace_id: detail?.workspace_id || currentWorkspace.id,
          // Use profile name as fallback
          full_name: detail?.full_name || profile?.full_name || null,
          member: {
            ...member,
            profile,
            role: userRole?.role || null,
          },
        } as CollaboratorDetails;
      });
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCollaboratorDetails(memberId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["collaborator-details", memberId],
    queryFn: async () => {
      if (!currentWorkspace?.id || !memberId) return null;

      // First, get the workspace_member to get user_id
      const { data: member, error: memberError } = await supabase
        .from("workspace_members")
        .select("id, user_id, function_title, department")
        .eq("id", memberId)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!member) return null;

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", member.user_id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", member.user_id)
        .eq("workspace_id", currentWorkspace.id)
        .maybeSingle();

      // Get collaborator_details if exists
      const { data: details, error: detailsError } = await supabase
        .from("collaborator_details")
        .select("*")
        .eq("member_id", memberId)
        .maybeSingle();

      if (detailsError) throw detailsError;

      // Return combined data - always include member and profile info
      return {
        ...details,
        id: details?.id || null,
        member_id: memberId,
        workspace_id: currentWorkspace.id,
        // Use profile name as fallback if no collaborator_details full_name
        full_name: details?.full_name || profile?.full_name || null,
        member: {
          ...member,
          profile,
          role: roleData?.role || null,
        },
      } as CollaboratorDetails & { member: { role: string | null } };
    },
    enabled: !!currentWorkspace?.id && !!memberId,
  });
}

export function useSalaryHistory(collaboratorId: string) {
  return useQuery({
    queryKey: ["salary-history", collaboratorId],
    queryFn: async () => {
      if (!collaboratorId) return [];

      const { data, error } = await supabase
        .from("salary_history")
        .select("*")
        .eq("collaborator_id", collaboratorId)
        .order("effective_date", { ascending: false });

      if (error) throw error;
      return data as SalaryHistory[];
    },
    enabled: !!collaboratorId,
  });
}

export function useCreateOrUpdateCollaborator() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      memberId,
      ...details
    }: {
      memberId: string;
      full_name?: string;
      cpf?: string | null;
      rg?: string | null;
      birth_date?: string | null;
      hire_date?: string | null;
      contract_type?: string | null;
      bank_name?: string | null;
      bank_agency?: string | null;
      bank_account?: string | null;
      pix_key?: string | null;
      base_salary?: number | null;
      partner_percentage?: number | null;
      weekly_hours?: number | null;
      address?: Record<string, string>;
      emergency_contact?: Record<string, string>;
      documents?: Array<{ name: string; url: string; expiry_date?: string }>;
      notes?: string | null;
    }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      // Check if details already exist
      const { data: existing } = await supabase
        .from("collaborator_details")
        .select("id, base_salary")
        .eq("member_id", memberId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("collaborator_details")
          .update(details)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;

        // If salary changed, add to history
        if (details.base_salary && details.base_salary !== existing.base_salary) {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from("salary_history").insert({
            collaborator_id: existing.id,
            workspace_id: currentWorkspace.id,
            previous_salary: existing.base_salary,
            new_salary: details.base_salary,
            effective_date: new Date().toISOString().split("T")[0],
            created_by: userData.user?.id,
          });
        }

        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("collaborator_details")
          .insert({
            member_id: memberId,
            workspace_id: currentWorkspace.id,
            ...details,
          })
          .select()
          .single();

        if (error) throw error;

        // Add initial salary to history if provided
        if (details.base_salary) {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from("salary_history").insert({
            collaborator_id: data.id,
            workspace_id: currentWorkspace.id,
            new_salary: details.base_salary,
            effective_date: new Date().toISOString().split("T")[0],
            reason: "Salário inicial",
            created_by: userData.user?.id,
          });
        }

        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["collaborator-details"] });
      queryClient.invalidateQueries({ queryKey: ["salary-history"] });
      toast({ title: "Colaborador atualizado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar colaborador", description: error.message, variant: "destructive" });
    },
  });
}

export function useGenerateSalaryTransactions() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (month: Date) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");

      // Get all active collaborators with salary
      const { data: collaborators, error: collabError } = await supabase
        .from("collaborator_details")
        .select(`
          id,
          member_id,
          full_name,
          base_salary
        `)
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true)
        .gt("base_salary", 0);

      if (collabError) throw collabError;

      const dueDate = new Date(month.getFullYear(), month.getMonth() + 1, 5); // Day 5 of next month

      // Check existing transactions for this month
      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const { data: existing } = await supabase
        .from("transactions")
        .select("collaborator_id")
        .eq("workspace_id", currentWorkspace.id)
        .gte("due_date", startOfMonth.toISOString().split("T")[0])
        .lte("due_date", endOfMonth.toISOString().split("T")[0])
        .not("collaborator_id", "is", null);

      const existingIds = new Set(existing?.map(t => t.collaborator_id) || []);

      // Create transactions for collaborators without one
      const { data: userData } = await supabase.auth.getUser();
      const newTransactions = collaborators
        .filter(c => !existingIds.has(c.member_id))
        .map(c => ({
          workspace_id: currentWorkspace.id,
          collaborator_id: c.member_id,
          type: "expense" as const,
          status: "pending" as const,
          description: `Salário - ${c.full_name || "Colaborador"}`,
          amount: c.base_salary,
          due_date: dueDate.toISOString().split("T")[0],
          recurrence: "monthly" as const,
          created_by: userData.user?.id,
        }));

      if (newTransactions.length > 0) {
        const { error } = await supabase
          .from("transactions")
          .insert(newTransactions);

        if (error) throw error;
      }

      return newTransactions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: `${count} lançamentos de salário criados` });
    },
    onError: (error) => {
      toast({ title: "Erro ao gerar salários", description: error.message, variant: "destructive" });
    },
  });
}
