import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Briefcase,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  ArrowUpRight,
  ArrowDownRight,
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
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollaboratorAnalytics, usePayrolls } from "@/hooks/useCollaboratorPayroll";
import { useCollaborators } from "@/hooks/useCollaborators";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function CollaboratorAnalytics() {
  const { data: analytics, isLoading } = useCollaboratorAnalytics();
  const { data: collaborators = [] } = useCollaborators();
  const { data: payrolls = [] } = usePayrolls();

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Dados para gráfico de contrato
  const contractData = Object.entries(analytics?.contractDistribution || {}).map(([type, count]) => ({
    name: type.toUpperCase(),
    value: count,
  }));

  // Dados para custo por componente
  const costBreakdown = analytics ? [
    { name: "Salários", value: analytics.totalBaseSalary },
    { name: "Benefícios", value: analytics.totalBenefits },
    { name: "INSS", value: analytics.totalINSS },
    { name: "FGTS", value: analytics.totalFGTS },
    { name: "Provisões", value: analytics.totalProvisions },
  ].filter(d => d.value > 0) : [];

  // Evolução da folha (últimos meses)
  const payrollTrend = payrolls
    .reduce((acc, p) => {
      const month = p.reference_month.slice(0, 7);
      if (!acc[month]) {
        acc[month] = { month, total: 0, count: 0 };
      }
      acc[month].total += p.total_cost || 0;
      acc[month].count += 1;
      return acc;
    }, {} as Record<string, { month: string; total: number; count: number }>);

  const trendData = Object.values(payrollTrend)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .map(d => ({
      month: d.month.slice(5, 7) + "/" + d.month.slice(2, 4),
      total: d.total,
    }));

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics de Colaboradores</h2>
        <Badge variant="outline">
          Atualizado agora
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Colaboradores
            </CardTitle>
            <Users className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.totalCollaborators || 0}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              Ativos no workspace
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Total Mensal
            </CardTitle>
            <DollarSign className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(analytics?.totalCost || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Inclui encargos e benefícios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Médio/Colaborador
            </CardTitle>
            <Briefcase className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(analytics?.avgCost || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Média mensal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Horas Semanais
            </CardTitle>
            <Clock className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {analytics?.totalWeeklyHours || 0}h
            </p>
            <p className="text-xs text-muted-foreground">
              Capacidade total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por Contrato */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Distribuição por Contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contractData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={contractData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {contractData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {contractData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição do Custo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChartIcon className="w-4 h-4" />
              Composição do Custo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={costBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução da Folha */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Evolução da Folha
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Custo Total"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Gere folhas de pagamento para ver a evolução
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detalhamento por Colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collaborators.map((collab) => {
              const salary = collab.base_salary || 0;
              const estimatedCost = salary * 1.8; // Estimativa com encargos

              return (
                <div
                  key={collab.id}
                  className="p-4 bg-muted/50 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">
                      {collab.full_name || collab.member?.profile?.full_name || "Colaborador"}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {(collab.contract_type || "clt").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {collab.member?.function_title || "Sem cargo"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Salário: </span>
                      <span className="font-medium">{formatCurrency(salary)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo Est.: </span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(estimatedCost)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {collaborators.length === 0 && (
              <div className="col-span-3 text-center text-muted-foreground py-8">
                Nenhum colaborador cadastrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
