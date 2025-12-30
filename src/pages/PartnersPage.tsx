import { Helmet } from "react-helmet";
import { useState, useEffect } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useAccessLogging } from "@/hooks/useAccessLogging";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertTriangle,
  Clock,
  Target,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useTransactions, useFinancialSummary } from "@/hooks/useFinancial";
import { useAllCards } from "@/hooks/useCards";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceMembers, useMemberCapacity } from "@/hooks/useWorkspaceMembers";
import { useCollaborators } from "@/hooks/useCollaborators";

const COLORS = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];

export default function PartnersPage() {
  usePageTracking('partners');
  const { logPartnersAccess } = useAccessLogging();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Log access to partners dashboard
  useEffect(() => {
    logPartnersAccess('dashboard_view');
  }, [logPartnersAccess]);
  
  const { data: summary } = useFinancialSummary(selectedMonth);
  const { data: cards = [] } = useAllCards();
  const { data: clients = [] } = useClients();
  const { data: members = [] } = useWorkspaceMembers();
  const { data: memberCapacity = [] } = useMemberCapacity();
  const { data: collaborators = [] } = useCollaborators();

  // Get last 6 months for trends
  const months = Array.from({ length: 6 }, (_, i) => subMonths(selectedMonth, 5 - i));
  
  const { data: allTransactions = [] } = useTransactions({
    startDate: startOfMonth(months[0]).toISOString().split("T")[0],
    endDate: endOfMonth(selectedMonth).toISOString().split("T")[0],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const navigateMonth = (direction: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  // Calculate monthly payroll
  const monthlyPayroll = collaborators.reduce((acc, c) => acc + (c?.base_salary || 0), 0);

  // Calculate revenue by client
  const revenueByClient = allTransactions
    .filter(t => t.type === "income" && t.status === "paid")
    .reduce((acc, t) => {
      const clientId = t.client_id || "unknown";
      acc[clientId] = (acc[clientId] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const clientRevenueData = clients
    .map(client => ({
      name: client.name,
      value: revenueByClient[client.id] || 0,
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Calculate real margin
  const totalRevenue = summary?.income || 0;
  const totalExpenses = summary?.expenses || 0;
  const realMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

  // Calculate hour-man cost
  const totalHoursWorked = memberCapacity.reduce((acc, m) => acc + (m.weekly_hours || 0) * 4, 0); // Monthly
  const hourManCost = totalHoursWorked > 0 ? totalExpenses / totalHoursWorked : 0;

  // Calculate team capacity utilization
  const totalCapacity = memberCapacity.reduce((acc, m) => acc + 40 * 4, 0); // 40h/week * 4 weeks
  const allocatedHours = memberCapacity.reduce((acc, m) => acc + (m.allocated_hours || 0), 0);
  const capacityUtilization = totalCapacity > 0 ? (allocatedHours / totalCapacity) * 100 : 0;

  // Alerts
  const alerts = [];
  
  // Overdue cards
  const overdueCards = cards.filter(c => {
    if (!c.due_date || c.status === "delivered" || c.status === "archived") return false;
    return new Date(c.due_date) < new Date();
  });
  if (overdueCards.length > 0) {
    alerts.push({
      type: "critical",
      icon: AlertTriangle,
      title: `${overdueCards.length} cards atrasados`,
      description: "Cards com prazo vencido precisam de atenção",
    });
  }

  // Overloaded members
  const overloadedMembers = memberCapacity.filter(m => {
    const available = m.available_hours;
    return available < 0;
  });
  if (overloadedMembers.length > 0) {
    alerts.push({
      type: "warning",
      icon: Users,
      title: `${overloadedMembers.length} colaboradores sobrecarregados`,
      description: "Equipe com alocação acima da capacidade",
    });
  }

  // Negative margin
  if (realMargin < 0) {
    alerts.push({
      type: "critical",
      icon: TrendingDown,
      title: "Margem negativa",
      description: "Despesas superando receitas neste período",
    });
  }

  // Low margin warning
  if (realMargin > 0 && realMargin < 20) {
    alerts.push({
      type: "warning",
      icon: DollarSign,
      title: "Margem baixa",
      description: `Margem atual de ${realMargin.toFixed(1)}% está abaixo do ideal`,
    });
  }

  // Overdue transactions
  if (summary?.overdueCount && summary.overdueCount > 0) {
    alerts.push({
      type: "warning",
      icon: Clock,
      title: `${summary.overdueCount} pagamentos vencidos`,
      description: formatCurrency(summary.overdueAmount || 0),
    });
  }

  // Monthly trend data
  const monthlyData = months.map(month => {
    const monthTransactions = allTransactions.filter(t => {
      const date = new Date(t.due_date);
      return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    });

    const income = monthTransactions
      .filter(t => t.type === "income" && t.status === "paid")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const expenses = monthTransactions
      .filter(t => t.type === "expense" && t.status === "paid")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    return {
      month: format(month, "MMM", { locale: ptBR }),
      income,
      expenses,
      margin: income - expenses,
    };
  });

  return (
    <PermissionGuard permission="canViewPartners">
      <Helmet>
        <title>Painel dos Sócios | FlowAgency</title>
        <meta name="description" content="Visão executiva para tomada de decisão" />
      </Helmet>

      <AppLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Painel dos Sócios</h1>
              <p className="text-muted-foreground">Visão executiva</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-medium min-w-[140px] text-center">
                {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {alerts.map((alert, index) => (
                <Card key={index} className={`border-l-4 ${alert.type === "critical" ? "border-l-red-500" : "border-l-orange-500"}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <alert.icon className={`w-5 h-5 ${alert.type === "critical" ? "text-red-500" : "text-orange-500"}`} />
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Main KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Receita
                </CardTitle>
                <ArrowUpRight className="w-5 h-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrency(totalRevenue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Despesas
                </CardTitle>
                <ArrowDownRight className="w-5 h-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-500">
                  {formatCurrency(totalExpenses)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Margem Real
                </CardTitle>
                {realMargin >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${realMargin >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {realMargin.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(totalRevenue - totalExpenses)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Custo Hora-Homem
                </CardTitle>
                <Clock className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(hourManCost)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {totalHoursWorked}h trabalhadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Capacidade
                </CardTitle>
                <Target className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {capacityUtilization.toFixed(0)}%
                </p>
                <Progress value={Math.min(capacityUtilization, 100)} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue & Margin Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução Receita x Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
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
                      <Legend />
                      <Bar dataKey="income" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Client */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receita por Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {clientRevenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={clientRevenueData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {clientRevenueData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Sem dados de clientes
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Margin Trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Evolução da Margem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
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
                      <Line
                        type="monotone"
                        dataKey="margin"
                        name="Margem"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo do Time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Colaboradores</span>
                  <span className="font-bold">{collaborators.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Folha Mensal</span>
                  <span className="font-bold">{formatCurrency(monthlyPayroll)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Clientes Ativos</span>
                  <span className="font-bold">{clients.filter(c => c.is_active).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cards em Andamento</span>
                  <span className="font-bold">
                    {cards.filter(c => c.status === "in_progress").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cards Atrasados</span>
                  <span className="font-bold text-red-500">{overdueCards.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </PermissionGuard>
  );
}
