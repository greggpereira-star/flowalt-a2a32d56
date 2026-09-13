import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link2,
  ExternalLink,
  Download,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInvoices, useDeleteInvoice, useUpdateInvoice, Invoice } from "@/hooks/useInvoices";

interface InvoiceListProps {
  onEdit?: (invoice: Invoice) => void;
  onLinkTransaction?: (invoice: Invoice) => void;
}

export function InvoiceList({ onEdit, onLinkTransaction }: InvoiceListProps) {
  const [filters, setFilters] = useState<{
    status?: string;
    invoice_type?: string;
    search?: string;
  }>({});
  const { data: invoices = [], isLoading } = useInvoices(filters);
  const deleteInvoice = useDeleteInvoice();
  const updateInvoice = useUpdateInvoice();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "emitida":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Emitida</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "cancelada":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>;
      case "substituida":
        return <Badge variant="secondary">Substituída</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "nfse":
        return <Badge variant="outline">NFS-e</Badge>;
      case "nfe":
        return <Badge variant="outline">NF-e</Badge>;
      case "nfce":
        return <Badge variant="outline">NFC-e</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta nota fiscal?")) {
      deleteInvoice.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:flex-wrap">
        <Input
          placeholder="Buscar por número ou destinatário..."
          className="w-full sm:w-[250px]"
          value={filters.search || ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />

        <div className="grid grid-cols-2 sm:flex gap-2">
          <Select
            value={filters.invoice_type || "all"}
            onValueChange={(value) => setFilters({ ...filters, invoice_type: value === "all" ? undefined : value })}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nfse">NFS-e</SelectItem>
              <SelectItem value="nfe">NF-e</SelectItem>
              <SelectItem value="nfce">NFC-e</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.status || "all"}
            onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? undefined : value })}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="emitida">Emitidas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
              <SelectItem value="substituida">Substituídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile: lista em cards — evita as 10 colunas cortadas da tabela */}
      <div className="md:hidden rounded-xl border border-border/50 divide-y divide-border/40 max-h-[65vh] overflow-y-auto overscroll-contain">
        {invoices.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            Nenhuma nota fiscal encontrada
          </div>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice.id} className="p-3 active:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm truncate">{invoice.invoice_number}</span>
                  <span className="shrink-0">{getTypeBadge(invoice.invoice_type)}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-1 -mt-1">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!invoice.transaction_id && (
                      <DropdownMenuItem onClick={() => onLinkTransaction?.(invoice)}>
                        <Link2 className="w-4 h-4 mr-2" />
                        Vincular Transação
                      </DropdownMenuItem>
                    )}
                    {invoice.pdf_url && (
                      <DropdownMenuItem asChild>
                        <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4 mr-2" />
                          Baixar PDF
                        </a>
                      </DropdownMenuItem>
                    )}
                    {invoice.xml_url && (
                      <DropdownMenuItem asChild>
                        <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Baixar XML
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(invoice)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(invoice.id)}
                      disabled={deleteInvoice.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-1.5 text-sm">
                <span className="font-medium">{invoice.recipient_name || "-"}</span>
                {invoice.recipient_document && (
                  <span className="text-muted-foreground"> · {invoice.recipient_document}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Emitida em {format(new Date(invoice.issue_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>

              <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-border/40">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor Líquido</p>
                  <p className="text-sm font-semibold text-green-600 tabular-nums truncate">
                    {formatCurrency(invoice.net_amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums truncate">
                    Bruto {formatCurrency(invoice.gross_amount)} · Impostos -{formatCurrency(invoice.tax_amount)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {getStatusBadge(invoice.status)}
                  {invoice.transaction_id ? (
                    <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-[10px]">
                      <Link2 className="w-2.5 h-2.5 mr-1" />
                      Vinculada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                      Não vinculada
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela completa */}
      <div className="hidden md:block rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Valor Bruto</TableHead>
              <TableHead>Impostos</TableHead>
              <TableHead>Valor Líquido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vinculada</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Nenhuma nota fiscal encontrada
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {invoice.invoice_number}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(invoice.invoice_type)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.recipient_name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{invoice.recipient_document}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.issue_date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{formatCurrency(invoice.gross_amount)}</TableCell>
                  <TableCell className="text-red-500">
                    -{formatCurrency(invoice.tax_amount)}
                  </TableCell>
                  <TableCell className="text-green-500 font-medium">
                    {formatCurrency(invoice.net_amount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    {invoice.transaction_id ? (
                      <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                        <Link2 className="w-3 h-3 mr-1" />
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!invoice.transaction_id && (
                          <DropdownMenuItem onClick={() => onLinkTransaction?.(invoice)}>
                            <Link2 className="w-4 h-4 mr-2" />
                            Vincular Transação
                          </DropdownMenuItem>
                        )}
                        {invoice.pdf_url && (
                          <DropdownMenuItem asChild>
                            <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4 mr-2" />
                              Baixar PDF
                            </a>
                          </DropdownMenuItem>
                        )}
                        {invoice.xml_url && (
                          <DropdownMenuItem asChild>
                            <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Baixar XML
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(invoice)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(invoice.id)}
                          disabled={deleteInvoice.isPending}
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
