import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AltControlLevel, useCreateLevel, useUpdateLevel } from '@/hooks/useAltControl';

const levelSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  display_order: z.coerce.number().min(1, 'Ordem deve ser maior que 0'),
  min_hours: z.coerce.number().min(0, 'Mínimo de horas deve ser positivo'),
  max_hours: z.coerce.number().min(1, 'Máximo de horas deve ser maior que 0'),
  min_cost_per_hour: z.coerce.number().min(0, 'Custo mínimo deve ser positivo'),
  max_cost_per_hour: z.coerce.number().min(0, 'Custo máximo deve ser positivo'),
  min_monthly_price: z.coerce.number().min(0, 'Preço mínimo deve ser positivo'),
  max_monthly_price: z.coerce.number().min(0, 'Preço máximo deve ser positivo'),
  target_margin_percent: z.coerce.number().min(0).max(100, 'Margem deve estar entre 0 e 100'),
  requires_reinforced_approval: z.boolean(),
  block_pdf_before_approval: z.boolean(),
  is_active: z.boolean(),
}).refine(data => data.max_hours >= data.min_hours, {
  message: 'Máximo de horas deve ser maior ou igual ao mínimo',
  path: ['max_hours'],
}).refine(data => data.max_cost_per_hour >= data.min_cost_per_hour, {
  message: 'Custo máximo deve ser maior ou igual ao mínimo',
  path: ['max_cost_per_hour'],
}).refine(data => data.max_monthly_price >= data.min_monthly_price, {
  message: 'Preço máximo deve ser maior ou igual ao mínimo',
  path: ['max_monthly_price'],
});

type LevelFormData = z.infer<typeof levelSchema>;

interface LevelFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level?: AltControlLevel | null;
}

export const LevelFormModal: React.FC<LevelFormModalProps> = ({ open, onOpenChange, level }) => {
  const createLevel = useCreateLevel();
  const updateLevel = useUpdateLevel();
  const isEditing = !!level;

  const form = useForm<LevelFormData>({
    resolver: zodResolver(levelSchema),
    defaultValues: {
      name: level?.name || '',
      display_order: level?.display_order || 1,
      min_hours: level?.min_hours || 0,
      max_hours: level?.max_hours || 40,
      min_cost_per_hour: level?.min_cost_per_hour || 0,
      max_cost_per_hour: level?.max_cost_per_hour || 0,
      min_monthly_price: level?.min_monthly_price || 0,
      max_monthly_price: level?.max_monthly_price || 0,
      target_margin_percent: level?.target_margin_percent || 30,
      requires_reinforced_approval: level?.requires_reinforced_approval || false,
      block_pdf_before_approval: level?.block_pdf_before_approval ?? true,
      is_active: level?.is_active ?? true,
    },
  });

  React.useEffect(() => {
    if (level) {
      form.reset({
        name: level.name,
        display_order: level.display_order,
        min_hours: level.min_hours,
        max_hours: level.max_hours,
        min_cost_per_hour: level.min_cost_per_hour,
        max_cost_per_hour: level.max_cost_per_hour,
        min_monthly_price: level.min_monthly_price,
        max_monthly_price: level.max_monthly_price,
        target_margin_percent: level.target_margin_percent,
        requires_reinforced_approval: level.requires_reinforced_approval,
        block_pdf_before_approval: level.block_pdf_before_approval,
        is_active: level.is_active,
      });
    } else {
      form.reset({
        name: '',
        display_order: 1,
        min_hours: 0,
        max_hours: 40,
        min_cost_per_hour: 0,
        max_cost_per_hour: 0,
        min_monthly_price: 0,
        max_monthly_price: 0,
        target_margin_percent: 30,
        requires_reinforced_approval: false,
        block_pdf_before_approval: true,
        is_active: true,
      });
    }
  }, [level, form]);

  const onSubmit = async (data: LevelFormData) => {
    try {
      if (isEditing && level) {
        await updateLevel.mutateAsync({ id: level.id, ...data });
      } else {
        await createLevel.mutateAsync({
          name: data.name,
          display_order: data.display_order,
          min_hours: data.min_hours,
          max_hours: data.max_hours,
          min_cost_per_hour: data.min_cost_per_hour,
          max_cost_per_hour: data.max_cost_per_hour,
          min_monthly_price: data.min_monthly_price,
          max_monthly_price: data.max_monthly_price,
          target_margin_percent: data.target_margin_percent,
          requires_reinforced_approval: data.requires_reinforced_approval,
          block_pdf_before_approval: data.block_pdf_before_approval,
          is_active: data.is_active,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Nível' : 'Novo Nível'}</DialogTitle>
          <DialogDescription>
            Configure os parâmetros do nível de precificação
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Nível</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: N1 - Básico" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de Exibição</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Faixa de Horas</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mínimo de Horas</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máximo de Horas</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Custo por Hora (R$/h)</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_cost_per_hour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custo Mínimo</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={0.01} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_cost_per_hour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custo Máximo</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={0.01} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Preço Mensal (R$/mês)</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_monthly_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço Mínimo</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={0.01} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_monthly_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço Máximo</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={0.01} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="target_margin_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta de Margem (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} step={1} {...field} />
                  </FormControl>
                  <FormDescription>
                    Margem mínima esperada para este nível
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Configurações de Aprovação</h4>
              <FormField
                control={form.control}
                name="requires_reinforced_approval"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Aprovação Reforçada</FormLabel>
                      <FormDescription>
                        Exigir aprovador sênior ou múltiplos aprovadores
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="block_pdf_before_approval"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Bloquear PDF antes de aprovado</FormLabel>
                      <FormDescription>
                        PDF só pode ser gerado após aprovação
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Nível Ativo</FormLabel>
                      <FormDescription>
                        Níveis inativos não aparecem no orçamentador
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createLevel.isPending || updateLevel.isPending}>
                {isEditing ? 'Salvar Alterações' : 'Criar Nível'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
