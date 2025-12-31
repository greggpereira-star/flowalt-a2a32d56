import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCardFinancialData } from "@/hooks/useCardFinancial";
import { cn } from "@/lib/utils";
import { CardQuickExpenseForm } from "./CardQuickExpenseForm";
import { CardQuickIncomeForm } from "./CardQuickIncomeForm";

interface CardFinancialTabProps {
  cardId: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function CardFinancialTab({ cardId }: CardFinancialTabProps) {
  const { data, isLoading } = useCardFinancialData(cardId);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data || (data.transactions.length === 0 && data.invoices.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Receipt className="w-12 h-12 mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground mb-1">Nenhum lançamento financeiro</p>
        <p className="text-xs text-muted-foreground/70 mb-4">
          Lance despesas de campanha como transporte, alimentação, produção...
        </p>
        <div className="flex gap-2">
          <CardQuickExpenseForm cardId={cardId} />
          <CardQuickIncomeForm cardId={cardId} />
        </div>
      </div>
    );
  }

  const { summary, transactions, invoices, timeEntries } = data;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Receita</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(summary.totalIncome)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-medium">Despesas</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(summary.totalExpenses)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Custo M.O.</span>
              </div>
              <p className="text-lg font-bold">{formatCurrency(summary.laborCost)}</p>
              <p className="text-xs text-muted-foreground">{summary.totalHours.toFixed(1)}h trabalhadas</p>
            </CardContent>
          </Card>

          <Card className={cn(
            "bg-gradient-to-br border",
            summary.profit >= 0
              ? "from-primary/10 to-primary/5 border-primary/20"
              : "from-rose-500/10 to-rose-500/5 border-rose-500/20"
          )}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={cn(
                  "w-4 h-4",
                  summary.profit >= 0 ? "text-primary" : "text-rose-600"
                )} />
                <span className="text-xs font-medium">Lucro</span>
              </div>
              <p className={cn(
                "text-lg font-bold",
                summary.profit >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatCurrency(summary.profit)}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs mt-1",
                  summary.profitMargin >= 30
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : summary.profitMargin >= 10
                      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                )}
              >
                {summary.profitMargin.toFixed(1)}% margem
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
              Transações Vinculadas
            </h4>
            <Badge variant="secondary">{transactions.length}</Badge>
          </div>
          
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma transação vinculada
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      transaction.type === "income"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    )}>
                      {transaction.type === "income" ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "font-medium",
                    transaction.type === "income" ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(Number(transaction.amount))}
                  </span>
                </div>
              ))}
              {transactions.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                  Ver mais {transactions.length - 5} transações
                </Button>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Invoices */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Notas Fiscais
            </h4>
            <Badge variant="secondary">{invoices.length}</Badge>
          </div>

          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma nota fiscal vinculada
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        NF {invoice.invoice_number}
                        {invoice.invoice_series && `-${invoice.invoice_series}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(invoice.issue_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(Number(invoice.gross_amount))}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-2 text-xs",
                        invoice.status === "emitida"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : invoice.status === "cancelada"
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      )}
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <CardQuickExpenseForm 
            cardId={cardId} 
            trigger={
              <Button variant="outline" size="sm" className="flex-1 gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                Despesa
              </Button>
            }
          />
          <CardQuickIncomeForm 
            cardId={cardId}
            trigger={
              <Button variant="outline" size="sm" className="flex-1 gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Receita
              </Button>
            }
          />
        </div>
      </div>
    </ScrollArea>
  );
}
