import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput, parseCurrencyToNumber } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCostCenters, useUpdateCostCenter, CostCenter } from "@/hooks/useCostCenters";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";

const costCenterEditSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  budget_monthly: z.string().optional(),
  budget_yearly: z.string().optional(),
  parent_id: z.string().optional(),
  responsible_user_id: z.string().optional(),
});

type FormData = z.infer<typeof costCenterEditSchema>;

interface CostCenterEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter: CostCenter | null;
}

export function CostCenterEditModal({
  open,
  onOpenChange,
  costCenter,
}: CostCenterEditModalProps) {
  const updateCostCenter = useUpdateCostCenter();
  const { data: costCenters = [] } = useCostCenters();
  const { data: members = [] } = useWorkspaceMembers();

  const form = useForm<FormData>({
    resolver: zodResolver(costCenterEditSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      color: "#3B82F6",
      budget_monthly: "",
      budget_yearly: "",
      parent_id: "",
      responsible_user_id: "",
    },
  });

  useEffect(() => {
    if (costCenter) {
      form.reset({
        name: costCenter.name || "",
        code: costCenter.code || "",
        description: costCenter.description || "",
        color: costCenter.color || "#3B82F6",
        budget_monthly: costCenter.budget_monthly ? costCenter.budget_monthly.toString() : "",
        budget_yearly: costCenter.budget_yearly ? costCenter.budget_yearly.toString() : "",
        parent_id: costCenter.parent_id || "",
        responsible_user_id: costCenter.responsible_user_id || "",
      });
    }
  }, [costCenter, form]);

  const onSubmit = async (data: FormData) => {
    if (!costCenter) return;

    try {
      await updateCostCenter.mutateAsync({
        id: costCenter.id,
        name: data.name,
        code: data.code || undefined,
        description: data.description || undefined,
        color: data.color || "#3B82F6",
        budget_monthly: data.budget_monthly ? parseCurrencyToNumber(data.budget_monthly) : 0,
        budget_yearly: data.budget_yearly ? parseCurrencyToNumber(data.budget_yearly) : 0,
        parent_id: data.parent_id || undefined,
        responsible_user_id: data.responsible_user_id || null,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao atualizar centro de custo:", error);
    }
  };

  const isLoading = updateCostCenter.isPending;
  const availableParents = costCenters.filter(cc => cc.id !== costCenter?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Centro de Custo</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Marketing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: MKT-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição do centro de custo..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budget_monthly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orçamento Mensal</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value || ""} onChange={field.onChange} placeholder="0,00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget_yearly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orçamento Anual</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value || ""} onChange={field.onChange} placeholder="0,00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="responsible_user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sócio Responsável</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.profile?.full_name || member.profile?.email || "Usuário"}
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" {...field} />
                      <Input placeholder="#3B82F6" {...field} className="flex-1" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Centro de Custo Pai</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum (raiz)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (raiz)</SelectItem>
                      {availableParents.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code ? `${cc.code} - ` : ""}{cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}