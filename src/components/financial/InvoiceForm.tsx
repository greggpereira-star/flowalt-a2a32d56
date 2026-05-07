import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateInvoice, Invoice } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useFinancial";

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, "Número é obrigatório"),
  invoice_type: z.enum(["nfse", "nfe", "nfce"]),
  invoice_series: z.string().optional(),
  issue_date: z.date(),
  due_date: z.date().optional(),
  recipient_name: z.string().optional(),
  recipient_document: z.string().optional(),
  recipient_email: z.string().email().optional().or(z.literal("")),
  gross_amount: z.string().min(1, "Valor bruto é obrigatório"),
  tax_amount: z.string().optional(),
  service_code: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["pendente", "emitida", "cancelada", "substituida"]),
  client_id: z.string().optional(),
  transaction_id: z.string().optional(),
});

type FormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  invoice?: Invoice;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function InvoiceForm({ 
  invoice, 
  onSuccess, 
  open: controlledOpen, 
  onOpenChange: setControlledOpen,
  showTrigger = true
}: InvoiceFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const createInvoice = useCreateInvoice();
  const { data: clients = [] } = useClients();
  const { data: transactions = [] } = useTransactions({ status: "paid" });

  const form = useForm<FormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_number: invoice?.invoice_number || "",
      invoice_type: (invoice?.invoice_type as any) || "nfse",
      invoice_series: invoice?.invoice_series || "",
      issue_date: invoice?.issue_date ? new Date(invoice.issue_date) : new Date(),
      due_date: invoice?.due_date ? new Date(invoice.due_date) : undefined,
      recipient_name: invoice?.recipient_name || "",
      recipient_document: invoice?.recipient_document || "",
      recipient_email: invoice?.recipient_email || "",
      gross_amount: invoice?.gross_amount?.toString() || "",
      tax_amount: invoice?.tax_amount?.toString() || "0",
      service_code: invoice?.service_code || "",
      description: invoice?.description || "",
      status: (invoice?.status as any) || "pendente",
      client_id: invoice?.client_id || "",
      transaction_id: invoice?.transaction_id || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const grossAmount = parseFloat(data.gross_amount.replace(/[^\d,.-]/g, "").replace(",", "."));
    const taxAmount = data.tax_amount ? parseFloat(data.tax_amount.replace(/[^\d,.-]/g, "").replace(",", ".")) : 0;

    await createInvoice.mutateAsync({
      invoice_number: data.invoice_number,
      invoice_type: data.invoice_type,
      invoice_series: data.invoice_series || null,
      issue_date: data.issue_date.toISOString().split("T")[0],
      recipient_name: data.recipient_name || null,
      recipient_document: data.recipient_document || null,
      recipient_email: data.recipient_email || null,
      gross_amount: grossAmount,
      tax_amount: taxAmount,
      net_amount: grossAmount - taxAmount,
      service_code: data.service_code || null,
      description: data.description || null,
      status: data.status,
      client_id: data.client_id || null,
      transaction_id: data.transaction_id || null,
    });

    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nova Nota Fiscal
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {invoice ? "Editar" : "Nova"} Nota Fiscal
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 001234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="nfse">NFS-e (Serviço)</SelectItem>
                        <SelectItem value="nfe">NF-e (Produto)</SelectItem>
                        <SelectItem value="nfce">NFC-e (Consumidor)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_series"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Série</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Emissão</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecione</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="emitida">Emitida</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                        <SelectItem value="substituida">Substituída</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Destinatário</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipient_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome/Razão Social</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient_document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente Vinculado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Valores</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="gross_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Bruto</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="R$ 0,00"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^\d,.-]/g, "");
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tax_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Impostos</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="R$ 0,00"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^\d,.-]/g, "");
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="service_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Serviço</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 1.07" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Serviço</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição detalhada do serviço..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transaction_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincular a Transação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional - vincular a um lançamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {transactions.map((tx) => (
                        <SelectItem key={tx.id} value={tx.id}>
                          {tx.description} - R$ {tx.amount.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
