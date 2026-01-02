import { useMemo } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  BarChart3,
  X,
  FileText,
  DollarSign,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { CostCenterWithActual } from "@/hooks/useCostCenters";
import { Transaction } from "@/hooks/useFinancial";

interface CollaboratorInfo {
  name: string;
  salary: number;
}

interface CostCenterDrilldownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  center: CostCenterWithActual | null;
  transactions: Transaction[];
  incomeTransactions: Transaction[];
  salarySpent: number;
  collaborators: CollaboratorInfo[];
  selectedMonth: Date;
  // Historical data for comparison
  historicalData?: {
    month: string;
    expenses: number;
    income: number;
    budget: number;
  }[];
}

export function CostCenterDrilldown({
  open,
  onOpenChange,
  center,
  transactions,
  incomeTransactions,
  salarySpent,
  collaborators,
  selectedMonth,
  historicalData,
}: CostCenterDrilldownProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalExpenses = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalIncome = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalCost = totalExpenses + salarySpent;
    const margin = totalIncome - totalCost;
    const marginPercent = totalIncome > 0 ? (margin / totalIncome) * 100 : 0;
    const budgetUsed = center?.budget_monthly && center.budget_monthly > 0 
      ? (totalCost / center.budget_monthly) * 100 
      : 0;
    const budgetRemaining = (center?.budget_monthly || 0) - totalCost;

    return {
      totalExpenses,
      totalIncome,
      totalCost,
      margin,
      marginPercent,
      budgetUsed,
      budgetRemaining,
    };
  }, [transactions, incomeTransactions, salarySpent, center]);

  // Top 5 expenses
  const top5Expenses = useMemo(() => {
    return [...transactions]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
  }, [transactions]);

  // Timeline data - group transactions by week
  const timelineData = useMemo(() => {
    const weeklyData: Record<string, { week: string; expenses: number; income: number }> = {};
    
    // Get all days in the month
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    // Initialize weeks
    let currentDate = monthStart;
    let weekNum = 1;
    while (currentDate <= monthEnd) {
      const weekKey = `Sem ${weekNum}`;
      weeklyData[weekKey] = { week: weekKey, expenses: 0, income: 0 };
      currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      weekNum++;
    }

    // Group transactions by week
    transactions.forEach(t => {
      const transactionDate = new Date(t.due_date);
      const dayOfMonth = transactionDate.getDate();
      const weekIndex = Math.ceil(dayOfMonth / 7);
      const weekKey = `Sem ${weekIndex}`;
      if (weeklyData[weekKey]) {
        weeklyData[weekKey].expenses += Number(t.amount);
      }
    });

    incomeTransactions.forEach(t => {
      const transactionDate = new Date(t.due_date);
      const dayOfMonth = transactionDate.getDate();
      const weekIndex = Math.ceil(dayOfMonth / 7);
      const weekKey = `Sem ${weekIndex}`;
      if (weeklyData[weekKey]) {
        weeklyData[weekKey].income += Number(t.amount);
      }
    });

    return Object.values(weeklyData);
  }, [transactions, incomeTransactions, selectedMonth]);

  // Generate mock historical data if not provided
  const chartHistoricalData = useMemo(() => {
    if (historicalData) return historicalData;

    // Generate last 6 months of mock data
    return Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(selectedMonth, 5 - i);
      const isCurrentMonth = i === 5;
      return {
        month: format(date, "MMM", { locale: ptBR }),
        expenses: isCurrentMonth 
          ? metrics.totalExpenses + salarySpent 
          : Math.random() * (center?.budget_monthly || 10000) * 0.9,
        income: isCurrentMonth 
          ? metrics.totalIncome 
          : Math.random() * (center?.budget_monthly || 10000) * 1.2,
        budget: center?.budget_monthly || 0,
      };
    });
  }, [historicalData, selectedMonth, metrics, salarySpent, center]);

  if (!center) return null;

  const isProfitCenter = center.center_type === 'profit' || center.center_type === 'both';
  const isCostCenter = center.center_type === 'cost' || center.center_type === 'both' || !center.center_type;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-[800px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: center.color || '#3B82F6' }}
            />
            <span>{center.name}</span>
            {center.code && (
              <Badge variant="outline">{center.code}</Badge>
            )}
            {center.center_type && (
              <Badge variant="secondary">
                {center.center_type === 'cost' ? 'Custo' : center.center_type === 'profit' ? 'Lucro' : 'Custo/Lucro'}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
              {isCostCenter && (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Orçamento</p>
                          <p className="text-2xl font-bold">{formatCurrency(center.budget_monthly || 0)}</p>
                        </div>
                        <DollarSign className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={metrics.budgetRemaining < 0 ? 'border-red-500/50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                          <p className={`text-2xl font-bold ${metrics.budgetRemaining < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatCurrency(metrics.budgetRemaining)}
                          </p>
                        </div>
                        {metrics.budgetRemaining < 0 ? (
                          <TrendingDown className="w-8 h-8 text-red-500/30" />
                        ) : (
                          <TrendingUp className="w-8 h-8 text-green-500/30" />
                        )}
                      </div>
                      <Progress 
                        value={Math.min(metrics.budgetUsed, 100)} 
                        className={`mt-3 h-2 ${
                          metrics.budgetUsed >= 100 
                            ? '[&>div]:bg-red-500' 
                            : metrics.budgetUsed >= 80 
                              ? '[&>div]:bg-orange-500' 
                              : '[&>div]:bg-green-500'
                        }`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {metrics.budgetUsed.toFixed(1)}% utilizado
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}

              {isProfitCenter && (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Receita</p>
                          <p className="text-2xl font-bold text-green-500">{formatCurrency(metrics.totalIncome)}</p>
                        </div>
                        <ArrowUpCircle className="w-8 h-8 text-green-500/30" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={metrics.margin < 0 ? 'border-red-500/50' : 'border-green-500/50'}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Margem</p>
                          <p className={`text-2xl font-bold ${metrics.margin < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatCurrency(metrics.margin)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ({metrics.marginPercent.toFixed(1)}%)
                          </p>
                        </div>
                        <BarChart3 className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Despesas</p>
                      <p className="text-2xl font-bold text-red-500">{formatCurrency(metrics.totalExpenses)}</p>
                    </div>
                    <ArrowDownCircle className="w-8 h-8 text-red-500/30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Salários</p>
                      <p className="text-2xl font-bold text-orange-500">{formatCurrency(salarySpent)}</p>
                    </div>
                    <Users className="w-8 h-8 text-orange-500/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Evolução Semanal - {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis 
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} 
                        tick={{ fontSize: 12 }} 
                        className="text-muted-foreground" 
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="expenses" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      {isProfitCenter && (
                        <Bar dataKey="income" name="Receita" fill="hsl(142.1 76.2% 36.3%)" radius={[4, 4, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Historical Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Comparativo Últimos 6 Meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartHistoricalData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis 
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} 
                        tick={{ fontSize: 12 }} 
                        className="text-muted-foreground" 
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      {center.budget_monthly && center.budget_monthly > 0 && (
                        <Area 
                          type="monotone" 
                          dataKey="budget" 
                          name="Orçamento" 
                          stroke="hsl(var(--muted-foreground))" 
                          fill="hsl(var(--muted))"
                          strokeDasharray="5 5"
                        />
                      )}
                      <Area 
                        type="monotone" 
                        dataKey="expenses" 
                        name="Despesas" 
                        stroke="hsl(var(--destructive))" 
                        fill="hsl(var(--destructive)/0.2)"
                      />
                      {isProfitCenter && (
                        <Area 
                          type="monotone" 
                          dataKey="income" 
                          name="Receita" 
                          stroke="hsl(142.1 76.2% 36.3%)" 
                          fill="hsl(142.1 76.2% 36.3%/0.2)"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top 5 Expenses */}
            {top5Expenses.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Top 5 Maiores Despesas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {top5Expenses.map((t, index) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </span>
                              <span className="font-medium">{t.description}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(t.due_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-500">
                            {formatCurrency(Number(t.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Collaborators */}
            {collaborators.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Colaboradores Vinculados ({collaborators.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Salário</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collaborators
                        .sort((a, b) => b.salary - a.salary)
                        .map((c, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-right text-orange-500">
                              {formatCurrency(c.salary)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {salarySpent > 0 ? ((c.salary / salarySpent) * 100).toFixed(1) : 0}%
                            </TableCell>
                          </TableRow>
                        ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-orange-500">
                          {formatCurrency(salarySpent)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* All Transactions */}
            {transactions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-red-500" />
                    Todas as Despesas ({transactions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.description}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.category?.name || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(t.due_date), "dd/MM")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={t.status === 'paid' ? 'default' : 'secondary'}>
                              {t.status === 'paid' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-500">
                            {formatCurrency(Number(t.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
