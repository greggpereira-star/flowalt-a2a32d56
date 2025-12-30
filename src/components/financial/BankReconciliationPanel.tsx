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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { useInvoices, Invoice } from "@/hooks/useInvoices";
import { useTransactions, Transaction } from "@/hooks/useFinancial";

interface ReconciliationMatch {
  invoice: Invoice;
  transaction: Transaction | null;
  confidence: number;
  status: "matched" | "pending" | "unmatched";
}

export function BankReconciliationPanel() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const { data: invoices = [] } = useInvoices();
  const { data: transactions = [] } = useTransactions();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Simple matching algorithm
  const findMatches = (): ReconciliationMatch[] => {
    return invoices.map((invoice) => {
      // Find transaction with similar amount and close date
      const potentialMatch = transactions.find((tx) => {
        const amountMatch = Math.abs(tx.amount - invoice.net_amount) < 0.01;
        const dateClose = Math.abs(
          new Date(tx.due_date).getTime() - new Date(invoice.issue_date).getTime()
        ) < 7 * 24 * 60 * 60 * 1000; // 7 days
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

  const matches = findMatches();
  const matchedCount = matches.filter((m) => m.status === "matched").length;
  const pendingCount = matches.filter((m) => m.status === "pending").length;
  const unmatchedCount = matches.filter((m) => m.status === "unmatched").length;
  const reconciliationRate = invoices.length > 0 ? (matchedCount / invoices.length) * 100 : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matched":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Conciliado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><HelpCircle className="w-3 h-3 mr-1" /> Sugerido</Badge>;
      case "unmatched":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
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
            Vincule notas fiscais às transações para manter integridade fiscal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Importar OFX
          </Button>
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Stats */}
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
            <span>{matchedCount} de {invoices.length} notas conciliadas</span>
            {unmatchedCount > 0 && (
              <span className="text-orange-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {unmatchedCount} pendentes de conciliação
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens para Conciliação</CardTitle>
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
                {matches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma nota fiscal para conciliar
                    </TableCell>
                  </TableRow>
                ) : (
                  matches.map((match) => (
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
                        <Link2 className={`w-4 h-4 mx-auto ${match.transaction ? "text-green-500" : "text-muted-foreground"}`} />
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
                          <span className="font-medium">{formatCurrency(match.transaction.amount)}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {match.confidence > 0 ? (
                          <Badge variant="outline" className={match.confidence >= 80 ? "text-green-500" : "text-yellow-500"}>
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
    </div>
  );
}
