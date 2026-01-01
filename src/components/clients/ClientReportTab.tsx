import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  DollarSign,
  Target,
  BarChart3,
  Calendar,
  Activity
} from 'lucide-react';
import { useClientFinancialReport, ClientFinancialReport } from '@/hooks/useClientFinancialReport';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

interface ClientReportTabProps {
  clientId: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatHours = (hours: number) => {
  return `${hours.toFixed(1)}h`;
};

const HealthScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const getColor = () => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBgColor = () => {
    if (score >= 80) return 'bg-emerald-500/10';
    if (score >= 60) return 'bg-amber-500/10';
    if (score >= 40) return 'bg-orange-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className={cn('relative w-24 h-24 rounded-full flex items-center justify-center', getBgColor())}>
      <div className="absolute inset-2 rounded-full border-4 border-muted" />
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={`${score * 2.51} 251`}
          className={getColor()}
        />
      </svg>
      <span className={cn('text-2xl font-bold', getColor())}>{score}</span>
    </div>
  );
};

const FinancialStateIndicator: React.FC<{ state: string }> = ({ state }) => {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    healthy: { label: 'Saudável', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    attention: { label: 'Atenção', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    critical: { label: 'Crítico', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    loss: { label: 'Prejuízo', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  };

  const { label, color, bg } = config[state] || config.attention;

  return (
    <Badge className={cn('gap-1', bg, color)}>
      {state === 'healthy' && <TrendingUp className="w-3 h-3" />}
      {state === 'attention' && <AlertTriangle className="w-3 h-3" />}
      {state === 'critical' && <AlertTriangle className="w-3 h-3" />}
      {state === 'loss' && <TrendingDown className="w-3 h-3" />}
      {label}
    </Badge>
  );
};

export function ClientReportTab({ clientId }: ClientReportTabProps) {
  const { data: report, isLoading } = useClientFinancialReport(clientId);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <BarChart3 className="w-12 h-12 mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">Sem dados disponíveis</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Vincule tarefas a este cliente para ver os relatórios
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Header with Health Score */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Saúde do Cliente</h3>
                </div>
                <FinancialStateIndicator state={report.financialState} />
                <p className="text-sm text-muted-foreground max-w-xs">
                  Score baseado em tarefas, eficiência de horas e margem de lucro
                </p>
              </div>
              <HealthScoreGauge score={report.healthScore} />
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Tasks */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">Tarefas</span>
              </div>
              <p className="text-2xl font-bold">{report.completedTasks}/{report.totalTasks}</p>
              <Progress 
                value={report.taskCompletionRate} 
                className="h-1.5 mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{report.taskCompletionRate.toFixed(0)}% concluídas</span>
                {report.overduesTasks > 0 && (
                  <span className="text-destructive">{report.overduesTasks} atrasadas</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hours */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Horas</span>
              </div>
              <p className="text-2xl font-bold">{formatHours(report.totalHours)}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  Estimado: {formatHours(report.estimatedHours)}
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-xs',
                    report.hoursEfficiency <= 100 
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : report.hoursEfficiency <= 120
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : 'bg-red-500/10 text-red-600 border-red-500/20'
                  )}
                >
                  {report.hoursEfficiency.toFixed(0)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Revenue */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Receita</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(report.totalRevenue)}</p>
            </CardContent>
          </Card>

          {/* Costs */}
          <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-medium">Custos</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(report.totalExpenses + report.laborCost)}</p>
              <div className="text-xs text-muted-foreground mt-1">
                <span>M.O: {formatCurrency(report.laborCost)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit Card */}
        <Card className={cn(
          'border',
          report.profit >= 0
            ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
            : 'bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20'
        )}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5" />
                  <span className="font-medium">Lucro Líquido</span>
                </div>
                <p className={cn(
                  'text-3xl font-bold',
                  report.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                )}>
                  {formatCurrency(report.profit)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-lg px-4 py-2',
                  report.profitMargin >= 30
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : report.profitMargin >= 10
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                )}
              >
                {report.profitMargin.toFixed(1)}% margem
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contract Progress */}
        {report.contractValue && (
          <>
            <Separator />
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">Contrato</CardTitle>
                </div>
                <CardDescription>Consumo do valor contratado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Valor do Contrato</span>
                    <span className="font-medium">{formatCurrency(report.contractValue)}</span>
                  </div>
                  <Progress 
                    value={Math.min((report.consumedValue / report.contractValue) * 100, 100)} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Consumido: {formatCurrency(report.consumedValue)}</span>
                    <span>Restante: {formatCurrency(report.remainingValue || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Monthly Chart */}
        <Separator />
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Evolução Mensal</CardTitle>
            </div>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={(v) => {
                      const [year, month] = v.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                    className="text-xs"
                  />
                  <YAxis 
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return `${month}/${year}`;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Receita"
                    stackId="1"
                    stroke="hsl(var(--chart-1))" 
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expenses" 
                    name="Despesas"
                    stackId="2"
                    stroke="hsl(var(--chart-2))" 
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hours Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Horas por Mês</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={(v) => {
                      const [, month] = v.split('-');
                      return month;
                    }}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}h`}
                  />
                  <Bar 
                    dataKey="hours" 
                    name="Horas"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
