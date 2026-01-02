import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, User2, Receipt, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useUpdateTransaction } from "@/hooks/useFinancial";
import { useUpdateExternalCollaborator } from "@/hooks/useExternalCollaborators";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  category?: { name: string } | null;
}

interface Collaborator {
  id: string;
  full_name: string;
  job_title: string | null;
  base_salary: number | null;
}

interface UnassignedItemsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  collaborators: Collaborator[];
  totalTransactions: number;
  totalSalaries: number;
}

export function UnassignedItemsPanel({
  open,
  onOpenChange,
  transactions,
  collaborators,
  totalTransactions,
  totalSalaries,
}: UnassignedItemsPanelProps) {
  const { data: costCenters = [] } = useCostCenters();
  const updateTransaction = useUpdateTransaction();
  const updateCollaborator = useUpdateExternalCollaborator();

  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedCollaborators, setSelectedCollaborators] = useState<Set<string>>(new Set());
  const [bulkCostCenterId, setBulkCostCenterId] = useState<string>("");
  const [assigningItems, setAssigningItems] = useState<Set<string>>(new Set());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleAssignTransaction = async (transactionId: string, costCenterId: string) => {
    setAssigningItems((prev) => new Set(prev).add(transactionId));
    try {
      await updateTransaction.mutateAsync({
        id: transactionId,
        cost_center_id: costCenterId,
      });
      toast.success("Centro de custo atribuído!");
    } catch {
      toast.error("Erro ao atribuir centro de custo");
    } finally {
      setAssigningItems((prev) => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  const handleAssignCollaborator = async (collaboratorId: string, costCenterId: string) => {
    setAssigningItems((prev) => new Set(prev).add(collaboratorId));
    try {
      await updateCollaborator.mutateAsync({
        id: collaboratorId,
        cost_center_id: costCenterId,
      });
      toast.success("Centro de custo atribuído!");
    } catch {
      toast.error("Erro ao atribuir centro de custo");
    } finally {
      setAssigningItems((prev) => {
        const next = new Set(prev);
        next.delete(collaboratorId);
        return next;
      });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkCostCenterId) {
      toast.error("Selecione um centro de custo");
      return;
    }

    const transactionIds = Array.from(selectedTransactions);
    const collaboratorIds = Array.from(selectedCollaborators);

    for (const id of transactionIds) {
      await handleAssignTransaction(id, bulkCostCenterId);
    }

    for (const id of collaboratorIds) {
      await handleAssignCollaborator(id, bulkCostCenterId);
    }

    setSelectedTransactions(new Set());
    setSelectedCollaborators(new Set());
    setBulkCostCenterId("");
  };

  const toggleTransaction = (id: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleCollaborator = (id: string) => {
    setSelectedCollaborators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalSelected = selectedTransactions.size + selectedCollaborators.size;
  const hasUnassignedItems = transactions.length > 0 || collaborators.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Itens Pendentes de Classificação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <Receipt className="w-4 h-4" />
                  <span className="text-xs font-medium">Lançamentos</span>
                </div>
                <p className="text-xl font-bold">{transactions.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(totalTransactions)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <User2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Colaboradores</span>
                </div>
                <p className="text-xl font-bold">{collaborators.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(totalSalaries)}</p>
              </CardContent>
            </Card>
            <Card className="border-rose-500/20 bg-rose-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-rose-600 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Pendente</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(totalTransactions + totalSalaries)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Bulk Actions */}
          {totalSelected > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{totalSelected} selecionados</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Select value={bulkCostCenterId} onValueChange={setBulkCostCenterId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Centro de Custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: cc.color || "#3B82F6" }}
                            />
                            {cc.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleBulkAssign}
                    disabled={!bulkCostCenterId}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Atribuir Todos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collaborators Section */}
          {collaborators.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <User2 className="w-4 h-4" />
                Colaboradores sem Centro de Custo
              </h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Salário</TableHead>
                      <TableHead className="w-[200px]">Centro de Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collaborators.map((c) => (
                      <TableRow key={c.id} className={cn(selectedCollaborators.has(c.id) && "bg-primary/5")}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCollaborators.has(c.id)}
                            onCheckedChange={() => toggleCollaborator(c.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.job_title || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-amber-600">
                          {formatCurrency(c.base_salary || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(value) => handleAssignCollaborator(c.id, value)}
                              disabled={assigningItems.has(c.id)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {costCenters.map((cc) => (
                                  <SelectItem key={cc.id} value={cc.id}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: cc.color || "#3B82F6" }}
                                      />
                                      {cc.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {assigningItems.has(c.id) && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Transactions Section */}
          {transactions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Lançamentos sem Centro de Custo
              </h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[200px]">Centro de Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={t.id} className={cn(selectedTransactions.has(t.id) && "bg-primary/5")}>
                        <TableCell>
                          <Checkbox
                            checked={selectedTransactions.has(t.id)}
                            onCheckedChange={() => toggleTransaction(t.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(t.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">{t.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.category?.name || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(t.amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(value) => handleAssignTransaction(t.id, value)}
                              disabled={assigningItems.has(t.id)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {costCenters.map((cc) => (
                                  <SelectItem key={cc.id} value={cc.id}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: cc.color || "#3B82F6" }}
                                      />
                                      {cc.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {assigningItems.has(t.id) && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!hasUnassignedItems && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
              <p className="text-lg font-medium text-emerald-600">Tudo classificado!</p>
              <p className="text-sm text-muted-foreground">
                Não há itens pendentes de classificação.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
