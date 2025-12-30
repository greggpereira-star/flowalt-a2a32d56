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
      case "issued":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Emitida</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>;
      case "draft":
        return <Badge variant="secondary">Rascunho</Badge>;
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
      <div className="flex gap-4 flex-wrap">
        <Input
          placeholder="Buscar por número ou destinatário..."
          className="w-[250px]"
          value={filters.search || ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        
        <Select
          value={filters.invoice_type || "all"}
          onValueChange={(value) => setFilters({ ...filters, invoice_type: value === "all" ? undefined : value })}
        >
          <SelectTrigger className="w-[150px]">
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
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="issued">Emitidas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border">
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
                        <DropdownMenuItem onClick={() => onEdit?.(invoice)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(invoice.id)}
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
