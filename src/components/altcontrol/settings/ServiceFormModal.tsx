import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AltControlService, AltControlLevel, useCreateService, useUpdateService, useAltControlLevels } from '@/hooks/useAltControl';

const serviceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  display_order: z.coerce.number().min(1, 'Ordem deve ser maior que 0'),
  is_active: z.boolean(),
  service_type: z.enum(['strategy', 'recurring', 'project']),
  requires_minimum_level: z.boolean(),
  minimum_level_id: z.string().optional().nullable(),
  suggested_min_hours: z.coerce.number().min(0).optional().nullable(),
  suggested_max_hours: z.coerce.number().min(0).optional().nullable(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: AltControlService | null;
}

const SERVICE_TYPE_LABELS = {
  strategy: 'Estratégia',
  recurring: 'Recorrência',
  project: 'Projeto',
};

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ open, onOpenChange, service }) => {
  const createService = useCreateService();
  const updateService = useUpdateService();
  const { data: levels } = useAltControlLevels();
  const isEditing = !!service;

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name || '',
      description: service?.description || '',
      display_order: service?.display_order || 1,
      is_active: service?.is_active ?? true,
      service_type: (service?.service_type as 'strategy' | 'recurring' | 'project') || 'recurring',
      requires_minimum_level: service?.requires_minimum_level || false,
      minimum_level_id: service?.minimum_level_id || null,
      suggested_min_hours: service?.suggested_min_hours || null,
      suggested_max_hours: service?.suggested_max_hours || null,
    },
  });

  const requiresMinLevel = form.watch('requires_minimum_level');

  React.useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        description: service.description || '',
        display_order: service.display_order,
        is_active: service.is_active,
        service_type: service.service_type as 'strategy' | 'recurring' | 'project',
        requires_minimum_level: service.requires_minimum_level,
        minimum_level_id: service.minimum_level_id || null,
        suggested_min_hours: service.suggested_min_hours || null,
        suggested_max_hours: service.suggested_max_hours || null,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        display_order: 1,
        is_active: true,
        service_type: 'recurring',
        requires_minimum_level: false,
        minimum_level_id: null,
        suggested_min_hours: null,
        suggested_max_hours: null,
      });
    }
  }, [service, form]);

  const onSubmit = async (data: ServiceFormData) => {
    try {
      if (isEditing && service) {
        await updateService.mutateAsync({ 
          id: service.id, 
          name: data.name,
          description: data.description,
          display_order: data.display_order,
          is_active: data.is_active,
          service_type: data.service_type,
          requires_minimum_level: data.requires_minimum_level,
          minimum_level_id: data.requires_minimum_level ? data.minimum_level_id : null,
          suggested_min_hours: data.suggested_min_hours || null,
          suggested_max_hours: data.suggested_max_hours || null,
        });
      } else {
        await createService.mutateAsync({
          name: data.name,
          description: data.description,
          display_order: data.display_order,
          is_active: data.is_active,
          service_type: data.service_type,
          requires_minimum_level: data.requires_minimum_level,
          minimum_level_id: data.requires_minimum_level ? data.minimum_level_id : undefined,
          suggested_min_hours: data.suggested_min_hours || undefined,
          suggested_max_hours: data.suggested_max_hours || undefined,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          <DialogDescription>
            Configure os parâmetros do serviço
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Serviço</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Social Media" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrição curta do serviço..." 
                      className="resize-none"
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
              <FormField
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Serviço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Faixa de Horas Sugerida</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="suggested_min_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mínimo Sugerido</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0} 
                          placeholder="Opcional"
                          {...field} 
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="suggested_max_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máximo Sugerido</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0} 
                          placeholder="Opcional"
                          {...field} 
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="requires_minimum_level"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Exige Nível Mínimo</FormLabel>
                    <FormDescription>
                      Este serviço só está disponível a partir de um nível específico
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {requiresMinLevel && (
              <FormField
                control={form.control}
                name="minimum_level_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível Mínimo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o nível mínimo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {levels?.filter(l => l.is_active).map(level => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name} ({level.min_hours}h - {level.max_hours}h)
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
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Serviço Ativo</FormLabel>
                    <FormDescription>
                      Serviços inativos não aparecem no orçamentador
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createService.isPending || updateService.isPending}>
                {isEditing ? 'Salvar Alterações' : 'Criar Serviço'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
