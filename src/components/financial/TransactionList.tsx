import { useState } from "react";
import { format } from "date-fns";
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
} from "lucide-react";
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

interface TransactionListProps {
  onEdit?: (transaction: any) => void;
  filters?: {
    type?: "income" | "expense" | "transfer";
    status?: "pending" | "paid" | "cancelled" | "overdue";
  };
}

export function TransactionList({ onEdit, filters: initialFilters }: TransactionListProps) {
  const [filters, setFilters] = useState(initialFilters || {});
  const { data: transactions = [], isLoading } = useTransactions(filters);
  const { data: categories = [] } = useCategories();
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
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
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
                        <DropdownMenuItem onClick={() => onEdit?.(transaction)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(transaction.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
