import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTransactions, useUpdateTransaction, useDeleteTransaction, Transaction } from "@/hooks/useFinancial";
import { cn } from "@/lib/utils";

interface CashFlowPendingPanelProps {
  onEdit?: (transaction: Transaction) => void;
}

export function CashFlowPendingPanel({ onEdit }: CashFlowPendingPanelProps) {
  const [incomeExpanded, setIncomeExpanded] = useState(true);
  const [expenseExpanded, setExpenseExpanded] = useState(true);
  
  const { data: incomeTransactions = [] } = useTransactions({ type: "income", status: "pending" });
  const { data: expenseTransactions = [] } = useTransactions({ type: "expense", status: "pending" });
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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

  const totalIncome = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpense = expenseTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const TransactionCard = ({ transaction, type }: { transaction: Transaction; type: 'income' | 'expense' }) => {
    const overdue = isOverdue(transaction.due_date);
    
    return (
      <div 
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50",
          overdue && "border-amber-500/50 bg-amber-500/5"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            type === 'income' ? "bg-emerald-500/10" : "bg-rose-500/10"
          )}>
            {type === 'income' ? (
              <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowDownCircle className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{transaction.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(transaction.due_date), "dd/MM", { locale: ptBR })}
              </span>
              {transaction.category?.name && (
                <>
                  <span>•</span>
                  <span className="truncate">{transaction.category.name}</span>
                </>
              )}
              {overdue && (
                <Badge variant="outline" className="text-amber-600 border-amber-500/50 text-[10px] px-1.5 py-0">
                  <Clock className="w-2.5 h-2.5 mr-0.5" />
                  Vencido
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold whitespace-nowrap",
            type === 'income' ? "text-emerald-600" : "text-rose-600"
          )}>
            {type === 'income' ? '+' : '-'}{formatCurrency(Number(transaction.amount))}
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background">
              <DropdownMenuItem onClick={() => handleMarkAsPaid(transaction.id)}>
                <Check className="w-4 h-4 mr-2" />
                Marcar como pago
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(transaction)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => handleDelete(transaction.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">A Receber</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {incomeTransactions.length} lançamento{incomeTransactions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ArrowUpCircle className="w-8 h-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-rose-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">A Pagar</p>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpense)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {expenseTransactions.length} lançamento{expenseTransactions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-rose-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={balance >= 0 ? "border-emerald-500/30" : "border-rose-500/30"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Previsto</p>
                <p className={cn(
                  "text-2xl font-bold",
                  balance >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {formatCurrency(balance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {balance >= 0 ? 'Positivo' : 'Negativo'}
                </p>
              </div>
              <DollarSign className={cn(
                "w-8 h-8",
                balance >= 0 ? "text-emerald-500/30" : "text-rose-500/30"
              )} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Transactions Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income */}
        <Card>
          <Collapsible open={incomeExpanded} onOpenChange={setIncomeExpanded}>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Receitas Previstas
                    <Badge variant="secondary" className="ml-1">
                      {incomeTransactions.length}
                    </Badge>
                  </CardTitle>
                  {incomeExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {incomeTransactions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <ArrowUpCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma receita pendente</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2 pr-3">
                      {incomeTransactions
                        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                        .map(transaction => (
                          <TransactionCard 
                            key={transaction.id} 
                            transaction={transaction} 
                            type="income" 
                          />
                        ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Expenses */}
        <Card>
          <Collapsible open={expenseExpanded} onOpenChange={setExpenseExpanded}>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    Despesas Previstas
                    <Badge variant="secondary" className="ml-1">
                      {expenseTransactions.length}
                    </Badge>
                  </CardTitle>
                  {expenseExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {expenseTransactions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <ArrowDownCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma despesa pendente</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2 pr-3">
                      {expenseTransactions
                        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                        .map(transaction => (
                          <TransactionCard 
                            key={transaction.id} 
                            transaction={transaction} 
                            type="expense" 
                          />
                        ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </div>
  );
}
