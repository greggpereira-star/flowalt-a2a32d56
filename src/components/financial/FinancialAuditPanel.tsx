import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  FileText,
  ArrowLeftRight,
  Building2,
  Eye,
  ChevronDown,
  ChevronUp,
  Shield,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useFinancialAuditTrail,
  usePendingApprovals,
  useApproveAction,
  useAuditStats,
  useAnomalyDetection,
  FinancialAuditEntry,
} from "@/hooks/useFinancialAudit";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const entityIcons: Record<string, React.ReactNode> = {
  transaction: <ArrowLeftRight className="w-4 h-4" />,
  invoice: <FileText className="w-4 h-4" />,
  cost_center: <Building2 className="w-4 h-4" />,
};

const actionColors: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  update: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  delete: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  approve: "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

const actionLabels: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  approve: "Aprovação",
};

export function FinancialAuditPanel() {
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [approvalDialog, setApprovalDialog] = useState<{
    entry: FinancialAuditEntry;
    action: "approve" | "reject";
  } | null>(null);
  const [approvalReason, setApprovalReason] = useState("");

  const { data: auditEntries, isLoading } = useFinancialAuditTrail({
    entityType: entityFilter !== "all" ? entityFilter : undefined,
    action: actionFilter !== "all" ? actionFilter : undefined,
  });
  const { data: pendingApprovals } = usePendingApprovals();
  const { data: anomalies } = useAnomalyDetection();
  const { data: stats } = useAuditStats();
  const approveAction = useApproveAction();

  const handleApproval = () => {
    if (!approvalDialog) return;
    
    approveAction.mutate({
      auditId: approvalDialog.entry.id,
      approved: approvalDialog.action === "approve",
      reason: approvalReason,
    });
    
    setApprovalDialog(null);
    setApprovalReason("");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border border-border/50">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Total do Mês
              </span>
              <History className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats?.total || 0}</p>
          </CardContent>
        </Card>

        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-600 uppercase tracking-wider">
                Aguardando Aprovação
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold mt-2 text-amber-600">
              {pendingApprovals?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rose-600 uppercase tracking-wider">
                Anomalias
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold mt-2 text-rose-600">
              {anomalies?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 uppercase tracking-wider">
                Aprovados
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold mt-2 text-emerald-600">
              {stats?.approvedCount || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals Section */}
      {(pendingApprovals?.length || 0) > 0 && (
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Aprovações Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals?.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {entityIcons[entry.entity_type] || <Activity className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {actionLabels[entry.action] || entry.action} - {entry.entity_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                      onClick={() => setApprovalDialog({ entry, action: "reject" })}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setApprovalDialog({ entry, action: "approve" })}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-5 h-5" />
              Trilha de Auditoria
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="Entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="transaction">Transações</SelectItem>
                  <SelectItem value="invoice">Notas Fiscais</SelectItem>
                  <SelectItem value="cost_center">Centros de Custo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="create">Criação</SelectItem>
                  <SelectItem value="update">Atualização</SelectItem>
                  <SelectItem value="delete">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {auditEntries?.map((entry) => (
                <Collapsible
                  key={entry.id}
                  open={expandedEntry === entry.id}
                  onOpenChange={(open) => setExpandedEntry(open ? entry.id : null)}
                >
                  <div
                    className={cn(
                      "border rounded-lg transition-colors",
                      entry.is_anomaly && "border-rose-500/30 bg-rose-500/5",
                      !entry.is_anomaly && "border-border/50"
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 flex items-center justify-between hover:bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            {entityIcons[entry.entity_type] || <Activity className="w-4 h-4" />}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn("text-xs", actionColors[entry.action])}
                              >
                                {actionLabels[entry.action] || entry.action}
                              </Badge>
                              <span className="text-sm font-medium capitalize">
                                {entry.entity_type.replace("_", " ")}
                              </span>
                              {entry.is_anomaly && (
                                <Badge variant="outline" className="text-xs border-rose-500/30 bg-rose-500/10 text-rose-600">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Anomalia
                                </Badge>
                              )}
                              {entry.approval_status === "approved" && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              )}
                              {entry.approval_status === "rejected" && (
                                <XCircle className="w-4 h-4 text-rose-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {expandedEntry === entry.id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0">
                        <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-muted-foreground">ID da Entidade</span>
                              <p className="font-mono text-xs">{entry.entity_id}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">IP</span>
                              <p className="font-mono text-xs">{entry.ip_address || "N/A"}</p>
                            </div>
                          </div>
                          {entry.changes && (
                            <div>
                              <span className="text-xs text-muted-foreground">Alterações</span>
                              <pre className="mt-1 text-xs bg-background p-2 rounded overflow-x-auto">
                                {JSON.stringify(entry.changes, null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.reason && (
                            <div>
                              <span className="text-xs text-muted-foreground">Motivo</span>
                              <p className="text-xs">{entry.reason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
              {(!auditEntries || auditEntries.length === 0) && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum registro de auditoria encontrado
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={!!approvalDialog} onOpenChange={() => setApprovalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog?.action === "approve" ? "Aprovar Ação" : "Rejeitar Ação"}
            </DialogTitle>
            <DialogDescription>
              {approvalDialog?.action === "approve"
                ? "Confirme a aprovação desta ação financeira."
                : "Informe o motivo da rejeição desta ação financeira."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={
                approvalDialog?.action === "approve"
                  ? "Observações (opcional)"
                  : "Motivo da rejeição"
              }
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleApproval}
              className={cn(
                approvalDialog?.action === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              )}
              disabled={approvalDialog?.action === "reject" && !approvalReason}
            >
              {approvalDialog?.action === "approve" ? "Aprovar" : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
