import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useInventoryItems, useInventoryUnits, MovementType } from "@/hooks/useInventory";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useCheckoutAvailability, useValidatedMovement } from "@/hooks/useStockOperations";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const formSchema = z.object({
  item_id: z.string().min(1, "Item obrigatório"),
  unit_id: z.string().optional(),
  quantity: z.number().min(1, "Quantidade mínima: 1"),
  department_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  type: MovementType;
  cardId?: string;
  onSuccess?: () => void;
}

export function MovementForm({ type, cardId, onSuccess }: Props) {
  const createMovement = useValidatedMovement();
  const { data: items = [] } = useInventoryItems();
  const { data: costCenters = [] } = useCostCenters();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_id: "",
      unit_id: "",
      quantity: 1,
      department_id: "",
      notes: "",
    },
  });

  const selectedItemId = form.watch("item_id");
  const selectedUnitId = form.watch("unit_id");
  const quantity = form.watch("quantity");
  
  const selectedItem = items.find(i => i.id === selectedItemId);
  const { data: units = [] } = useInventoryUnits(selectedItemId);
  
  // Validate checkout availability for OUT movements
  const { data: validation, isLoading: isValidating } = useCheckoutAvailability(
    type === 'OUT' ? selectedItemId : undefined,
    type === 'OUT' ? selectedUnitId : undefined,
    type === 'OUT' ? quantity : 1
  );

  // Filter available units (only in_stock for OUT)
  const availableUnits = type === 'OUT' 
    ? units.filter(u => u.current_status === 'in_stock')
    : units;

  const onSubmit = async (values: FormValues) => {
    try {
      await createMovement.mutateAsync({
        movementType: type,
        itemId: values.item_id,
        unitId: values.unit_id || undefined,
        quantity: values.quantity,
        departmentId: values.department_id || undefined,
        cardId: cardId,
        notes: values.notes,
      });
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  const showValidation = type === 'OUT' && selectedItemId && validation;
  const isValid = !showValidation || validation?.valid;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <div className="flex items-center gap-2">
                        <span>{item.code} - {item.name}</span>
                        {item.category === 'consumable' && (
                          <Badge variant="outline" className="text-xs">
                            Estoque: {item.current_stock}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedItem?.is_serialized && availableUnits.length > 0 && (
          <FormField
            control={form.control}
            name="unit_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidade (Número de Série)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar unidade..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        <div className="flex items-center gap-2">
                          <span>{unit.serial_number || unit.tag_qr_code || unit.id.slice(0, 8)}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              unit.current_status === 'in_stock' 
                                ? 'text-green-600' 
                                : unit.current_status === 'checked_out'
                                ? 'text-orange-600'
                                : 'text-red-600'
                            }
                          >
                            {unit.current_status === 'in_stock' ? 'Disponível' : 
                             unit.current_status === 'checked_out' ? 'Em uso' : 'Manutenção'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedItem?.is_serialized && availableUnits.length === 0 && type === 'OUT' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Não há unidades disponíveis para retirada deste item.
            </AlertDescription>
          </Alert>
        )}

        {!selectedItem?.is_serialized && (
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min={1}
                    {...field}
                    onChange={e => field.onChange(e.target.valueAsNumber || 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Validation feedback */}
        {showValidation && !isValidating && (
          <>
            {validation?.valid && !validation?.warning && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  {validation.message}
                  {validation.available !== undefined && (
                    <span className="block text-xs mt-1">
                      Após retirada: {validation.after_checkout} unidades restantes
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            {validation?.warning && (
              <Alert className="border-orange-500/50 bg-orange-500/10">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700">
                  {validation.message}
                  <span className="block text-xs mt-1">
                    Estoque mínimo: {validation.min_stock} | Após retirada: {validation.after_checkout}
                  </span>
                </AlertDescription>
              </Alert>
            )}
            
            {!validation?.valid && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {validation?.message}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        <FormField
          control={form.control}
          name="department_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Centro de Custo / Departamento</FormLabel>
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Motivo, destino, etc..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button 
            type="submit" 
            disabled={createMovement.isPending || !isValid || isValidating}
          >
            {createMovement.isPending ? 'Registrando...' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
