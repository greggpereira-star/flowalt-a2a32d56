import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useProjectProfitability, useClientProfitability } from "@/hooks/useCardFinancial";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: value >= 10000 ? "compact" : "standard",
  }).format(value);
};

const formatHours = (hours: number) => {
  return `${hours.toFixed(1)}h`;
};

export function ProjectProfitabilityPanel() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"projects" | "clients">("projects");
  
  const { data: projects = [], isLoading: loadingProjects } = useProjectProfitability();
  const { data: clients = [], isLoading: loadingClients } = useClientProfitability();

  const isLoading = view === "projects" ? loadingProjects : loadingClients;
  const data = view === "projects" ? projects : clients;

  const filteredData = data.filter(item => 
    ("title" in item ? item.title : item.name)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Chart data - top 10 by income
  const chartData = filteredData.slice(0, 10).map(item => ({
    name: ("title" in item ? item.title : item.name).substring(0, 15) + (("title" in item ? item.title : item.name).length > 15 ? "..." : ""),
    income: item.income,
    expenses: item.expenses + item.laborCost,
    profit: item.profit,
  }));

  // KPI calculations
  const totalIncome = filteredData.reduce((acc, item) => acc + item.income, 0);
  const totalExpenses = filteredData.reduce((acc, item) => acc + item.expenses + item.laborCost, 0);
  const totalProfit = filteredData.reduce((acc, item) => acc + item.profit, 0);
  const avgMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rentabilidade</h3>
          <p className="text-sm text-muted-foreground">
            Análise de lucratividade por {view === "projects" ? "projeto" : "cliente"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "projects" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("projects")}
          >
            Projetos
          </Button>
          <Button
            variant={view === "clients" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("clients")}
          >
            Clientes
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Receita Total</span>
            </div>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Custos Totais</span>
            </div>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-primary">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Lucro Líquido</span>
            </div>
            <p className={cn(
              "text-xl font-bold mt-1",
              totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {formatCurrency(totalProfit)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Margem Média</span>
            </div>
            <p className={cn(
              "text-xl font-bold mt-1",
              avgMargin >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {avgMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 10 por Receita</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : chartData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCurrency(v)}
                    className="text-xs"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    className="text-xs"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "income" ? "Receita" : name === "expenses" ? "Custos" : "Lucro"
                    ]}
                  />
                  <Bar dataKey="income" name="Receita" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="profit" name="Lucro" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.profit >= 0 ? "#10b981" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search & Table */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Buscar ${view === "projects" ? "projetos" : "clientes"}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{view === "projects" ? "Projeto" : "Cliente"}</TableHead>
                {view === "projects" && <TableHead>Cliente</TableHead>}
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custos</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum {view === "projects" ? "projeto" : "cliente"} encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-medium">
                      {"title" in item ? item.title : item.name}
                    </TableCell>
                    {view === "projects" && (
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {"clientName" in item ? item.clientName : "-"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right text-emerald-600 font-medium">
                      {formatCurrency(item.income)}
                    </TableCell>
                    <TableCell className="text-right text-rose-600">
                      {formatCurrency(item.expenses + item.laborCost)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatHours(item.hours)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-medium inline-flex items-center gap-1",
                        item.profit >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {item.profit >= 0 ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {formatCurrency(Math.abs(item.profit))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          item.profitMargin >= 30
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : item.profitMargin >= 10
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        )}
                      >
                        {item.profitMargin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
}
