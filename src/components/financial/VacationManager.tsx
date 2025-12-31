import { useState } from "react";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Palmtree,
  FileText,
  Clock,
  AlertTriangle,
  Plus,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCollaborators } from "@/hooks/useCollaborators";
import {
  useAbsences,
  useVacationBalance,
  useCreateAbsence,
} from "@/hooks/useCollaboratorPayroll";

const ABSENCE_TYPES = [
  { value: "vacation", label: "Férias", color: "bg-green-500" },
  { value: "sick_leave", label: "Atestado Médico", color: "bg-yellow-500" },
  { value: "maternity", label: "Licença Maternidade", color: "bg-pink-500" },
  { value: "paternity", label: "Licença Paternidade", color: "bg-blue-500" },
  { value: "unpaid", label: "Licença não Remunerada", color: "bg-gray-500" },
  { value: "other", label: "Outros", color: "bg-purple-500" },
];

export function VacationManager() {
  const { data: collaborators = [] } = useCollaborators();
  const { data: absences = [], isLoading: loadingAbsences } = useAbsences();
  const { data: vacationBalances = [] } = useVacationBalance();
  const createAbsence = useCreateAbsence();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("");
  const [absenceType, setAbsenceType] = useState<string>("vacation");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "approved":
        return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" /> Aprovada</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Rejeitada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVacationStatus = (status: string) => {
    switch (status) {
      case "acquiring":
        return <Badge variant="outline">Adquirindo</Badge>;
      case "available":
        return <Badge className="bg-green-500">Disponível</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500">Parcial</Badge>;
      case "exhausted":
        return <Badge variant="secondary">Gozado</Badge>;
      case "expired":
        return <Badge variant="destructive">Vencido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSubmit = async () => {
    if (!selectedCollaborator || !startDate || !endDate) return;

    const daysCount = differenceInDays(endDate, startDate) + 1;

    await createAbsence.mutateAsync({
      collaborator_id: selectedCollaborator,
      absence_type: absenceType,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      days_count: daysCount,
      is_paid: absenceType !== "unpaid",
      vacation_bonus: false,
      vacation_bonus_days: 0,
      vacation_value: 0,
      vacation_third: 0,
      total_value: 0,
      status: "pending",
      notes,
    });

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedCollaborator("");
    setAbsenceType("vacation");
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes("");
  };

  // Métricas
  const pendingAbsences = absences.filter(a => a.status === "pending").length;
  const upcomingVacations = absences.filter(
    a => a.absence_type === "vacation" && 
         a.status === "approved" && 
         new Date(a.start_date) > new Date()
  ).length;
  const expiringVacations = vacationBalances.filter(
    v => v.status === "available" && 
         new Date(v.concession_end) <= addDays(new Date(), 60)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Férias e Ausências</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Ausência
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Ausência</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Colaborador</Label>
                <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {collaborators.map((c) => (
                      <SelectItem key={c.id} value={c.id || ""}>
                        {c.full_name || c.member?.profile?.full_name || "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de Ausência</Label>
                <Select value={absenceType} onValueChange={setAbsenceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ABSENCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {startDate && endDate && (
                <div className="text-sm text-muted-foreground text-center bg-muted p-2 rounded">
                  {differenceInDays(endDate, startDate) + 1} dias
                </div>
              )}

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Motivo, detalhes..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedCollaborator || !startDate || !endDate || createAbsence.isPending}
                >
                  {createAbsence.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solicitações Pendentes
            </CardTitle>
            <Clock className="w-5 h-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingAbsences}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Férias Agendadas
            </CardTitle>
            <Palmtree className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{upcomingVacations}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Férias a Vencer (60 dias)
            </CardTitle>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{expiringVacations}</p>
          </CardContent>
        </Card>
      </div>

      {/* Vacation Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Saldo de Férias por Colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {collaborators.map((collab) => {
              const balances = vacationBalances.filter(v => v.collaborator_id === collab.id);
              const currentBalance = balances.find(
                b => b.status === "available" || b.status === "partial"
              );

              return (
                <div key={collab.id} className="flex items-center gap-4">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={collab.member?.profile?.avatar_url || ""} />
                    <AvatarFallback>
                      {getInitials(collab.full_name || collab.member?.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm truncate">
                        {collab.full_name || collab.member?.profile?.full_name}
                      </p>
                      {currentBalance && getVacationStatus(currentBalance.status)}
                    </div>
                    {currentBalance ? (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={(currentBalance.days_remaining / currentBalance.total_days) * 100}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {currentBalance.days_remaining}/{currentBalance.total_days} dias
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Adquirindo período</p>
                    )}
                  </div>
                </div>
              );
            })}

            {collaborators.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Nenhum colaborador cadastrado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Absences Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Histórico de Ausências</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAbsences ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : absences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma ausência registrada
                  </TableCell>
                </TableRow>
              ) : (
                absences.slice(0, 10).map((absence) => {
                  const collab = collaborators.find(c => c.id === absence.collaborator_id);
                  const absenceTypeInfo = ABSENCE_TYPES.find(t => t.value === absence.absence_type);

                  return (
                    <TableRow key={absence.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={collab?.member?.profile?.avatar_url || ""} />
                            <AvatarFallback>
                              {getInitials(collab?.full_name || collab?.member?.profile?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {collab?.full_name || collab?.member?.profile?.full_name || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <div className={`w-2 h-2 rounded-full ${absenceTypeInfo?.color || "bg-gray-500"}`} />
                          {absenceTypeInfo?.label || absence.absence_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(absence.start_date), "dd/MM/yy")} -{" "}
                        {format(new Date(absence.end_date), "dd/MM/yy")}
                      </TableCell>
                      <TableCell>{absence.days_count}</TableCell>
                      <TableCell>{getStatusBadge(absence.status)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
