import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateInventoryItem, useUpdateInventoryItem, InventoryItem } from "@/hooks/useInventory";
import { useCostCenters } from "@/hooks/useCostCenters";
import { CurrencyInput } from "@/components/ui/currency-input";

const formSchema = z.object({
  code: z.string().min(1, "Código obrigatório"),
  name: z.string().min(1, "Nome obrigatório"),
  category: z.enum(["consumable", "equipment", "asset"]),
  manufacturer_model: z.string().optional(),
  department_id: z.string().optional(),
  status_condition: z.enum(["good", "fair", "defective", "maintenance"]),
  min_stock: z.number().optional(),
  is_serialized: z.boolean(),
  purchase_date: z.string().optional(),
  purchase_value: z.number().optional(),
  residual_value: z.number().optional(),
  useful_life_months: z.number().optional(),
  notes: z.string().optional(),
  // Campos de garantia (para itens serializados ou únicos)
  warranty_start_date: z.string().optional(),
  warranty_end_date: z.string().optional(),
  warranty_provider: z.string().optional(),
  warranty_terms_url: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  item?: InventoryItem;
  onSuccess?: () => void;
}

export function InventoryItemForm({ item, onSuccess }: Props) {
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const { data: costCenters = [] } = useCostCenters();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: item?.code || "",
      name: item?.name || "",
      category: item?.category || "equipment",
      manufacturer_model: item?.manufacturer_model || "",
      department_id: item?.department_id || "",
      status_condition: item?.status_condition || "good",
      min_stock: item?.min_stock || undefined,
      is_serialized: item?.is_serialized || false,
      purchase_date: item?.purchase_date || "",
      purchase_value: item?.purchase_value || undefined,
      residual_value: item?.residual_value || undefined,
      useful_life_months: item?.useful_life_months || undefined,
      notes: item?.notes || "",
      warranty_start_date: "",
      warranty_end_date: "",
      warranty_provider: "",
      warranty_terms_url: "",
    },
  });

  const watchCategory = form.watch("category");
  const watchIsSerialized = form.watch("is_serialized");
  const isAsset = watchCategory === "asset";
  const isConsumable = watchCategory === "consumable";
  const showWarrantyFields = watchIsSerialized || watchCategory === "equipment" || watchCategory === "asset";

  const onSubmit = async (values: FormValues) => {
    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, ...values });
      } else {
        await createItem.mutateAsync(values);
      }
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
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="EQP-001" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="consumable">Consumível</SelectItem>
                    <SelectItem value="equipment">Equipamento</SelectItem>
                    <SelectItem value="asset">Patrimônio</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Nome do item" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="manufacturer_model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fabricante / Modelo</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ex: Canon EOS R5" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
            name="status_condition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="good">Bom</SelectItem>
                    <SelectItem value="fair">Regular</SelectItem>
                    <SelectItem value="defective">Defeito</SelectItem>
                    <SelectItem value="maintenance">Em Manutenção</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isConsumable && (
          <FormField
            control={form.control}
            name="min_stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estoque Mínimo</FormLabel>
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
        )}

        <FormField
          control={form.control}
          name="is_serialized"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel>Item Serializado</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Cada unidade tem número de série único
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="purchase_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Compra</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="purchase_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor de Compra</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value || 0}
                    onChange={field.onChange}
                    placeholder="0,00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isAsset && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="residual_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Residual</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || 0}
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
              name="useful_life_months"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vida Útil (meses)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field}
                      onChange={e => field.onChange(e.target.valueAsNumber || undefined)}
                      placeholder="60" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {showWarrantyFields && (
          <div className="space-y-4 rounded-lg border p-4">
            <h4 className="font-medium text-sm">Garantia</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="warranty_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início da Garantia</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warranty_end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim da Garantia</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="warranty_provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor da Garantia</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do fornecedor ou fabricante" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="warranty_terms_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link dos Termos</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Observações adicionais..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
            {item ? "Salvar" : "Criar Item"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
