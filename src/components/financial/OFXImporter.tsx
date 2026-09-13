import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseBankStatement, OFXStatement, OFXTransaction } from "@/lib/ofxParser";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface ImportedTransaction extends OFXTransaction {
  selected: boolean;
  matchStatus: "matched" | "partial" | "new";
  matchedTransactionId?: string;
}

export function OFXImporter() {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statement, setStatement] = useState<OFXStatement | null>(null);
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatement(null);
    setTransactions([]);

    try {
      const content = await file.text();
      const result = parseBankStatement(content, file.name);

      if (!result.success || !result.statement) {
        toast.error(result.error || "Erro ao processar arquivo");
        setIsProcessing(false);
        return;
      }

      setStatement(result.statement);

      // O casamento era feito com DUAS consultas por linha do extrato, todas
      // disparadas de uma vez pelo Promise.all. Um extrato mensal comum tem de
      // 100 a 300 lançamentos, ou seja, 200 a 600 requisições simultâneas —
      // suficiente para esgotar o pool de conexões. Agora são duas consultas
      // no total, cobrindo o extrato inteiro, e o casamento roda em memória.
      const linhas = result.statement.transactions;
      const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;

      const idsExternos = linhas.map((t) => t.id).filter(Boolean);
      const datas = linhas.map((t) => t.date.getTime());
      const inicioJanela = new Date(Math.min(...datas) - TRES_DIAS);
      const fimJanela = new Date(Math.max(...datas) + TRES_DIAS);

      const [conciliacoesRes, candidatasRes] = await Promise.all([
        idsExternos.length > 0
          ? supabase
              .from("bank_reconciliations")
              .select("id, transaction_id, status, external_id")
              .eq("workspace_id", currentWorkspace?.id)
              .in("external_id", idsExternos)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("transactions")
          .select("id, description, amount, due_date")
          .eq("workspace_id", currentWorkspace?.id)
          .gte("due_date", format(inicioJanela, "yyyy-MM-dd"))
          .lte("due_date", format(fimJanela, "yyyy-MM-dd")),
      ]);

      const conciliacaoPorExternalId = new Map(
        (conciliacoesRes.data ?? []).map((r: any) => [r.external_id, r])
      );

      const importedTransactions: ImportedTransaction[] = linhas.map((txn) => {
        const jaConciliada = conciliacaoPorExternalId.get(txn.id);
        if (jaConciliada) {
          return {
            ...txn,
            selected: false,
            matchStatus: "matched" as const,
            matchedTransactionId: jaConciliada.transaction_id || undefined,
          };
        }

        // Mesmo critério de antes: mesmo valor, vencimento a até 3 dias.
        const candidata = (candidatasRes.data ?? []).find((t: any) => {
          if (Number(t.amount) !== Number(txn.amount)) return false;
          const venc = new Date(t.due_date + "T00:00:00").getTime();
          return Math.abs(venc - txn.date.getTime()) <= TRES_DIAS;
        });

        if (candidata) {
          return {
            ...txn,
            selected: true,
            matchStatus: "partial" as const,
            matchedTransactionId: candidata.id,
          };
        }

        return {
          ...txn,
          selected: true,
          matchStatus: "new" as const,
        };
      });

      setTransactions(importedTransactions);
      toast.success(`${importedTransactions.length} transações encontradas`);
    } catch (error) {
      toast.error("Erro ao ler arquivo");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, [currentWorkspace?.id]);

  const toggleTransaction = (id: string) => {
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const toggleAll = (selected: boolean) => {
    setTransactions(prev =>
      prev.map(t => (t.matchStatus !== "matched" ? { ...t, selected } : t))
    );
  };

  const handleImport = async () => {
    if (!currentWorkspace?.id || !statement) return;

    const selectedTransactions = transactions.filter(t => t.selected);
    if (selectedTransactions.length === 0) {
      toast.error("Selecione pelo menos uma transação para importar");
      return;
    }

    setIsProcessing(true);
    setImportProgress(0);

    try {
      // O retorno do insert era descartado. Como o supabase-js NÃO lança em
      // erro de insert (devolve { error }), uma linha recusada — por
      // external_id duplicado numa reimportação, por exemplo — falhava em
      // silêncio e mesmo assim o toast anunciava tudo importado.
      let gravadas = 0;
      const falhas: string[] = [];

      for (let i = 0; i < selectedTransactions.length; i++) {
        const txn = selectedTransactions[i];

        const { error: insertError } = await supabase.from("bank_reconciliations").insert({
          workspace_id: currentWorkspace.id,
          external_id: txn.id,
          bank_name: statement.bankId || "Importação OFX",
          bank_account_id: statement.accountId,
          bank_statement_date: format(txn.date, "yyyy-MM-dd"),
          bank_statement_amount: txn.type === "credit" ? txn.amount : -txn.amount,
          bank_statement_type: txn.type,
          bank_statement_description: txn.description,
          status: txn.matchStatus === "partial" ? "pending" : "unmatched",
          transaction_id: txn.matchedTransactionId || null,
          match_confidence: txn.matchStatus === "partial" ? 0.8 : null,
          match_reason: txn.matchStatus === "partial" ? "Correspondência por valor e data" : null,
          source: "ofx_import",
        });

        if (insertError) {
          falhas.push(txn.description || txn.id);
          console.error("Falha ao importar lançamento do OFX:", insertError);
        } else {
          gravadas++;
        }

        setImportProgress(((i + 1) / selectedTransactions.length) * 100);
      }

      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });

      if (gravadas === 0) {
        toast.error("Nenhum lançamento foi importado. Verifique se o extrato já havia sido importado antes.");
        return;
      }

      if (falhas.length > 0) {
        toast.warning(
          `${gravadas} de ${selectedTransactions.length} lançamentos importados. ${falhas.length} não puderam ser gravados (possível reimportação).`
        );
      } else {
        toast.success(`${gravadas} transações importadas com sucesso!`);
      }

      setOpen(false);
      setStatement(null);
      setTransactions([]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao importar transações");
    } finally {
      setIsProcessing(false);
      setImportProgress(0);
    }
  };

  const getStatusBadge = (status: ImportedTransaction["matchStatus"]) => {
    switch (status) {
      case "matched":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Já importada
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1">
            <AlertTriangle className="w-3 h-3" />
            Possível correspondência
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <FileText className="w-3 h-3" />
            Nova
          </Badge>
        );
    }
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const newCount = transactions.filter(t => t.matchStatus === "new").length;
  const partialCount = transactions.filter(t => t.matchStatus === "partial").length;
  const matchedCount = transactions.filter(t => t.matchStatus === "matched").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full lg:w-auto justify-center gap-2 text-xs sm:text-sm px-2 lg:h-10">
          <Upload className="w-4 h-4 shrink-0" />
          <span className="truncate">Importar OFX</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Extrato Bancário</DialogTitle>
          <DialogDescription>
            Importe arquivos OFX ou OFC do seu banco para conciliação automática
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* File Upload */}
          {!statement && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <input
                  type="file"
                  accept=".ofx,.ofc"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="ofx-upload"
                  disabled={isProcessing}
                />
                <label
                  htmlFor="ofx-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  {isProcessing ? (
                    <Loader2 className="w-12 h-12 text-muted-foreground animate-spin mb-4" />
                  ) : (
                    <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                  )}
                  <span className="text-lg font-medium">
                    {isProcessing ? "Processando..." : "Arraste ou clique para selecionar"}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Arquivos OFX ou OFC do seu banco
                  </span>
                </label>
              </CardContent>
            </Card>
          )}

          {/* Statement Info */}
          {statement && (
            <>
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {statement.bankId || "Banco"} - Conta {statement.accountId}
                      </CardTitle>
                      <CardDescription>
                        Período: {format(statement.startDate, "dd/MM/yyyy", { locale: ptBR })} a{" "}
                        {format(statement.endDate, "dd/MM/yyyy", { locale: ptBR })}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Saldo</div>
                      <div className="font-semibold">{formatCurrency(statement.balance)}</div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <span>{transactions.length} transações encontradas:</span>
                <Badge variant="secondary">{newCount} novas</Badge>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                  {partialCount} possíveis correspondências
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                  {matchedCount} já importadas
                </Badge>
              </div>

              {/* Transactions Table */}
              <Card className="flex-1 overflow-hidden">
                <CardHeader className="py-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={selectedCount === transactions.filter(t => t.matchStatus !== "matched").length}
                        onCheckedChange={(checked) => toggleAll(!!checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedCount} selecionada(s)
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatement(null);
                        setTransactions([]);
                      }}
                    >
                      Novo arquivo
                    </Button>
                  </div>
                </CardHeader>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow
                          key={txn.id}
                          className={txn.matchStatus === "matched" ? "opacity-50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={txn.selected}
                              disabled={txn.matchStatus === "matched"}
                              onCheckedChange={() => toggleTransaction(txn.id)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(txn.date, "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {txn.description}
                          </TableCell>
                          <TableCell>{getStatusBadge(txn.matchStatus)}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              txn.type === "credit" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {txn.type === "credit" ? "+" : "-"}
                            {formatCurrency(txn.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>

              {/* Import Progress */}
              {isProcessing && importProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importando...</span>
                    <span>{Math.round(importProgress)}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isProcessing || selectedCount === 0}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Importar {selectedCount} transação(ões)
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
