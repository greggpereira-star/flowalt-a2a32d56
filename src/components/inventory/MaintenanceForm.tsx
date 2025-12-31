import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateMaintenanceRecord } from "@/hooks/useMaintenance";
import { useInventoryItems, useInventoryUnits } from "@/hooks/useInventory";
import { CurrencyInput } from "@/components/ui/currency-input";

const formSchema = z.object({
  item_id: z.string().min(1, "Item obrigatório"),
  unit_id: z.string().optional(),
  service_date: z.string().min(1, "Data obrigatória"),
  problem_description: z.string().min(1, "Descrição do problema obrigatória"),
  solution_description: z.string().optional(),
  cost: z.number().min(0),
  vendor: z.string().optional(),
  vendor_contact: z.string().optional(),
  is_resolved: z.boolean(),
  is_warranty_claim: z.boolean(),
  new_warranty_until: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  onSuccess?: () => void;
}

export function MaintenanceForm({ onSuccess }: Props) {
  const createRecord = useCreateMaintenanceRecord();
  const { data: items = [] } = useInventoryItems();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_id: "",
      unit_id: "",
      service_date: new Date().toISOString().split('T')[0],
      problem_description: "",
      solution_description: "",
      cost: 0,
      vendor: "",
      vendor_contact: "",
      is_resolved: false,
      is_warranty_claim: false,
      new_warranty_until: "",
      notes: "",
    },
  });

  const selectedItemId = form.watch("item_id");
  const selectedItem = items.find(i => i.id === selectedItemId);
  const { data: units = [] } = useInventoryUnits(selectedItemId);
  const isWarrantyClaim = form.watch("is_warranty_claim");

  const onSubmit = async (values: FormValues) => {
    try {
      await createRecord.mutateAsync({
        item_id: values.item_id,
        unit_id: values.unit_id || undefined,
        service_date: values.service_date,
        problem_description: values.problem_description,
        solution_description: values.solution_description || undefined,
        cost: values.cost,
        vendor: values.vendor || undefined,
        vendor_contact: values.vendor_contact || undefined,
        is_resolved: values.is_resolved,
        is_warranty_claim: values.is_warranty_claim,
        new_warranty_until: values.new_warranty_until || undefined,
        notes: values.notes || undefined,
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
            name="item_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar item..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="service_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data do Serviço *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {selectedItem?.is_serialized && units.length > 0 && (
          <FormField
            control={form.control}
            name="unit_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidade</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar unidade..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.serial_number || unit.tag_qr_code || unit.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="problem_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição do Problema *</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Descreva o problema encontrado..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="solution_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Solução Aplicada</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Descreva a solução..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custo</FormLabel>
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
            name="vendor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fornecedor / Assistência</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Nome do fornecedor" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="is_warranty_claim"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel>Acionou Garantia</FormLabel>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_resolved"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel>Resolvido</FormLabel>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {isWarrantyClaim && (
          <FormField
            control={form.control}
            name="new_warranty_until"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova Garantia Até</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <Button type="submit" disabled={createRecord.isPending}>
            Registrar Manutenção
          </Button>
        </div>
      </form>
    </Form>
  );
}
