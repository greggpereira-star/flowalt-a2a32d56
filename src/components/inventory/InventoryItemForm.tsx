import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useCreateInventoryItem, useUpdateInventoryItem, InventoryItem } from "@/hooks/useInventory";
import { useCostCenters } from "@/hooks/useCostCenters";
import { CurrencyInput } from "@/components/ui/currency-input";
import { 
  Package, 
  DollarSign, 
  TrendingDown, 
  Shield, 
  FileText,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState("identification");

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
  const showDepreciationFields = isAsset;

  // Check tab completion status
  const getTabStatus = (tab: string) => {
    const values = form.getValues();
    switch (tab) {
      case "identification":
        return values.code && values.name ? "complete" : "required";
      case "costs":
        return values.purchase_value ? "complete" : "optional";
      case "depreciation":
        return values.useful_life_months ? "complete" : "optional";
      case "warranty":
        return values.warranty_end_date ? "complete" : "optional";
      case "notes":
        return values.notes ? "complete" : "optional";
      default:
        return "optional";
    }
  };

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

  const TabIndicator = ({ status }: { status: string }) => {
    if (status === "complete") {
      return <CheckCircle2 className="h-3 w-3 text-success" />;
    }
    if (status === "required") {
      return <AlertCircle className="h-3 w-3 text-warning" />;
    }
    return null;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger 
              value="identification" 
              className="flex flex-col gap-1 py-2 px-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <div className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                <TabIndicator status={getTabStatus("identification")} />
              </div>
              <span className="hidden sm:inline">Identificação</span>
            </TabsTrigger>
            <TabsTrigger 
              value="costs" 
              className="flex flex-col gap-1 py-2 px-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <div className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                <TabIndicator status={getTabStatus("costs")} />
              </div>
              <span className="hidden sm:inline">Custos</span>
            </TabsTrigger>
            {showDepreciationFields && (
              <TabsTrigger 
                value="depreciation" 
                className="flex flex-col gap-1 py-2 px-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  <TabIndicator status={getTabStatus("depreciation")} />
                </div>
                <span className="hidden sm:inline">Depreciação</span>
              </TabsTrigger>
            )}
            {showWarrantyFields && (
              <TabsTrigger 
                value="warranty" 
                className="flex flex-col gap-1 py-2 px-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <div className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  <TabIndicator status={getTabStatus("warranty")} />
                </div>
                <span className="hidden sm:inline">Garantia</span>
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="notes" 
              className="flex flex-col gap-1 py-2 px-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <div className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                <TabIndicator status={getTabStatus("notes")} />
              </div>
              <span className="hidden sm:inline">Notas</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Identificação */}
          <TabsContent value="identification" className="space-y-4 mt-4">
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

            <FormField
              control={form.control}
              name="is_serialized"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">Item Serializado</FormLabel>
                    <FormDescription className="text-xs">
                      Cada unidade tem número de série único
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setActiveTab("costs")}>
                Próximo →
              </Button>
            </div>
          </TabsContent>

          {/* Tab: Custos & Estoque */}
          <TabsContent value="costs" className="space-y-4 mt-4">
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
                    <FormDescription className="text-xs">
                      Alerta quando o estoque ficar abaixo deste valor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setActiveTab("identification")}>
                ← Anterior
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setActiveTab(showDepreciationFields ? "depreciation" : showWarrantyFields ? "warranty" : "notes")}
              >
                Próximo →
              </Button>
            </div>
          </TabsContent>

          {/* Tab: Depreciação (condicional) */}
          {showDepreciationFields && (
            <TabsContent value="depreciation" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground mb-4">
                  Configure a depreciação para calcular automaticamente o valor contábil do ativo ao longo do tempo.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
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
                        <FormDescription className="text-xs">
                          Período de depreciação
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                        <FormDescription className="text-xs">
                          Valor ao fim da vida útil
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setActiveTab("costs")}>
                  ← Anterior
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setActiveTab(showWarrantyFields ? "warranty" : "notes")}
                >
                  Próximo →
                </Button>
              </div>
            </TabsContent>
          )}

          {/* Tab: Garantia (condicional) */}
          {showWarrantyFields && (
            <TabsContent value="warranty" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground mb-4">
                  Registre informações de garantia para acompanhar prazos e condições.
                </p>

                <div className="space-y-4">
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
              </div>

              <div className="flex justify-between">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setActiveTab(showDepreciationFields ? "depreciation" : "costs")}
                >
                  ← Anterior
                </Button>
                <Button type="button" variant="outline" onClick={() => setActiveTab("notes")}>
                  Próximo →
                </Button>
              </div>
            </TabsContent>
          )}

          {/* Tab: Notas */}
          <TabsContent value="notes" className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Observações adicionais, instruções de uso, localização..."
                      className="min-h-[120px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setActiveTab(showWarrantyFields ? "warranty" : showDepreciationFields ? "depreciation" : "costs")}
              >
                ← Anterior
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Submit Button - Always visible */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
            {item ? "Salvar Alterações" : "Criar Item"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
