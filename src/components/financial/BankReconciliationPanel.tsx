import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Link2,
  CheckCircle,
  XCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Percent,
  Unlink,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useInvoices, Invoice } from "@/hooks/useInvoices";
import { useTransactions, Transaction } from "@/hooks/useFinancial";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BankReconciliation {
  id: string;
  bank_statement_date: string;
  bank_statement_amount: number;
  bank_statement_type: string;
  bank_statement_description: string | null;
  bank_name: string | null;
  status: string;
  match_confidence: number | null;
  match_reason: string | null;
  transaction_id: string | null;
  invoice_id: string | null;
  reconciled_at: string | null;
  difference_amount: number | null;
  difference_reason: string | null;
}

interface ReconciliationMatch {
  invoice: Invoice;
  transaction: Transaction | null;
  confidence: number;
  status: "matched" | "pending" | "unmatched";
}

export function BankReconciliationPanel() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<BankReconciliation | null>(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"ofx" | "invoices">("ofx");
  
  const { data: invoices = [] } = useInvoices();
  const { data: transactions = [] } = useTransactions();

  // Fetch OFX reconciliations
  const { data: reconciliations = [], isLoading: reconciliationsLoading } = useQuery({
    queryKey: ["bank-reconciliations", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("bank_statement_date", { ascending: false });
      
      if (error) throw error;
      return data as BankReconciliation[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Helper to log audit trail for reconciliation actions
  const logReconciliationAudit = async (
    action: "reconcile" | "unreconcile" | "ignore",
    entityId: string,
    oldData: unknown,
    newData: unknown
  ) => {
    if (!currentWorkspace?.id) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) return;

      const changedFields =
        typeof oldData === "object" &&
        oldData !== null &&
        typeof newData === "object" &&
        newData !== null
          ? Object.keys(newData as object).filter(
              (key) =>
                (oldData as Record<string, unknown>)[key] !==
                (newData as Record<string, unknown>)[key]
            )
          : [];

      await supabase.from("financial_audit_trail").insert([
        {
          workspace_id: currentWorkspace.id,
          entity_type: "bank_reconciliation",
          entity_id: entityId,
          action,
          user_id: userData.user.id,
          old_data: oldData as null,
          new_data: newData as null,
          changes: { action, changed_fields: changedFields } as null,
        },
      ]);
    } catch (error) {
      console.error("Failed to log audit trail:", error);
    }
  };

  const reconcileMutation = useMutation({
    mutationFn: async ({
      reconciliationId,
      transactionId,
      invoiceId,
    }: {
      reconciliationId: string;
      transactionId?: string;
      invoiceId?: string;
    }) => {
      // Get current state for audit
      const { data: currentState } = await supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("id", reconciliationId)
        .single();

      const newData = {
        status: "reconciled",
        transaction_id: transactionId || null,
        invoice_id: invoiceId || null,
        reconciled_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("bank_reconciliations")
        .update(newData)
        .eq("id", reconciliationId);

      if (error) throw error;

      // Log audit trail
      await logReconciliationAudit(
        "reconcile",
        reconciliationId,
        currentState || {},
        newData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["financial-audit-trail"] });
      toast.success("Conciliação realizada com sucesso");
      setMatchDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast.error("Erro ao conciliar");
    },
  });

  const unreconcileMutation = useMutation({
    mutationFn: async (reconciliationId: string) => {
      // Get current state for audit
      const { data: currentState } = await supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("id", reconciliationId)
        .single();

      const newData = {
        status: "pending",
        transaction_id: null,
        invoice_id: null,
        reconciled_at: null,
      };

      const { error } = await supabase
        .from("bank_reconciliations")
        .update(newData)
        .eq("id", reconciliationId);

      if (error) throw error;

      // Log audit trail
      await logReconciliationAudit(
        "unreconcile",
        reconciliationId,
        currentState || {},
        newData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["financial-audit-trail"] });
      toast.success("Conciliação desfeita");
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (reconciliationId: string) => {
      // Get current state for audit
      const { data: currentState } = await supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("id", reconciliationId)
        .single();

      const { error } = await supabase
        .from("bank_reconciliations")
        .update({ status: "ignored" })
        .eq("id", reconciliationId);

      if (error) throw error;

      // Log audit trail
      await logReconciliationAudit(
        "ignore",
        reconciliationId,
        currentState || {},
        { status: "ignored" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["financial-audit-trail"] });
      toast.success("Item ignorado");
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Simple matching algorithm for invoices
  const findInvoiceMatches = (): ReconciliationMatch[] => {
    return invoices.map((invoice) => {
      const potentialMatch = transactions.find((tx) => {
        const amountMatch = Math.abs(tx.amount - invoice.net_amount) < 0.01;
        const dateClose =
          Math.abs(
            new Date(tx.due_date).getTime() - new Date(invoice.issue_date).getTime()
          ) <
          7 * 24 * 60 * 60 * 1000;
        return amountMatch && dateClose && tx.type === "income";
      });

      if (invoice.transaction_id) {
        const linkedTx = transactions.find((tx) => tx.id === invoice.transaction_id);
        return {
          invoice,
          transaction: linkedTx || null,
          confidence: 100,
          status: "matched" as const,
        };
      }

      if (potentialMatch) {
        return {
          invoice,
          transaction: potentialMatch,
          confidence: 85,
          status: "pending" as const,
        };
      }

      return {
        invoice,
        transaction: null,
        confidence: 0,
        status: "unmatched" as const,
      };
    });
  };

  const getSuggestedMatches = (item: BankReconciliation) => {
    const matches: Array<{
      type: "transaction" | "invoice";
      id: string;
      description: string;
      amount: number;
      date: string;
      confidence: number;
    }> = [];

    transactions?.forEach((t) => {
      let confidence = 0;
      const amountDiff = Math.abs(t.amount - Math.abs(item.bank_statement_amount));

      if (amountDiff === 0) confidence += 50;
      else if (amountDiff < 10) confidence += 30;
      else if (amountDiff < 100) confidence += 10;

      const dateDiff =
        Math.abs(
          new Date(t.due_date).getTime() - new Date(item.bank_statement_date).getTime()
        ) /
        (1000 * 60 * 60 * 24);
      if (dateDiff <= 1) confidence += 30;
      else if (dateDiff <= 3) confidence += 20;
      else if (dateDiff <= 7) confidence += 10;

      if (confidence > 20) {
        matches.push({
          type: "transaction",
          id: t.id,
          description: t.description,
          amount: t.amount,
          date: t.due_date,
          confidence,
        });
      }
    });

    invoices?.forEach((inv) => {
      let confidence = 0;
      const amountDiff = Math.abs(
        (inv.net_amount || 0) - Math.abs(item.bank_statement_amount)
      );

      if (amountDiff === 0) confidence += 50;
      else if (amountDiff < 10) confidence += 30;
      else if (amountDiff < 100) confidence += 10;

      if (confidence > 20) {
        matches.push({
          type: "invoice",
          id: inv.id,
          description: `NF ${inv.invoice_number}`,
          amount: inv.net_amount || 0,
          date: inv.issue_date,
          confidence,
        });
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  };

  const filteredReconciliations = reconciliations?.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        r.bank_statement_description?.toLowerCase().includes(search) ||
        r.bank_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const invoiceMatches = findInvoiceMatches();
  const matchedCount = invoiceMatches.filter((m) => m.status === "matched").length;
  const pendingCount = invoiceMatches.filter((m) => m.status === "pending").length;
  const unmatchedCount = invoiceMatches.filter((m) => m.status === "unmatched").length;
  const reconciliationRate =
    invoices.length > 0 ? (matchedCount / invoices.length) * 100 : 0;

  const ofxStats = {
    total: reconciliations?.length || 0,
    reconciled: reconciliations?.filter((r) => r.status === "reconciled").length || 0,
    pending: reconciliations?.filter((r) => r.status === "pending").length || 0,
    ignored: reconciliations?.filter((r) => r.status === "ignored").length || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matched":
      case "reconciled":
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" /> Conciliado
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <HelpCircle className="w-3 h-3 mr-1" /> Pendente
          </Badge>
        );
      case "unmatched":
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" /> Pendente
          </Badge>
        );
      case "ignored":
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" /> Ignorado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Conciliação Bancária
          </h3>
          <p className="text-sm text-muted-foreground">
            Vincule extratos bancários às transações e notas fiscais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as "ofx" | "invoices")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ofx">Extrato OFX</SelectItem>
              <SelectItem value="invoices">Notas Fiscais</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewMode === "ofx" ? (
        <>
          {/* OFX Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{ofxStats.total}</div>
                <p className="text-sm text-muted-foreground">Total de Itens</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{ofxStats.reconciled}</div>
                <p className="text-sm text-muted-foreground">Conciliados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{ofxStats.pending}</div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-muted-foreground">{ofxStats.ignored}</div>
                <p className="text-sm text-muted-foreground">Ignorados</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Extrato Importado (OFX)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="reconciled">Conciliados</SelectItem>
                    <SelectItem value="ignored">Ignorados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reconciliationsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredReconciliations?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum item encontrado. Importe um arquivo OFX para começar.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReconciliations?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {format(new Date(item.bank_statement_date), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.bank_statement_description || "-"}
                        </TableCell>
                        <TableCell>{item.bank_name || "-"}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`flex items-center justify-end gap-1 ${
                              item.bank_statement_type === "credit"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {item.bank_statement_type === "credit" ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                            {formatCurrency(Math.abs(item.bank_statement_amount))}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {item.status === "pending" && (
                              <>
                                <Dialog
                                  open={matchDialogOpen && selectedItem?.id === item.id}
                                  onOpenChange={(open) => {
                                    setMatchDialogOpen(open);
                                    if (!open) setSelectedItem(null);
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedItem(item)}
                                    >
                                      <Link2 className="h-4 w-4 mr-1" />
                                      Vincular
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Vincular Lançamento</DialogTitle>
                                    </DialogHeader>
                                    {selectedItem && (
                                      <div className="space-y-4">
                                        <div className="p-4 bg-muted rounded-lg">
                                          <div className="font-medium">
                                            {selectedItem.bank_statement_description}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                            {format(
                                              new Date(selectedItem.bank_statement_date),
                                              "dd/MM/yyyy"
                                            )}{" "}
                                            •{" "}
                                            {formatCurrency(
                                              Math.abs(selectedItem.bank_statement_amount)
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-2">
                                          <h4 className="font-medium">
                                            Correspondências sugeridas:
                                          </h4>
                                          {getSuggestedMatches(selectedItem).map((match) => (
                                            <div
                                              key={`${match.type}-${match.id}`}
                                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                              onClick={() => {
                                                reconcileMutation.mutate({
                                                  reconciliationId: selectedItem.id,
                                                  transactionId:
                                                    match.type === "transaction"
                                                      ? match.id
                                                      : undefined,
                                                  invoiceId:
                                                    match.type === "invoice"
                                                      ? match.id
                                                      : undefined,
                                                });
                                              }}
                                            >
                                              <div>
                                                <div className="font-medium">
                                                  {match.description}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                  {format(new Date(match.date), "dd/MM/yyyy")} •{" "}
                                                  {formatCurrency(match.amount)}
                                                </div>
                                              </div>
                                              <Badge
                                                variant={
                                                  match.confidence > 60 ? "default" : "secondary"
                                                }
                                              >
                                                {match.confidence}% match
                                              </Badge>
                                            </div>
                                          ))}
                                          {getSuggestedMatches(selectedItem).length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                              Nenhuma correspondência encontrada automaticamente.
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => ignoreMutation.mutate(item.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {item.status === "reconciled" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => unreconcileMutation.mutate(item.id)}
                              >
                                <Unlink className="h-4 w-4 mr-1" />
                                Desfazer
                              </Button>
                            )}
                            {item.status === "ignored" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => unreconcileMutation.mutate(item.id)}
                              >
                                Restaurar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Invoice Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-bold">{invoices.length}</div>
                    <div className="text-xs text-muted-foreground">Total de NFs</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold">{matchedCount}</div>
                    <div className="text-xs text-muted-foreground">Conciliadas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-yellow-500" />
                  <div>
                    <div className="text-2xl font-bold">{pendingCount}</div>
                    <div className="text-xs text-muted-foreground">Sugeridas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <div className="text-2xl font-bold">{unmatchedCount}</div>
                    <div className="text-xs text-muted-foreground">Pendentes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reconciliation Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Taxa de Conciliação</span>
                <Badge variant="outline" className="gap-1">
                  <Percent className="w-3 h-3" />
                  {reconciliationRate.toFixed(1)}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={reconciliationRate} className="h-3" />
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>
                  {matchedCount} de {invoices.length} notas conciliadas
                </span>
                {unmatchedCount > 0 && (
                  <span className="text-orange-500 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {unmatchedCount} pendentes de conciliação
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Invoice Reconciliation Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas Fiscais para Conciliação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nota Fiscal</TableHead>
                      <TableHead>Valor NF</TableHead>
                      <TableHead className="text-center">
                        <ArrowRight className="w-4 h-4 mx-auto" />
                      </TableHead>
                      <TableHead>Transação</TableHead>
                      <TableHead>Valor TX</TableHead>
                      <TableHead>Confiança</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceMatches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          Nenhuma nota fiscal para conciliar
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoiceMatches.map((match) => (
                        <TableRow key={match.invoice.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{match.invoice.invoice_number}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(match.invoice.issue_date), "dd/MM/yyyy")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(match.invoice.net_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Link2
                              className={`w-4 h-4 mx-auto ${
                                match.transaction ? "text-green-500" : "text-muted-foreground"
                              }`}
                            />
                          </TableCell>
                          <TableCell>
                            {match.transaction ? (
                              <div>
                                <div className="font-medium">{match.transaction.description}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(match.transaction.due_date), "dd/MM/yyyy")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {match.transaction ? (
                              <span className="font-medium">
                                {formatCurrency(match.transaction.amount)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {match.confidence > 0 ? (
                              <Badge
                                variant="outline"
                                className={
                                  match.confidence >= 80 ? "text-green-500" : "text-yellow-500"
                                }
                              >
                                {match.confidence}%
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(match.status)}</TableCell>
                          <TableCell>
                            {match.status === "pending" && (
                              <Button size="sm" variant="outline">
                                Confirmar
                              </Button>
                            )}
                            {match.status === "unmatched" && (
                              <Button size="sm" variant="outline">
                                Vincular
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
