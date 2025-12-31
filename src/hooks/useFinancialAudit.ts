import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface FinancialAuditEntry {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  user_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  requires_approval: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  approved_by: string | null;
  approved_at: string | null;
  reason: string | null;
  is_anomaly: boolean;
  anomaly_type: string | null;
  anomaly_score: number | null;
  created_at: string;
  user?: { email: string; raw_user_meta_data?: { full_name?: string } };
}

export function useFinancialAuditTrail(filters?: {
  entityType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  requiresApproval?: boolean;
  isAnomaly?: boolean;
}) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["financial-audit-trail", currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from("financial_audit_trail")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filters?.entityType) {
        query = query.eq("entity_type", filters.entityType);
      }
      if (filters?.action) {
        query = query.eq("action", filters.action);
      }
      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate);
      }
      if (filters?.requiresApproval !== undefined) {
        query = query.eq("requires_approval", filters.requiresApproval);
      }
      if (filters?.isAnomaly !== undefined) {
        query = query.eq("is_anomaly", filters.isAnomaly);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialAuditEntry[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function usePendingApprovals() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["pending-approvals", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("financial_audit_trail")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("requires_approval", true)
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FinancialAuditEntry[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      auditId, 
      approved, 
      reason 
    }: { 
      auditId: string; 
      approved: boolean; 
      reason?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("financial_audit_trail")
        .update({
          approval_status: approved ? "approved" : "rejected",
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
          reason,
        })
        .eq("id", auditId);

      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ["financial-audit-trail"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      toast.success(approved ? "Ação aprovada" : "Ação rejeitada");
    },
    onError: (error) => {
      toast.error("Erro ao processar aprovação", { description: error.message });
    },
  });
}

export function useAnomalyDetection() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["anomalies", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("financial_audit_trail")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_anomaly", true)
        .order("anomaly_score", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as FinancialAuditEntry[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useAuditStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["audit-stats", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      // Get all audit entries for this month
      const { data: entries, error } = await supabase
        .from("financial_audit_trail")
        .select("action, entity_type, is_anomaly, requires_approval, approval_status")
        .eq("workspace_id", currentWorkspace.id)
        .gte("created_at", startOfMonth);

      if (error) throw error;

      const stats = {
        total: entries.length,
        creates: entries.filter(e => e.action === "create").length,
        updates: entries.filter(e => e.action === "update").length,
        deletes: entries.filter(e => e.action === "delete").length,
        anomalies: entries.filter(e => e.is_anomaly).length,
        pendingApprovals: entries.filter(e => e.requires_approval && e.approval_status === "pending").length,
        approvedCount: entries.filter(e => e.approval_status === "approved").length,
        rejectedCount: entries.filter(e => e.approval_status === "rejected").length,
        byEntityType: entries.reduce((acc, e) => {
          acc[e.entity_type] = (acc[e.entity_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      return stats;
    },
    enabled: !!currentWorkspace?.id,
  });
}
