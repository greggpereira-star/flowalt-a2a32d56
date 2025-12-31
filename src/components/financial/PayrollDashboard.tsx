import { useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  FileText,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  usePayrolls,
  useGeneratePayroll,
  useApprovePayroll,
  useCollaboratorAnalytics,
  CollaboratorPayroll,
} from "@/hooks/useCollaboratorPayroll";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export function PayrollDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [selectedPayroll, setSelectedPayroll] = useState<CollaboratorPayroll | null>(null);
  
  const monthStr = format(selectedMonth, "yyyy-MM-01");
  const { data: payrolls = [], isLoading } = usePayrolls(monthStr);
  const { data: analytics } = useCollaboratorAnalytics();
  const generatePayroll = useGeneratePayroll();
  const approvePayroll = useApprovePayroll();

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Rascunho</Badge>;
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "approved":
        return <Badge className="bg-blue-500">Aprovada</Badge>;
      case "paid":
        return <Badge className="bg-green-500">Paga</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const prevMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));
  const nextMonth = () => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + 1);
    if (next <= new Date()) setSelectedMonth(next);
  };

  // Totais da folha
  const totals = payrolls.reduce(
    (acc, p) => ({
      gross: acc.gross + (p.gross_salary || 0),
      net: acc.net + (p.net_salary || 0),
      cost: acc.cost + (p.total_cost || 0),
      inss: acc.inss + (p.inss_value || 0),
      irrf: acc.irrf + (p.irrf_value || 0),
      fgts: acc.fgts + (p.fgts_value || 0),
    }),
    { gross: 0, net: 0, cost: 0, inss: 0, irrf: 0, fgts: 0 }
  );

  // Dados para o gráfico de composição
  const compositionData = [
    { name: "Salário Líquido", value: totals.net },
    { name: "INSS", value: totals.inss },
    { name: "IRRF", value: totals.irrf },
    { name: "FGTS", value: totals.fgts },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-semibold">
            Folha de {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={nextMonth}
            disabled={selectedMonth >= startOfMonth(new Date())}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generatePayroll.mutate({ referenceMonth: selectedMonth })}
            disabled={generatePayroll.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generatePayroll.isPending ? "animate-spin" : ""}`} />
            {generatePayroll.isPending ? "Gerando..." : "Gerar/Atualizar Folha"}
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bruto
            </CardTitle>
            <DollarSign className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totals.gross)}</p>
            <p className="text-xs text-muted-foreground">{payrolls.length} colaboradores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Líquido
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.net)}</p>
            <p className="text-xs text-muted-foreground">A pagar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Encargos
            </CardTitle>
            <FileText className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(totals.inss + totals.irrf + totals.fgts)}
            </p>
            <p className="text-xs text-muted-foreground">INSS + IRRF + FGTS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Total
            </CardTitle>
            <Users className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.cost)}</p>
            <p className="text-xs text-muted-foreground">Incluindo provisões</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composição da Folha */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Composição da Folha</CardTitle>
          </CardHeader>
          <CardContent>
            {compositionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={compositionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {compositionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
            <div className="mt-4 space-y-2">
              {compositionData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Holerites */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Holerites do Mês</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : payrolls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum holerite gerado para este mês
                    </TableCell>
                  </TableRow>
                ) : (
                  payrolls.map((payroll) => (
                    <TableRow key={payroll.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={payroll.collaborator?.member?.profile?.avatar_url || ""} />
                            <AvatarFallback>
                              {getInitials(
                                payroll.collaborator?.full_name ||
                                  payroll.collaborator?.member?.profile?.full_name
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {payroll.collaborator?.full_name ||
                                payroll.collaborator?.member?.profile?.full_name ||
                                "Colaborador"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payroll.collaborator?.member?.function_title || "-"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payroll.gross_salary)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatCurrency(payroll.total_discounts)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(payroll.net_salary)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payroll.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedPayroll(payroll)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Payslip Detail Sheet */}
      <Sheet open={!!selectedPayroll} onOpenChange={() => setSelectedPayroll(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedPayroll && (
            <PayslipDetail
              payroll={selectedPayroll}
              onApprove={() => {
                approvePayroll.mutate({ payrollId: selectedPayroll.id });
                setSelectedPayroll(null);
              }}
              isApproving={approvePayroll.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PayslipDetail({
  payroll,
  onApprove,
  isApproving,
}: {
  payroll: CollaboratorPayroll;
  onApprove: () => void;
  isApproving: boolean;
}) {
  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="space-y-6 pt-4">
      <SheetHeader>
        <SheetTitle>
          Holerite - {format(new Date(payroll.reference_month), "MMMM yyyy", { locale: ptBR })}
        </SheetTitle>
      </SheetHeader>

      <div className="space-y-1">
        <p className="font-medium">
          {payroll.collaborator?.full_name || payroll.collaborator?.member?.profile?.full_name}
        </p>
        <p className="text-sm text-muted-foreground">
          {payroll.collaborator?.member?.function_title} - {payroll.collaborator?.member?.department}
        </p>
      </div>

      {/* Proventos */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">PROVENTOS</h4>
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span>Salário Base</span>
            <span className="font-medium">{formatCurrency(payroll.base_salary)}</span>
          </div>
          {payroll.overtime_value > 0 && (
            <div className="flex justify-between">
              <span>Horas Extras ({payroll.overtime_hours}h)</span>
              <span className="font-medium">{formatCurrency(payroll.overtime_value)}</span>
            </div>
          )}
          {payroll.bonus > 0 && (
            <div className="flex justify-between">
              <span>Bônus</span>
              <span className="font-medium">{formatCurrency(payroll.bonus)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total Proventos</span>
            <span>{formatCurrency(payroll.gross_salary)}</span>
          </div>
        </div>
      </div>

      {/* Descontos */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">DESCONTOS</h4>
        <div className="bg-destructive/10 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span>INSS ({payroll.inss_percentage}%)</span>
            <span className="font-medium text-destructive">-{formatCurrency(payroll.inss_value)}</span>
          </div>
          {payroll.irrf_value > 0 && (
            <div className="flex justify-between">
              <span>IRRF</span>
              <span className="font-medium text-destructive">-{formatCurrency(payroll.irrf_value)}</span>
            </div>
          )}
          {payroll.vt_discount > 0 && (
            <div className="flex justify-between">
              <span>Vale Transporte</span>
              <span className="font-medium text-destructive">-{formatCurrency(payroll.vt_discount)}</span>
            </div>
          )}
          {payroll.health_plan_discount > 0 && (
            <div className="flex justify-between">
              <span>Plano de Saúde</span>
              <span className="font-medium text-destructive">-{formatCurrency(payroll.health_plan_discount)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total Descontos</span>
            <span className="text-destructive">-{formatCurrency(payroll.total_discounts)}</span>
          </div>
        </div>
      </div>

      {/* Líquido */}
      <div className="bg-green-500/10 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-bold text-lg">SALÁRIO LÍQUIDO</span>
          <span className="font-bold text-2xl text-green-600">
            {formatCurrency(payroll.net_salary)}
          </span>
        </div>
      </div>

      {/* Encargos Patronais */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">ENCARGOS PATRONAIS</h4>
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>FGTS (8%)</span>
            <span>{formatCurrency(payroll.fgts_value)}</span>
          </div>
          <div className="flex justify-between">
            <span>INSS Patronal (~28%)</span>
            <span>{formatCurrency(payroll.inss_patronal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Provisão 13º (1/12)</span>
            <span>{formatCurrency(payroll.provision_13th)}</span>
          </div>
          <div className="flex justify-between">
            <span>Provisão Férias + 1/3</span>
            <span>{formatCurrency(payroll.provision_vacation)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Custo Total Empresa</span>
            <span className="text-blue-600">{formatCurrency(payroll.total_cost)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {payroll.status === "draft" && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onApprove} disabled={isApproving}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {isApproving ? "Aprovando..." : "Aprovar Holerite"}
          </Button>
        </div>
      )}
    </div>
  );
}
