import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Car, Utensils, Camera, Package, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { CurrencyInput, parseCurrencyToNumber } from "@/components/ui/currency-input";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateTransaction } from "@/hooks/useFinancial";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const expenseSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  due_date: z.date(),
  expense_type: z.string().optional(),
});

type FormData = z.infer<typeof expenseSchema>;

interface CardQuickExpenseFormProps {
  cardId: string;
  trigger?: React.ReactNode;
}

const QUICK_EXPENSE_TYPES = [
  { id: "transport", label: "Transporte", icon: Car, placeholder: "Uber, combustível..." },
  { id: "food", label: "Alimentação", icon: Utensils, placeholder: "Almoço, lanche equipe..." },
  { id: "production", label: "Produção", icon: Camera, placeholder: "Locação, equipamentos..." },
  { id: "materials", label: "Materiais", icon: Package, placeholder: "Impressões, materiais..." },
  { id: "other", label: "Outros", icon: MoreHorizontal, placeholder: "Outros gastos..." },
];

export function CardQuickExpenseForm({ cardId, trigger }: CardQuickExpenseFormProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const createTransaction = useCreateTransaction();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      amount: "",
      due_date: new Date(),
      expense_type: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const amount = parseCurrencyToNumber(data.amount);
    
    if (amount <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    try {
      await createTransaction.mutateAsync({
        description: data.description,
        amount,
        type: "expense",
        due_date: data.due_date.toISOString().split("T")[0],
        status: "paid",
        card_id: cardId,
        notes: selectedType ? `Tipo: ${QUICK_EXPENSE_TYPES.find(t => t.id === selectedType)?.label}` : undefined,
      });

      // Invalidate card financial data
      queryClient.invalidateQueries({ queryKey: ["card-financial", cardId] });
      
      toast.success("Despesa lançada com sucesso!");
      form.reset();
      setSelectedType(null);
      setOpen(false);
    } catch (error) {
      toast.error("Erro ao lançar despesa");
    }
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    const type = QUICK_EXPENSE_TYPES.find(t => t.id === typeId);
    if (type) {
      form.setValue("expense_type", typeId);
    }
  };

  const selectedTypeInfo = QUICK_EXPENSE_TYPES.find(t => t.id === selectedType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Lançar Despesa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar Despesa do Projeto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Quick Type Selection */}
            <div className="space-y-2">
              <FormLabel>Tipo de Despesa</FormLabel>
              <div className="grid grid-cols-5 gap-2">
                {QUICK_EXPENSE_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleTypeSelect(type.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                        selectedType === type.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={selectedTypeInfo?.placeholder || "Descreva a despesa..."} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
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
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTransaction.isPending}>
                {createTransaction.isPending ? "Salvando..." : "Lançar Despesa"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
