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
// @ts-ignore
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [filters, setFilters] = useState({
    type: initialFilters?.type || "all",
    status: initialFilters?.status || "all",
    category: "all",
    costCenter: "all",
    collaborator: "all",
    month: null as Date | null,
  });
  
  const [assigningCostCenter, setAssigningCostCenter] = useState<string | null>(null);
  
  const { data: transactions = [], isLoading } = useTransactions({
    type: filters.type === "all" ? undefined : filters.type as any,
    status: filters.status === "all" ? undefined : filters.status as any,
    categoryId: filters.category === "all" ? undefined : filters.category,
    costCenterId: filters.costCenter === "all" || filters.costCenter === "unassigned" ? undefined : filters.costCenter,
    collaboratorId: filters.collaborator === "all" || filters.collaborator === "unassigned" ? undefined : filters.collaborator,
    startDate: filters.month ? startOfMonth(filters.month).toISOString().split("T")[0] : undefined,
    endDate: filters.month ? endOfMonth(filters.month).toISOString().split("T")[0] : undefined,
  });
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

  // Client-side filtering for cases not handled by the API (like "unassigned")
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.costCenter === "unassigned" && t.cost_center_id) return false;
      if (filters.collaborator === "unassigned" && t.collaborator_id) return false;
      return true;
    });
  }, [transactions, filters.costCenter, filters.collaborator]);

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
      <Tabs
        value={filters.category}
        onValueChange={(value) => {
          setFilters(prev => ({ ...prev, category: value }));
        }}
        className="w-full"
      >
        <TabsList className="mb-4 flex-wrap h-auto bg-transparent gap-2">
          <TabsTrigger 
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-border"
          >
            Todos <Badge variant="secondary" className="ml-1.5">{transactions.length}</Badge>
          </TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-border"
            >
              {cat.name} <Badge variant="secondary" className="ml-1.5">{transactions.filter(t => t.category_id === cat.id).length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex gap-4 flex-wrap">
        <Select
          value={filters.type}
          onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
        >
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.costCenter} 
          onValueChange={(value) => setFilters(prev => ({ ...prev, costCenter: value }))}
        >
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

        <Select 
          value={filters.collaborator} 
          onValueChange={(value) => setFilters(prev => ({ ...prev, collaborator: value }))}
        >
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
            onClick={() => setFilters(prev => ({ ...prev, month: prev.month ? subMonths(prev.month, 1) : subMonths(new Date(), 1) }))}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, month: prev.month ? null : new Date() }))}
            className="text-xs font-medium min-w-[100px] text-center hover:text-primary transition-colors"
          >
            {filters.month
              ? format(filters.month, "MMM yyyy", { locale: ptBR })
              : "Todos os meses"}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setFilters(prev => ({ ...prev, month: prev.month ? addMonths(prev.month, 1) : addMonths(new Date(), 1) }))}
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
