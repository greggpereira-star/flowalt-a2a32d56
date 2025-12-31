import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FolderTree,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCostCenters, useCostCentersWithBudget, useCreateCostCenter, useDeleteCostCenter, CostCenter, CostCenterWithActual } from "@/hooks/useCostCenters";

const costCenterSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  budget_monthly: z.string().optional(),
  budget_yearly: z.string().optional(),
  parent_id: z.string().optional(),
});

type FormData = z.infer<typeof costCenterSchema>;

export function CostCenterManager() {
  const [open, setOpen] = useState(false);
  const { data: costCenters = [] } = useCostCenters();
  const { data: centersWithBudget = [] } = useCostCentersWithBudget();
  const createCostCenter = useCreateCostCenter();
  const deleteCostCenter = useDeleteCostCenter();

  const form = useForm<FormData>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      color: "#3B82F6",
      budget_monthly: "",
      budget_yearly: "",
      parent_id: "",
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const onSubmit = async (data: FormData) => {
    await createCostCenter.mutateAsync({
      name: data.name,
      code: data.code || null,
      description: data.description || null,
      color: data.color || null,
      budget_monthly: data.budget_monthly ? parseCurrencyToNumber(data.budget_monthly) : null,
      budget_yearly: data.budget_yearly ? parseCurrencyToNumber(data.budget_yearly) : null,
      parent_id: data.parent_id || null,
    });

    form.reset();
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este centro de custo?")) {
      deleteCostCenter.mutate(id);
    }
  };

  const getBudgetStatus = (spent: number, budget: number) => {
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return { color: "bg-red-500", status: "Excedido", icon: TrendingUp };
    if (percentage >= 80) return { color: "bg-yellow-500", status: "Atenção", icon: AlertTriangle };
    return { color: "bg-green-500", status: "OK", icon: TrendingDown };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderTree className="w-5 h-5" />
            Centros de Custo
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie centros de custo e controle orçamentos
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Centro de Custo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Centro de Custo</DialogTitle>
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
                          <CurrencyInput value={field.value} onChange={field.onChange} placeholder="0,00" />
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
                          <CurrencyInput value={field.value} onChange={field.onChange} placeholder="0,00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum (raiz)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhum (raiz)</SelectItem>
                          {costCenters.map((cc) => (
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
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createCostCenter.isPending}>
                    {createCostCenter.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {centersWithBudget.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum centro de custo cadastrado
            </CardContent>
          </Card>
        ) : (
          centersWithBudget.map((center) => {
            const budgetUsed = center.budget_monthly && center.actual_spent 
              ? (center.actual_spent / center.budget_monthly) * 100 
              : 0;
            const budgetStatus = center.budget_monthly 
              ? getBudgetStatus(center.actual_spent || 0, center.budget_monthly)
              : null;

            return (
              <Card key={center.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: center.color || "#3B82F6" }}
                      />
                      <CardTitle className="text-base">{center.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(center.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {center.code && (
                    <Badge variant="outline" className="w-fit text-xs">
                      {center.code}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {center.description && (
                    <p className="text-sm text-muted-foreground">{center.description}</p>
                  )}

                  {center.budget_monthly && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Orçamento Mensal</span>
                        <span className="font-medium">{formatCurrency(center.budget_monthly)}</span>
                      </div>
                      <Progress value={Math.min(budgetUsed, 100)} className="h-2" />
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Gasto: {formatCurrency(center.actual_spent || 0)}
                        </span>
                        {budgetStatus && (
                          <Badge className={`${budgetStatus.color} text-white`}>
                            {budgetStatus.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {!center.budget_monthly && (
                    <p className="text-xs text-muted-foreground">Sem orçamento definido</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
