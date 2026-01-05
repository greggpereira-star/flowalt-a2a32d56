import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Pencil,
  DollarSign,
  FileText,
  Clock,
  Building,
  Calendar,
  TrendingUp,
  AlertCircle,
  Gift,
  Wallet,
  Umbrella,
  BarChart3,
  Plus,
  UserPlus,
  Users,
  Trash2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCollaborators, useSalaryHistory, useGenerateSalaryTransactions, CollaboratorDetails } from "@/hooks/useCollaborators";
import { useExternalCollaborators, useDeleteExternalCollaborator, ExternalCollaborator } from "@/hooks/useExternalCollaborators";
import { CollaboratorForm } from "./CollaboratorForm";
import { ExternalCollaboratorFormModal } from "./ExternalCollaboratorFormModal";
import { BenefitsForm } from "./BenefitsForm";
import { PayrollDashboard } from "./PayrollDashboard";
import { VacationManager } from "./VacationManager";
import { CollaboratorAnalytics } from "./CollaboratorAnalytics";

export function CollaboratorManager() {
  const { data: collaborators = [], isLoading } = useCollaborators();
  const { data: externalCollaborators = [], isLoading: loadingExternal } = useExternalCollaborators();
  const deleteExternalCollaborator = useDeleteExternalCollaborator();
  const [selectedCollaborator, setSelectedCollaborator] = useState<CollaboratorDetails | null>(null);
  const [selectedExternalCollaborator, setSelectedExternalCollaborator] = useState<ExternalCollaborator | null>(null);
  const [editingCollaborator, setEditingCollaborator] = useState<string | null>(null);
  const [externalFormOpen, setExternalFormOpen] = useState(false);
  const [editingExternalId, setEditingExternalId] = useState<string | null>(null);
  const [deleteExternalId, setDeleteExternalId] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState("list");
  const [listSubTab, setListSubTab] = useState<"members" | "external">("members");
  const generateSalaries = useGenerateSalaryTransactions();

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Check for expiring documents
  const getExpiringDocuments = (docs: CollaboratorDetails["documents"]) => {
    if (!docs || !Array.isArray(docs)) return [];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return docs.filter(doc => {
      const docTyped = doc as { name?: string; url?: string; expiry_date?: string };
      if (!docTyped.expiry_date) return false;
      return new Date(docTyped.expiry_date) <= thirtyDaysFromNow;
    });
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Gestão de Colaboradores</h2>
        <Button 
          onClick={() => generateSalaries.mutate(new Date())}
          disabled={generateSalaries.isPending}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          {generateSalaries.isPending ? "Gerando..." : "Gerar Salários do Mês"}
        </Button>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Colaboradores</span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Folha</span>
          </TabsTrigger>
          <TabsTrigger value="benefits" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            <span className="hidden sm:inline">Benefícios</span>
          </TabsTrigger>
          <TabsTrigger value="vacations" className="flex items-center gap-2">
            <Umbrella className="w-4 h-4" />
            <span className="hidden sm:inline">Férias</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Collaborators List Tab */}
        <TabsContent value="list" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Membros c/ Acesso
                </CardTitle>
                <Users className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{collaborators.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Colaboradores Externos
                </CardTitle>
                <UserPlus className="w-5 h-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{externalCollaborators.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Folha Mensal Total
                </CardTitle>
                <DollarSign className="w-5 h-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    collaborators.filter(c => c?.contract_type !== "socio").reduce((acc, c) => acc + (c?.base_salary || 0), 0) +
                    externalCollaborators.filter(c => c?.contract_type !== "socio").reduce((acc, c) => acc + (c?.base_salary || 0), 0)
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Docs Vencendo
                </CardTitle>
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-500">
                  {collaborators.reduce((acc, c) => acc + getExpiringDocuments(c?.documents).length, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sub tabs for members vs external */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={listSubTab === "members" ? "default" : "outline"}
                size="sm"
                onClick={() => setListSubTab("members")}
              >
                <Users className="w-4 h-4 mr-2" />
                Membros ({collaborators.length})
              </Button>
              <Button
                variant={listSubTab === "external" ? "default" : "outline"}
                size="sm"
                onClick={() => setListSubTab("external")}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Externos ({externalCollaborators.length})
              </Button>
            </div>
            {listSubTab === "external" && (
              <Button onClick={() => { setEditingExternalId(null); setExternalFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Colaborador
              </Button>
            )}
          </div>

          {/* Members List */}
          {listSubTab === "members" && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cargo/Depto</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Salário</TableHead>
                      <TableHead>Horas/Sem</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collaborators.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum colaborador com acesso ao sistema
                        </TableCell>
                      </TableRow>
                    ) : (
                      collaborators.map((collab) => {
                        const expiringDocs = getExpiringDocuments(collab?.documents);
                        return (
                          <TableRow
                            key={collab?.member?.id || collab?.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedCollaborator(collab)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={collab?.member?.profile?.avatar_url || ""} />
                                  <AvatarFallback>
                                    {getInitials(collab?.full_name || collab?.member?.profile?.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {collab?.full_name || collab?.member?.profile?.full_name || "Sem nome"}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {collab?.member?.profile?.email}
                                  </p>
                                </div>
                                {expiringDocs.length > 0 && (
                                  <Badge variant="outline" className="text-orange-500 border-orange-500">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    {expiringDocs.length} doc(s)
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{collab?.member?.function_title || "-"}</p>
                                <p className="text-sm text-muted-foreground">
                                  {collab?.member?.department || "-"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {collab?.contract_type?.toUpperCase() || "CLT"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {collab?.contract_type === "socio" 
                                ? `${collab?.partner_percentage || 0}%`
                                : formatCurrency(collab?.base_salary)}
                            </TableCell>
                            <TableCell>{collab?.weekly_hours || 40}h</TableCell>
                            <TableCell>
                              {collab?.hire_date
                                ? format(new Date(collab.hire_date), "dd/MM/yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCollaborator(collab?.member?.id || null);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* External Collaborators List */}
          {listSubTab === "external" && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cargo/Depto</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Salário</TableHead>
                      <TableHead>Horas/Sem</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingExternal ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : externalCollaborators.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum colaborador externo cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      externalCollaborators.map((collab) => (
                        <TableRow
                          key={collab.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedExternalCollaborator(collab)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback>
                                  {getInitials(collab.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{collab.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {collab.email || collab.phone || "Sem contato"}
                                </p>
                              </div>
                              {!collab.is_active && (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{collab.job_title || "-"}</p>
                              <p className="text-sm text-muted-foreground">
                                {collab.department || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {collab.contract_type?.toUpperCase() || "CLT"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {collab.contract_type === "socio" 
                              ? `${(collab as any).partner_percentage || 0}%`
                              : formatCurrency(collab.base_salary)}
                          </TableCell>
                          <TableCell>{collab.weekly_hours || 40}h</TableCell>
                          <TableCell>
                            {collab.hire_date
                              ? format(new Date(collab.hire_date), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingExternalId(collab.id);
                                  setExternalFormOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteExternalId(collab.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll">
          <PayrollDashboard />
        </TabsContent>

        {/* Benefits Tab */}
        <TabsContent value="benefits">
          <BenefitsForm />
        </TabsContent>

        {/* Vacations Tab */}
        <TabsContent value="vacations">
          <VacationManager />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <CollaboratorAnalytics />
        </TabsContent>
      </Tabs>

      {/* Collaborator Detail Sheet */}
      <Sheet open={!!selectedCollaborator} onOpenChange={() => setSelectedCollaborator(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedCollaborator && (
            <CollaboratorDetailView
              collaborator={selectedCollaborator}
              onEdit={() => {
                setEditingCollaborator(selectedCollaborator.member?.id || null);
                setSelectedCollaborator(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Form Sheet */}
      <Sheet open={!!editingCollaborator} onOpenChange={() => setEditingCollaborator(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Colaborador</SheetTitle>
          </SheetHeader>
          {editingCollaborator && (
            <CollaboratorForm
              memberId={editingCollaborator}
              onSuccess={() => setEditingCollaborator(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* External Collaborator Form Modal */}
      <ExternalCollaboratorFormModal
        open={externalFormOpen}
        onOpenChange={(open) => {
          setExternalFormOpen(open);
          if (!open) setEditingExternalId(null);
        }}
        collaboratorId={editingExternalId}
      />

      {/* External Collaborator Detail Sheet */}
      <Sheet 
        open={!!selectedExternalCollaborator} 
        onOpenChange={() => setSelectedExternalCollaborator(null)}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedExternalCollaborator && (
            <ExternalCollaboratorDetailView
              collaborator={selectedExternalCollaborator}
              onEdit={() => {
                setEditingExternalId(selectedExternalCollaborator.id);
                setExternalFormOpen(true);
                setSelectedExternalCollaborator(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteExternalId} onOpenChange={() => setDeleteExternalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteExternalId) {
                  deleteExternalCollaborator.mutate(deleteExternalId);
                  setDeleteExternalId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CollaboratorDetailView({
  collaborator,
  onEdit,
}: {
  collaborator: CollaboratorDetails;
  onEdit: () => void;
}) {
  const { data: salaryHistory = [] } = useSalaryHistory(collaborator.id || "");

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16">
          <AvatarImage src={collaborator.member?.profile?.avatar_url || ""} />
          <AvatarFallback className="text-lg">
            {getInitials(collaborator.full_name || collaborator.member?.profile?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">
            {collaborator.full_name || collaborator.member?.profile?.full_name}
          </h3>
          <p className="text-muted-foreground">{collaborator.member?.profile?.email}</p>
          <div className="flex gap-2 mt-2">
            <Badge>{collaborator.member?.function_title || "Sem cargo"}</Badge>
            <Badge variant="outline">{collaborator.contract_type?.toUpperCase() || "CLT"}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
          <TabsTrigger value="salary" className="flex-1">Salário</TabsTrigger>
          <TabsTrigger value="docs" className="flex-1">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">CPF</p>
              <p className="font-medium">{collaborator.cpf || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">RG</p>
              <p className="font-medium">{collaborator.rg || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data de Nascimento</p>
              <p className="font-medium">
                {collaborator.birth_date
                  ? format(new Date(collaborator.birth_date), "dd/MM/yyyy")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admissão</p>
              <p className="font-medium">
                {collaborator.hire_date
                  ? format(new Date(collaborator.hire_date), "dd/MM/yyyy")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Horas/Semana</p>
              <p className="font-medium">{collaborator.weekly_hours || 40}h</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Departamento</p>
              <p className="font-medium">{collaborator.member?.department || "-"}</p>
            </div>
          </div>

          {collaborator.address && Object.keys(collaborator.address).length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Building className="w-4 h-4" />
                Endereço
              </h4>
              <div className="text-sm bg-muted p-3 rounded-md">
                <p>{collaborator.address.street}, {collaborator.address.number}</p>
                <p>{collaborator.address.neighborhood} - {collaborator.address.city}/{collaborator.address.state}</p>
                <p>CEP: {collaborator.address.zip}</p>
              </div>
            </div>
          )}

          {collaborator.pix_key && (
            <div>
              <h4 className="font-medium mb-2">Dados Bancários</h4>
              <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                {collaborator.bank_name && <p>Banco: {collaborator.bank_name}</p>}
                {collaborator.bank_agency && <p>Agência: {collaborator.bank_agency}</p>}
                {collaborator.bank_account && <p>Conta: {collaborator.bank_account}</p>}
                <p>PIX: {collaborator.pix_key}</p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="salary" className="space-y-4 mt-4">
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">
                {collaborator.contract_type === "socio" ? "Participação Societária" : "Salário Atual"}
              </p>
              <p className="text-2xl font-bold">
                {collaborator.contract_type === "socio" 
                  ? `${collaborator.partner_percentage || 0}%`
                  : formatCurrency(collaborator.base_salary)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>

          {/* Salary Evolution Chart */}
          {salaryHistory.length > 1 && (
            <div>
              <h4 className="font-medium mb-3">Evolução Salarial</h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[...salaryHistory].reverse().map(entry => ({
                      date: format(new Date(entry.effective_date), "MMM/yy", { locale: ptBR }),
                      salary: entry.new_salary,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis
                      tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="salary"
                      name="Salário"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Histórico de Salários
            </h4>
            {salaryHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum histórico disponível</p>
            ) : (
              <div className="space-y-2">
                {salaryHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md"
                  >
                    <div>
                      <p className="font-medium">{formatCurrency(entry.new_salary)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(entry.effective_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    {entry.previous_salary && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          De: {formatCurrency(entry.previous_salary)}
                        </p>
                        <p className="text-sm text-green-500">
                          +{formatCurrency(entry.new_salary - entry.previous_salary)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 mt-4">
          {!collaborator.documents || collaborator.documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum documento cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collaborator.documents.map((doc, index) => {
                const isExpiring = doc.expiry_date && new Date(doc.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();

                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 border rounded-md ${
                      isExpired
                        ? "border-red-500 bg-red-500/10"
                        : isExpiring
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" />
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        {doc.expiry_date && (
                          <p className="text-sm text-muted-foreground">
                            Vence: {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    {(isExpired || isExpiring) && (
                      <Badge variant={isExpired ? "destructive" : "outline"} className={isExpiring && !isExpired ? "text-orange-500 border-orange-500" : ""}>
                        {isExpired ? "Vencido" : "Vencendo"}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExternalCollaboratorDetailView({
  collaborator,
  onEdit,
}: {
  collaborator: ExternalCollaborator;
  onEdit: () => void;
}) {
  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16">
          <AvatarFallback className="text-lg">
            {getInitials(collaborator.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">{collaborator.full_name}</h3>
          <p className="text-muted-foreground">
            {collaborator.email || collaborator.phone || "Sem contato"}
          </p>
          <div className="flex gap-2 mt-2">
            <Badge>{collaborator.job_title || "Sem cargo"}</Badge>
            <Badge variant="outline">{collaborator.contract_type?.toUpperCase() || "CLT"}</Badge>
            {!collaborator.is_active && (
              <Badge variant="secondary">Inativo</Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
          <TabsTrigger value="salary" className="flex-1">Salário</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">CPF</p>
              <p className="font-medium">{collaborator.cpf || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">RG</p>
              <p className="font-medium">{collaborator.rg || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data de Nascimento</p>
              <p className="font-medium">
                {collaborator.birth_date
                  ? format(new Date(collaborator.birth_date), "dd/MM/yyyy")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admissão</p>
              <p className="font-medium">
                {collaborator.hire_date
                  ? format(new Date(collaborator.hire_date), "dd/MM/yyyy")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Horas/Semana</p>
              <p className="font-medium">{collaborator.weekly_hours || 40}h</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Departamento</p>
              <p className="font-medium">{collaborator.department || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium">{collaborator.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{collaborator.email || "-"}</p>
            </div>
          </div>

          {collaborator.address && Object.keys(collaborator.address).length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Building className="w-4 h-4" />
                Endereço
              </h4>
              <div className="text-sm bg-muted p-3 rounded-md">
                {collaborator.address.street && (
                  <p>{collaborator.address.street}, {collaborator.address.number}</p>
                )}
                {(collaborator.address.neighborhood || collaborator.address.city) && (
                  <p>
                    {collaborator.address.neighborhood} - {collaborator.address.city}/{collaborator.address.state}
                  </p>
                )}
                {collaborator.address.zip && <p>CEP: {collaborator.address.zip}</p>}
              </div>
            </div>
          )}

          {(collaborator.pix_key || collaborator.bank_name) && (
            <div>
              <h4 className="font-medium mb-2">Dados Bancários</h4>
              <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                {collaborator.bank_name && <p>Banco: {collaborator.bank_name}</p>}
                {collaborator.bank_agency && <p>Agência: {collaborator.bank_agency}</p>}
                {collaborator.bank_account && <p>Conta: {collaborator.bank_account}</p>}
                {collaborator.pix_key && <p>PIX: {collaborator.pix_key}</p>}
              </div>
            </div>
          )}

          {collaborator.notes && (
            <div>
              <h4 className="font-medium mb-2">Observações</h4>
              <div className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                {collaborator.notes}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="salary" className="space-y-4 mt-4">
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">
                {collaborator.contract_type === "socio" ? "Participação Societária" : "Salário Atual"}
              </p>
              <p className="text-2xl font-bold">
                {collaborator.contract_type === "socio" 
                  ? `${(collaborator as any).partner_percentage || 0}%`
                  : formatCurrency(collaborator.base_salary)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Tipo de Contrato</p>
              <p className="font-medium">{collaborator.contract_type?.toUpperCase() || "CLT"}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Horas/Semana</p>
              <p className="font-medium">{collaborator.weekly_hours || 40}h</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
