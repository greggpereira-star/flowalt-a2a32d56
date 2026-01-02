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
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Building, CreditCard, FileText } from "lucide-react";
import {
  useCreateExternalCollaborator,
  useUpdateExternalCollaborator,
  useExternalCollaborator,
  ExternalCollaboratorInput,
} from "@/hooks/useExternalCollaborators";

const formSchema = z.object({
  full_name: z.string().min(2, "Nome é obrigatório"),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  birth_date: z.string().optional(),
  hire_date: z.string().optional(),
  termination_date: z.string().optional(),
  contract_type: z.string().optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
  bank_name: z.string().optional(),
  bank_agency: z.string().optional(),
  bank_account: z.string().optional(),
  pix_key: z.string().optional(),
  base_salary: z.string().optional(),
  weekly_hours: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_zip: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
  emergency_relationship: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ExternalCollaboratorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaboratorId?: string | null;
}

export function ExternalCollaboratorFormModal({
  open,
  onOpenChange,
  collaboratorId,
}: ExternalCollaboratorFormModalProps) {
  const { data: collaborator, isLoading: loadingCollaborator } = useExternalCollaborator(
    collaboratorId || ""
  );
  const createCollaborator = useCreateExternalCollaborator();
  const updateCollaborator = useUpdateExternalCollaborator();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      cpf: "",
      rg: "",
      birth_date: "",
      hire_date: "",
      termination_date: "",
      contract_type: "clt",
      job_title: "",
      department: "",
      bank_name: "",
      bank_agency: "",
      bank_account: "",
      pix_key: "",
      base_salary: "",
      weekly_hours: "40",
      phone: "",
      email: "",
      notes: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      emergency_name: "",
      emergency_phone: "",
      emergency_relationship: "",
    },
  });

  // Reset form when collaborator data is loaded
  useEffect(() => {
    if (collaborator) {
      form.reset({
        full_name: collaborator.full_name || "",
        cpf: collaborator.cpf || "",
        rg: collaborator.rg || "",
        birth_date: collaborator.birth_date || "",
        hire_date: collaborator.hire_date || "",
        termination_date: collaborator.termination_date || "",
        contract_type: collaborator.contract_type || "clt",
        job_title: collaborator.job_title || "",
        department: collaborator.department || "",
        bank_name: collaborator.bank_name || "",
        bank_agency: collaborator.bank_agency || "",
        bank_account: collaborator.bank_account || "",
        pix_key: collaborator.pix_key || "",
        base_salary: collaborator.base_salary?.toString() || "",
        weekly_hours: collaborator.weekly_hours?.toString() || "40",
        phone: collaborator.phone || "",
        email: collaborator.email || "",
        notes: collaborator.notes || "",
        address_street: collaborator.address?.street || "",
        address_number: collaborator.address?.number || "",
        address_complement: collaborator.address?.complement || "",
        address_neighborhood: collaborator.address?.neighborhood || "",
        address_city: collaborator.address?.city || "",
        address_state: collaborator.address?.state || "",
        address_zip: collaborator.address?.zip || "",
        emergency_name: collaborator.emergency_contact?.name || "",
        emergency_phone: collaborator.emergency_contact?.phone || "",
        emergency_relationship: collaborator.emergency_contact?.relationship || "",
      });
    } else if (!collaboratorId) {
      form.reset({
        full_name: "",
        cpf: "",
        rg: "",
        birth_date: "",
        hire_date: "",
        termination_date: "",
        contract_type: "clt",
        job_title: "",
        department: "",
        bank_name: "",
        bank_agency: "",
        bank_account: "",
        pix_key: "",
        base_salary: "",
        weekly_hours: "40",
        phone: "",
        email: "",
        notes: "",
        address_street: "",
        address_number: "",
        address_complement: "",
        address_neighborhood: "",
        address_city: "",
        address_state: "",
        address_zip: "",
        emergency_name: "",
        emergency_phone: "",
        emergency_relationship: "",
      });
    }
  }, [collaborator, collaboratorId, form]);

  const parseCurrency = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
  };

  const onSubmit = async (data: FormData) => {
    const input: ExternalCollaboratorInput = {
      full_name: data.full_name,
      cpf: data.cpf || undefined,
      rg: data.rg || undefined,
      birth_date: data.birth_date || undefined,
      hire_date: data.hire_date || undefined,
      termination_date: data.termination_date || undefined,
      contract_type: data.contract_type || "clt",
      job_title: data.job_title || undefined,
      department: data.department || undefined,
      bank_name: data.bank_name || undefined,
      bank_agency: data.bank_agency || undefined,
      bank_account: data.bank_account || undefined,
      pix_key: data.pix_key || undefined,
      base_salary: parseCurrency(data.base_salary || "0"),
      weekly_hours: parseInt(data.weekly_hours || "40"),
      phone: data.phone || undefined,
      email: data.email || undefined,
      notes: data.notes || undefined,
      address: {
        street: data.address_street || undefined,
        number: data.address_number || undefined,
        complement: data.address_complement || undefined,
        neighborhood: data.address_neighborhood || undefined,
        city: data.address_city || undefined,
        state: data.address_state || undefined,
        zip: data.address_zip || undefined,
      },
      emergency_contact: {
        name: data.emergency_name || undefined,
        phone: data.emergency_phone || undefined,
        relationship: data.emergency_relationship || undefined,
      },
    };

    try {
      if (collaboratorId) {
        await updateCollaborator.mutateAsync({ id: collaboratorId, ...input });
      } else {
        await createCollaborator.mutateAsync(input);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createCollaborator.isPending || updateCollaborator.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {collaboratorId ? "Editar Colaborador" : "Novo Colaborador Externo"}
          </DialogTitle>
        </DialogHeader>

        {loadingCollaborator && collaboratorId ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal" className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span className="hidden sm:inline">Pessoal</span>
                  </TabsTrigger>
                  <TabsTrigger value="contract" className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span className="hidden sm:inline">Contrato</span>
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    <span className="hidden sm:inline">Banco</span>
                  </TabsTrigger>
                  <TabsTrigger value="address" className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    <span className="hidden sm:inline">Endereço</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do colaborador" {...field} />
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
                            <Input placeholder="RG" {...field} />
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
                        <FormItem>
                          <FormLabel>Data de Nascimento</FormLabel>
                          <FormControl>
                            <DateInput 
                              value={field.value ? new Date(field.value) : undefined}
                              onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : "")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="email@exemplo.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Contato de Emergência</p>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="emergency_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergency_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input placeholder="Telefone" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergency_relationship"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parentesco</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Mãe" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contract" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="job_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Faxineira" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Administrativo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contract_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Contrato</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="clt">CLT</SelectItem>
                              <SelectItem value="pj">PJ</SelectItem>
                              <SelectItem value="freelancer">Freelancer</SelectItem>
                              <SelectItem value="terceirizado">Terceirizado</SelectItem>
                              <SelectItem value="estagiario">Estagiário</SelectItem>
                              <SelectItem value="temporario">Temporário</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hire_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Admissão</FormLabel>
                          <FormControl>
                            <DateInput 
                              value={field.value ? new Date(field.value) : undefined}
                              onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : "")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="termination_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Demissão</FormLabel>
                          <FormControl>
                            <DateInput 
                              value={field.value ? new Date(field.value) : undefined}
                              onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : "")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                            placeholder="R$ 0,00"
                          />
                        </FormControl>
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
                          <Textarea
                            placeholder="Observações sobre o colaborador..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="bank" className="space-y-4 mt-4">
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

                  <FormField
                    control={form.control}
                    name="pix_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave PIX</FormLabel>
                        <FormControl>
                          <Input placeholder="CPF, Email, Telefone ou Aleatória" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="address" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="address_zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input placeholder="00000-000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name="address_street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input placeholder="Rua" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="address_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address_complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto, Bloco, etc." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Bairro" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[
                              "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
                              "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
                              "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
                            ].map((uf) => (
                              <SelectItem key={uf} value={uf}>
                                {uf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {collaboratorId ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
