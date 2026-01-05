import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { CurrencyInput, parseCurrencyToNumber, formatCurrencyFromNumber } from "@/components/ui/currency-input";
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
import { useCollaboratorDetails, useCreateOrUpdateCollaborator } from "@/hooks/useCollaborators";

const collaboratorSchema = z.object({
  full_name: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  birth_date: z.date().optional(),
  hire_date: z.date().optional(),
  contract_type: z.string().optional(),
  bank_name: z.string().optional(),
  bank_agency: z.string().optional(),
  bank_account: z.string().optional(),
  pix_key: z.string().optional(),
  base_salary: z.string().optional(),
  partner_percentage: z.string().optional(),
  weekly_hours: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof collaboratorSchema>;

interface CollaboratorFormProps {
  memberId: string;
  onSuccess?: () => void;
}

export function CollaboratorForm({ memberId, onSuccess }: CollaboratorFormProps) {
  const { data: existingDetails, isLoading } = useCollaboratorDetails(memberId);
  const updateCollaborator = useCreateOrUpdateCollaborator();

  const form = useForm<FormData>({
    resolver: zodResolver(collaboratorSchema),
    defaultValues: {
      full_name: "",
      cpf: "",
      rg: "",
      birth_date: undefined,
      hire_date: undefined,
      contract_type: "clt",
      bank_name: "",
      bank_agency: "",
      bank_account: "",
      pix_key: "",
      base_salary: "",
      partner_percentage: "",
      weekly_hours: "40",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      state: "",
      zip: "",
      notes: "",
    },
  });

  const contractType = form.watch("contract_type");
  const isPartner = contractType === "socio";

  // Populate form when data loads
  useEffect(() => {
    if (existingDetails) {
      form.reset({
        full_name: existingDetails.full_name || "",
        cpf: existingDetails.cpf || "",
        rg: existingDetails.rg || "",
        birth_date: existingDetails.birth_date ? new Date(existingDetails.birth_date) : undefined,
        hire_date: existingDetails.hire_date ? new Date(existingDetails.hire_date) : undefined,
        contract_type: existingDetails.contract_type || "clt",
        bank_name: existingDetails.bank_name || "",
        bank_agency: existingDetails.bank_agency || "",
        bank_account: existingDetails.bank_account || "",
        pix_key: existingDetails.pix_key || "",
        base_salary: formatCurrencyFromNumber(existingDetails.base_salary || 0),
        partner_percentage: existingDetails.partner_percentage?.toString() || "",
        weekly_hours: existingDetails.weekly_hours?.toString() || "40",
        street: (existingDetails.address as any)?.street || "",
        number: (existingDetails.address as any)?.number || "",
        neighborhood: (existingDetails.address as any)?.neighborhood || "",
        city: (existingDetails.address as any)?.city || "",
        state: (existingDetails.address as any)?.state || "",
        zip: (existingDetails.address as any)?.zip || "",
        notes: existingDetails.notes || "",
      });
    }
  }, [existingDetails, form]);

  const onSubmit = async (data: FormData) => {
    const salary = data.base_salary ? parseCurrencyToNumber(data.base_salary) : null;
    const percentage = data.partner_percentage ? parseFloat(data.partner_percentage) : null;
    const hours = data.weekly_hours ? parseInt(data.weekly_hours) : null;

    await updateCollaborator.mutateAsync({
      memberId,
      full_name: data.full_name,
      cpf: data.cpf || null,
      rg: data.rg || null,
      birth_date: data.birth_date?.toISOString().split("T")[0] || null,
      hire_date: data.hire_date?.toISOString().split("T")[0] || null,
      contract_type: data.contract_type || null,
      bank_name: data.bank_name || null,
      bank_agency: data.bank_agency || null,
      bank_account: data.bank_account || null,
      pix_key: data.pix_key || null,
      base_salary: data.contract_type === "socio" ? null : salary,
      partner_percentage: data.contract_type === "socio" ? percentage : null,
      weekly_hours: hours,
      address: {
        street: data.street || "",
        number: data.number || "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || "",
      },
      notes: data.notes || null,
    });

    onSuccess?.();
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
        {/* Personal Info */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Dados Pessoais
          </h4>
          
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl>
                  <Input placeholder="Digite o nome completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input placeholder="000.000.000-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RG</FormLabel>
                  <FormControl>
                    <Input placeholder="00.000.000-0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Nascimento</FormLabel>
                  <FormControl>
                    <DateInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="DD/MM/AAAA"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hire_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Admissão</FormLabel>
                  <FormControl>
                    <DateInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="DD/MM/AAAA"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Contract Info */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Dados do Contrato
          </h4>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="contract_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Contrato</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="pj">PJ</SelectItem>
                      <SelectItem value="estagio">Estágio</SelectItem>
                      <SelectItem value="freelancer">Freelancer</SelectItem>
                      <SelectItem value="socio">Sócio</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isPartner ? (
              <FormField
                control={form.control}
                name="base_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salário Base</FormLabel>
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
            ) : (
              <FormField
                control={form.control}
                name="partner_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porcentagem (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="weekly_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horas/Semana</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="40" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Bank Info */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Dados Bancários
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="bank_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do banco" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pix_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave PIX</FormLabel>
                  <FormControl>
                    <Input placeholder="CPF, e-mail, telefone ou chave aleatória" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="bank_agency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agência</FormLabel>
                  <FormControl>
                    <Input placeholder="0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bank_account"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta</FormLabel>
                  <FormControl>
                    <Input placeholder="00000-0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Endereço
          </h4>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Rua / Logradouro</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da rua" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input placeholder="000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="neighborhood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bairro</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do bairro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da cidade" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado (UF)</FormLabel>
                  <FormControl>
                    <Input maxLength={2} placeholder="SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="zip"
            render={({ field }) => (
              <FormItem className="max-w-[200px]">
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input placeholder="00000-000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Observações
          </h4>
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    placeholder="Informações adicionais sobre o colaborador..." 
                    className="min-h-[100px]"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="submit" disabled={updateCollaborator.isPending}>
            {updateCollaborator.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
