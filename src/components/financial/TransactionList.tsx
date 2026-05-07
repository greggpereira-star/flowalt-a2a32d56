import { useState, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Clock,
  AlertCircle,
  Filter,
  Loader2,
  FolderTree,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileDown,
  User,
} from "lucide-react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions, useUpdateTransaction, useDeleteTransaction, useCategories } from "@/hooks/useFinancial";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { toast } from "sonner";

interface TransactionListProps {
  onEdit?: (transaction: any) => void;
  filters?: {
    type?: "income" | "expense" | "transfer";
    status?: "pending" | "paid" | "cancelled" | "overdue";
  };
}

export function TransactionList({ onEdit, filters: initialFilters }: TransactionListProps) {
  const [filters, setFilters] = useState(initialFilters || {});
  const [costCenterFilter, setCostCenterFilter] = useState<string>("all");
  const [collaboratorFilter, setCollaboratorFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<Date | null>(null);
  const [assigningCostCenter, setAssigningCostCenter] = useState<string | null>(null);
  
  const { data: transactions = [], isLoading } = useTransactions(filters);
  const { data: categories = [] } = useCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: members = [] } = useWorkspaceMembers();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><Check className="w-3 h-3 mr-1" /> Pago</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Vencido</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleMarkAsPaid = (id: string) => {
    updateTransaction.mutate({
      id,
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      deleteTransaction.mutate(id);
    }
  };

  const handleAssignCostCenter = async (transactionId: string, costCenterId: string) => {
    setAssigningCostCenter(transactionId);
    try {
      await updateTransaction.mutateAsync({
        id: transactionId,
        cost_center_id: costCenterId === "none" ? null : costCenterId,
      });
      toast.success("Centro de custo atualizado!");
    } catch {
      toast.error("Erro ao atualizar centro de custo");
    } finally {
      setAssigningCostCenter(null);
    }
  };

  // Filter transactions by cost center, collaborator and month
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (costCenterFilter !== "all") {
        if (costCenterFilter === "unassigned" && t.cost_center_id) return false;
        if (costCenterFilter !== "unassigned" && t.cost_center_id !== costCenterFilter) return false;
      }
      if (collaboratorFilter !== "all") {
        if (collaboratorFilter === "unassigned" && t.collaborator_id) return false;
        if (collaboratorFilter !== "unassigned" && t.collaborator_id !== collaboratorFilter) return false;
      }
      if (monthFilter) {
        const txDate = parseISO(t.due_date);
        const start = startOfMonth(monthFilter);
        const end = endOfMonth(monthFilter);
        if (txDate < start || txDate > end) return false;
      }
      return true;
    });
  }, [transactions, costCenterFilter, monthFilter]);

  // Get cost center name by id
  const getCostCenterById = (id: string | null) => {
    if (!id) return null;
    return costCenters.find((cc) => cc.id === id);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredTransactions.map(t => ({
      'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
      'Descrição': t.description,
      'Categoria': t.category?.name || 'Sem categoria',
      'Centro de Custo': costCenters.find(cc => cc.id === t.cost_center_id)?.name || 'Nenhum',
      'Colaborador': t.collaborator?.profile?.full_name || t.collaborator?.profile?.email || 'Nenhum',
      'Vencimento': format(new Date(t.due_date), 'dd/MM/yyyy'),
      'Valor': t.amount,
      'Status': t.status === 'paid' ? 'Pago' : t.status === 'pending' ? 'Pendente' : t.status === 'overdue' ? 'Vencido' : 'Cancelado',
      'NF': t.invoice_number || '-',
      'Notas': t.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
    XLSX.writeFile(wb, `lancamentos_financeiros_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    toast.success("Excel gerado com sucesso!");
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <Select
          value={filters.type || "all"}
          onValueChange={(value) => setFilters({ ...filters, type: value === "all" ? undefined : value as any })}
        >
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? undefined : value as any })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
          <SelectTrigger className="w-[200px]">
            <FolderTree className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Centro de Custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Centros</SelectItem>
            <SelectItem value="unassigned">
              <span className="text-amber-600">⚠️ Sem Centro de Custo</span>
            </SelectItem>
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

        <Select value={collaboratorFilter} onValueChange={setCollaboratorFilter}>
          <SelectTrigger className="w-[200px]">
            <User className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Colaborador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Colaboradores</SelectItem>
            <SelectItem value="unassigned">Sem Colaborador</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.profile?.full_name || member.profile?.email || "Membro"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month Filter */}
        <div className="flex items-center gap-1 border border-border rounded-md px-2 h-10">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMonthFilter((prev) => prev ? subMonths(prev, 1) : subMonths(new Date(), 1))}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <button
            onClick={() => setMonthFilter(monthFilter ? null : new Date())}
            className="text-xs font-medium min-w-[100px] text-center hover:text-primary transition-colors"
          >
            {monthFilter
              ? format(monthFilter, "MMM yyyy", { locale: ptBR })
              : "Todos os meses"}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMonthFilter((prev) => prev ? addMonths(prev, 1) : addMonths(new Date(), 1))}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button variant="outline" onClick={handleExportExcel} className="ml-auto">
          <FileDown className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => {
                const costCenter = getCostCenterById(transaction.cost_center_id);
                
                return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {transaction.type === "income" ? (
                        <ArrowUpCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <ArrowDownCircle className="w-5 h-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>
                      {transaction.category?.name || (
                        <span className="text-muted-foreground">Sem categoria</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={transaction.cost_center_id || "none"}
                          onValueChange={(value) => handleAssignCostCenter(transaction.id, value)}
                          disabled={assigningCostCenter === transaction.id}
                        >
                          <SelectTrigger className="h-8 text-xs w-[140px]">
                            {assigningCostCenter === transaction.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : costCenter ? (
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: costCenter.color || "#3B82F6" }}
                                />
                                <span className="truncate">{costCenter.name}</span>
                              </div>
                            ) : (
                              <span className="text-amber-600">Não atribuído</span>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Nenhum</span>
                            </SelectItem>
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
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className={transaction.type === "income" ? "text-green-500" : "text-red-500"}>
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {transaction.status === "pending" && (
                            <DropdownMenuItem onClick={() => handleMarkAsPaid(transaction.id)}>
                              <Check className="w-4 h-4 mr-2" />
                              Marcar como pago
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(transaction)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(transaction.id)}
                            disabled={deleteTransaction.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
