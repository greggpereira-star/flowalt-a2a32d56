import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Bus, Utensils, Heart, Smile, Dumbbell, Car, Gift } from "lucide-react";
import { useCollaboratorBenefits, useUpdateBenefits } from "@/hooks/useCollaboratorPayroll";

const benefitsSchema = z.object({
  vt_enabled: z.boolean(),
  vt_value: z.string(),
  va_enabled: z.boolean(),
  va_value: z.string(),
  vr_enabled: z.boolean(),
  vr_value: z.string(),
  health_plan_enabled: z.boolean(),
  health_plan_value: z.string(),
  health_plan_employee_percentage: z.string(),
  dental_plan_enabled: z.boolean(),
  dental_plan_value: z.string(),
  gym_enabled: z.boolean(),
  gym_value: z.string(),
  parking_enabled: z.boolean(),
  parking_value: z.string(),
  bonus_enabled: z.boolean(),
  bonus_value: z.string(),
});

type FormData = z.infer<typeof benefitsSchema>;

interface BenefitsFormProps {
  collaboratorId: string;
  onSuccess?: () => void;
}

export function BenefitsForm({ collaboratorId, onSuccess }: BenefitsFormProps) {
  const { data: benefits, isLoading } = useCollaboratorBenefits(collaboratorId);
  const updateBenefits = useUpdateBenefits();

  const form = useForm<FormData>({
    resolver: zodResolver(benefitsSchema),
    defaultValues: {
      vt_enabled: false,
      vt_value: "0",
      va_enabled: false,
      va_value: "0",
      vr_enabled: false,
      vr_value: "0",
      health_plan_enabled: false,
      health_plan_value: "0",
      health_plan_employee_percentage: "0",
      dental_plan_enabled: false,
      dental_plan_value: "0",
      gym_enabled: false,
      gym_value: "0",
      parking_enabled: false,
      parking_value: "0",
      bonus_enabled: false,
      bonus_value: "0",
    },
  });

  useEffect(() => {
    if (benefits) {
      form.reset({
        vt_enabled: benefits.vt_enabled,
        vt_value: benefits.vt_value?.toString() || "0",
        va_enabled: benefits.va_enabled,
        va_value: benefits.va_value?.toString() || "0",
        vr_enabled: benefits.vr_enabled,
        vr_value: benefits.vr_value?.toString() || "0",
        health_plan_enabled: benefits.health_plan_enabled,
        health_plan_value: benefits.health_plan_value?.toString() || "0",
        health_plan_employee_percentage: benefits.health_plan_employee_percentage?.toString() || "0",
        dental_plan_enabled: benefits.dental_plan_enabled,
        dental_plan_value: benefits.dental_plan_value?.toString() || "0",
        gym_enabled: benefits.gym_enabled,
        gym_value: benefits.gym_value?.toString() || "0",
        parking_enabled: benefits.parking_enabled,
        parking_value: benefits.parking_value?.toString() || "0",
        bonus_enabled: benefits.bonus_enabled,
        bonus_value: benefits.bonus_value?.toString() || "0",
      });
    }
  }, [benefits, form]);

  const onSubmit = async (data: FormData) => {
    await updateBenefits.mutateAsync({
      collaboratorId,
      vt_enabled: data.vt_enabled,
      vt_value: parseFloat(data.vt_value) || 0,
      va_enabled: data.va_enabled,
      va_value: parseFloat(data.va_value) || 0,
      vr_enabled: data.vr_enabled,
      vr_value: parseFloat(data.vr_value) || 0,
      health_plan_enabled: data.health_plan_enabled,
      health_plan_value: parseFloat(data.health_plan_value) || 0,
      health_plan_employee_percentage: parseFloat(data.health_plan_employee_percentage) || 0,
      dental_plan_enabled: data.dental_plan_enabled,
      dental_plan_value: parseFloat(data.dental_plan_value) || 0,
      gym_enabled: data.gym_enabled,
      gym_value: parseFloat(data.gym_value) || 0,
      parking_enabled: data.parking_enabled,
      parking_value: parseFloat(data.parking_value) || 0,
      bonus_enabled: data.bonus_enabled,
      bonus_value: parseFloat(data.bonus_value) || 0,
    });
    onSuccess?.();
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  const watchVT = form.watch("vt_enabled");
  const watchVA = form.watch("va_enabled");
  const watchVR = form.watch("vr_enabled");
  const watchHealth = form.watch("health_plan_enabled");
  const watchDental = form.watch("dental_plan_enabled");
  const watchGym = form.watch("gym_enabled");
  const watchParking = form.watch("parking_enabled");
  const watchBonus = form.watch("bonus_enabled");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Vale Transporte */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bus className="w-4 h-4 text-blue-500" />
              Vale Transporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="vt_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Habilitado</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchVT && (
              <FormField
                control={form.control}
                name="vt_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor mensal (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>Desconto de 6% será aplicado no salário</FormDescription>
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Vale Alimentação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-500" />
              Vale Alimentação / Refeição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="va_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>VA</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vr_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>VR</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {watchVA && (
                <FormField
                  control={form.control}
                  name="va_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VA (R$/mês)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              {watchVR && (
                <FormField
                  control={form.control}
                  name="vr_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VR (R$/mês)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plano de Saúde */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              Plano de Saúde
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="health_plan_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Habilitado</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchHealth && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="health_plan_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor total (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="health_plan_employee_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>% desc. funcionário</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" max="100" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plano Odontológico */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smile className="w-4 h-4 text-cyan-500" />
              Plano Odontológico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="dental_plan_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Habilitado</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchDental && (
              <FormField
                control={form.control}
                name="dental_plan_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Outros Benefícios */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-500" />
              Outros Benefícios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="gym_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4" /> Academia
                      </FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchGym && (
                  <FormField
                    control={form.control}
                    name="gym_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="R$" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="parking_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2">
                        <Car className="w-4 h-4" /> Estacionamento
                      </FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchParking && (
                  <FormField
                    control={form.control}
                    name="parking_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="R$" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="bonus_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Bônus Mensal</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchBonus && (
              <FormField
                control={form.control}
                name="bonus_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do Bônus (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateBenefits.isPending}>
            {updateBenefits.isPending ? "Salvando..." : "Salvar Benefícios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
