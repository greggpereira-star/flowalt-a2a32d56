import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateSubscription } from "@/hooks/useSubscriptions";
import { useCostCenters } from "@/hooks/useCostCenters";
import { CurrencyInput } from "@/components/ui/currency-input";
import { addMonths, addYears, format } from "date-fns";

const formSchema = z.object({
  vendor: z.string().min(1, "Fornecedor obrigatório"),
  product_name: z.string().min(1, "Produto obrigatório"),
  plan: z.string().optional(),
  billing_cycle: z.enum(["monthly", "yearly", "custom"]),
  renewal_date: z.string().min(1, "Data de renovação obrigatória"),
  auto_renew: z.boolean(),
  seats_total: z.number().optional(),
  seats_used: z.number().optional(),
  cost_per_cycle: z.number().min(0),
  payment_method: z.string().optional(),
  department_id: z.string().optional(),
  cancellation_terms_url: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  onSuccess?: () => void;
}

export function SubscriptionForm({ onSuccess }: Props) {
  const createSubscription = useCreateSubscription();
  const { data: costCenters = [] } = useCostCenters();

  const defaultRenewal = format(addMonths(new Date(), 1), 'yyyy-MM-dd');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendor: "",
      product_name: "",
      plan: "",
      billing_cycle: "monthly",
      renewal_date: defaultRenewal,
      auto_renew: true,
      seats_total: undefined,
      seats_used: undefined,
      cost_per_cycle: 0,
      payment_method: "",
      department_id: "",
      cancellation_terms_url: "",
    },
  });

  const billingCycle = form.watch("billing_cycle");

  const onSubmit = async (values: FormValues) => {
    try {
      await createSubscription.mutateAsync({
        vendor: values.vendor,
        product_name: values.product_name,
        plan: values.plan || undefined,
        billing_cycle: values.billing_cycle,
        renewal_date: values.renewal_date,
        auto_renew: values.auto_renew,
        seats_total: values.seats_total || undefined,
        seats_used: values.seats_used || 0,
        cost_per_cycle: values.cost_per_cycle,
        payment_method: values.payment_method || undefined,
        department_id: values.department_id || undefined,
        cancellation_terms_url: values.cancellation_terms_url || undefined,
      });
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vendor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fornecedor *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Adobe, Microsoft" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="product_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produto *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Creative Cloud, Office 365" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="plan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plano</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Pro, Enterprise" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="billing_cycle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciclo de Cobrança *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cost_per_cycle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custo por Ciclo *</FormLabel>
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
            name="renewal_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Renovação *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="seats_total"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total de Licenças (Seats)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field}
                    onChange={e => field.onChange(e.target.valueAsNumber || undefined)}
                    placeholder="10" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="seats_used"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Licenças em Uso</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field}
                    onChange={e => field.onChange(e.target.valueAsNumber || undefined)}
                    placeholder="5" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="department_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Centro de Custo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Método de Pagamento</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Cartão, Boleto, etc." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="auto_renew"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel>Renovação Automática</FormLabel>
                <p className="text-sm text-muted-foreground">
                  A licença será renovada automaticamente
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cancellation_terms_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL dos Termos de Cancelamento</FormLabel>
              <FormControl>
                <Input {...field} placeholder="https://..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={createSubscription.isPending}>
            Criar Licença
          </Button>
        </div>
      </form>
    </Form>
  );
}
