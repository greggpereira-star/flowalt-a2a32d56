import { useState, useCallback } from "react";
import { 
  Upload, 
  FileText, 
  Check, 
  X, 
  AlertCircle, 
  FileUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  DollarSign,
  Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  useXMLFileParser, 
  useImportInvoiceXML, 
  ParsedNFe 
} from "@/hooks/useInvoiceXMLParser";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface ImportedItem {
  invoice: ParsedNFe;
  status: "pending" | "importing" | "success" | "error";
  error?: string;
}

export function InvoiceXMLImporter() {
  const [open, setOpen] = useState(false);
  const [importedItems, setImportedItems] = useState<ImportedItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  const { parsing, parsedInvoices, errors, parseFiles, clearParsed } = useXMLFileParser();
  const importInvoice = useImportInvoiceXML();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const { parsed } = await parseFiles(e.dataTransfer.files);
      setImportedItems(parsed.map(invoice => ({ invoice, status: "pending" })));
    }
  }, [parseFiles]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const { parsed } = await parseFiles(e.target.files);
      setImportedItems(parsed.map(invoice => ({ invoice, status: "pending" })));
    }
  }, [parseFiles]);

  const handleImportAll = useCallback(async () => {
    for (let i = 0; i < importedItems.length; i++) {
      const item = importedItems[i];
      if (item.status !== "pending") continue;

      setImportedItems(prev => 
        prev.map((it, idx) => idx === i ? { ...it, status: "importing" } : it)
      );

      try {
        await importInvoice.mutateAsync(item.invoice);
        setImportedItems(prev => 
          prev.map((it, idx) => idx === i ? { ...it, status: "success" } : it)
        );
      } catch (error) {
        setImportedItems(prev => 
          prev.map((it, idx) => idx === i ? { 
            ...it, 
            status: "error", 
            error: error instanceof Error ? error.message : "Erro desconhecido" 
          } : it)
        );
      }
    }
  }, [importedItems, importInvoice]);

  const handleImportSingle = useCallback(async (index: number) => {
    const item = importedItems[index];
    if (item.status !== "pending") return;

    setImportedItems(prev => 
      prev.map((it, idx) => idx === index ? { ...it, status: "importing" } : it)
    );

    try {
      await importInvoice.mutateAsync(item.invoice);
      setImportedItems(prev => 
        prev.map((it, idx) => idx === index ? { ...it, status: "success" } : it)
      );
    } catch (error) {
      setImportedItems(prev => 
        prev.map((it, idx) => idx === index ? { 
          ...it, 
          status: "error", 
          error: error instanceof Error ? error.message : "Erro desconhecido" 
        } : it)
      );
    }
  }, [importedItems, importInvoice]);

  const handleRemoveItem = useCallback((index: number) => {
    setImportedItems(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    clearParsed();
    setImportedItems([]);
  }, [clearParsed]);

  const pendingCount = importedItems.filter(i => i.status === "pending").length;
  const successCount = importedItems.filter(i => i.status === "success").length;
  const errorCount = importedItems.filter(i => i.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Importar XML
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5" />
            Importar Notas Fiscais (XML)
          </DialogTitle>
          <DialogDescription>
            Arraste arquivos XML de NF-e ou NFS-e para importar automaticamente
          </DialogDescription>
        </DialogHeader>

        {/* Drop Zone */}
        {importedItems.length === 0 && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {parsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-muted-foreground">Processando arquivos...</p>
              </div>
            ) : (
              <>
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-1">
                  Arraste arquivos XML aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou clique para selecionar
                </p>
                <input
                  type="file"
                  accept=".xml"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="xml-upload"
                />
                <label htmlFor="xml-upload">
                  <Button variant="secondary" className="cursor-pointer" asChild>
                    <span>Selecionar Arquivos</span>
                  </Button>
                </label>
              </>
            )}
          </div>
        )}

        {/* Parse Errors - Enhanced UX */}
        {errors.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-destructive mb-2">
                  {errors.length === 1 ? "Erro ao processar arquivo" : `${errors.length} erros ao processar`}
                </div>
                <ul className="text-sm space-y-2">
                  {errors.map((error, i) => {
                    // Parse error message to extract file name and error type
                    const colonIndex = error.indexOf(":");
                    const fileName = colonIndex > 0 ? error.substring(0, colonIndex) : "Arquivo";
                    const errorMessage = colonIndex > 0 ? error.substring(colonIndex + 1).trim() : error;
                    
                    // Provide helpful hints based on error type
                    let hint = "";
                    if (errorMessage.includes("não reconhecido") || errorMessage.includes("NF-e") || errorMessage.includes("NFS-e")) {
                      hint = "Verifique se o arquivo é um XML válido de Nota Fiscal Eletrônica.";
                    } else if (errorMessage.includes("namespace") || errorMessage.includes("getElementsByTagName")) {
                      hint = "O formato do XML pode não ser compatível. Entre em contato com o suporte.";
                    } else if (errorMessage.includes("número da nota") || errorMessage.includes("nNF") || errorMessage.includes("Numero")) {
                      hint = "O XML não contém o número da nota fiscal. Verifique se o arquivo está completo.";
                    }

                    return (
                      <li key={i} className="bg-background/50 rounded-md p-2 border border-destructive/10">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-destructive/70 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-destructive/90 truncate" title={fileName}>
                              {fileName}
                            </div>
                            <div className="text-muted-foreground text-xs mt-0.5">
                              {errorMessage}
                            </div>
                            {hint && (
                              <div className="text-muted-foreground/70 text-xs mt-1 italic">
                                💡 {hint}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Formatos suportados: NF-e (modelo 55), NFS-e (diversos padrões municipais), NFC-e
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Parsed Invoices List */}
        {importedItems.length > 0 && (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1">
                  <FileText className="w-3 h-3" />
                  {importedItems.length} notas
                </Badge>
                {successCount > 0 && (
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/5 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    {successCount} importadas
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="outline" className="gap-1 border-rose-500/30 bg-rose-500/5 text-rose-600">
                    <XCircle className="w-3 h-3" />
                    {errorCount} erros
                  </Badge>
                )}
              </div>
              
              {pendingCount > 0 && (
                <Button onClick={handleImportAll} className="gap-2">
                  <Check className="w-4 h-4" />
                  Importar Todas ({pendingCount})
                </Button>
              )}
            </div>

            <Separator />

            {/* Invoice Cards */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-3 py-2">
                {importedItems.map((item, index) => (
                  <Card 
                    key={index} 
                    className={cn(
                      "border transition-colors",
                      item.status === "success" && "border-emerald-500/30 bg-emerald-500/5",
                      item.status === "error" && "border-rose-500/30 bg-rose-500/5",
                      item.status === "importing" && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.invoice.invoiceType.toUpperCase()}
                            </Badge>
                            <span className="font-medium">
                              Nº {item.invoice.invoiceNumber}
                              {item.invoice.series && ` - Série ${item.invoice.series}`}
                            </span>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Building2 className="w-3.5 h-3.5" />
                              <span className="truncate">{item.invoice.recipient.name || "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>
                                {format(new Date(item.invoice.issueDate), "dd/MM/yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="font-medium">
                                {formatCurrency(item.invoice.netAmount)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Hash className="w-3.5 h-3.5" />
                              <span className="text-xs truncate">
                                {item.invoice.accessKey || "Sem chave"}
                              </span>
                            </div>
                          </div>

                          {/* Error Message */}
                          {item.status === "error" && item.error && (
                            <p className="text-xs text-rose-600 mt-2">
                              ⚠️ {item.error}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {item.status === "pending" && (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => handleImportSingle(index)}
                              >
                                Importar
                              </Button>
                            </>
                          )}
                          {item.status === "importing" && (
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          )}
                          {item.status === "success" && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          )}
                          {item.status === "error" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleImportSingle(index)}
                            >
                              Tentar novamente
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
              {successCount === importedItems.length && importedItems.length > 0 && (
                <Button onClick={handleClose} className="gap-2">
                  <Check className="w-4 h-4" />
                  Concluído
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
