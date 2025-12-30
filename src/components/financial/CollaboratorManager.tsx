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
} from "lucide-react";
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
import { useCollaborators, useSalaryHistory, CollaboratorDetails } from "@/hooks/useCollaborators";
import { CollaboratorForm } from "./CollaboratorForm";

export function CollaboratorManager() {
  const { data: collaborators = [], isLoading } = useCollaborators();
  const [selectedCollaborator, setSelectedCollaborator] = useState<CollaboratorDetails | null>(null);
  const [editingCollaborator, setEditingCollaborator] = useState<string | null>(null);

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
    if (!docs) return [];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return docs.filter(doc => {
      if (!doc.expiry_date) return false;
      return new Date(doc.expiry_date) <= thirtyDaysFromNow;
    });
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Controle de Colaboradores</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Colaboradores
            </CardTitle>
            <User className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{collaborators.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Folha Mensal
            </CardTitle>
            <DollarSign className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(
                collaborators.reduce((acc, c) => acc + (c?.base_salary || 0), 0)
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Horas/Semana
            </CardTitle>
            <Clock className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {collaborators.reduce((acc, c) => acc + (c?.weekly_hours || 40), 0)}h
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

      {/* Collaborators List */}
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
                    Nenhum colaborador cadastrado
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
                        {formatCurrency(collab?.base_salary)}
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
              <p className="text-sm text-muted-foreground">Salário Atual</p>
              <p className="text-2xl font-bold">{formatCurrency(collaborator.base_salary)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>

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
