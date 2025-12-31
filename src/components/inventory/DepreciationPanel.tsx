import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, Play, Calendar } from "lucide-react";
import { useDepreciationSchedules, useGenerateDepreciation, useDepreciationSummary, useDepreciationByDepartment } from "@/hooks/useDepreciation";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DepreciationPanel() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const { data: schedules = [], isLoading } = useDepreciationSchedules(selectedMonth);
  const { data: summary } = useDepreciationSummary();
  const { data: byDepartment = [] } = useDepreciationByDepartment();
  const generateDepreciation = useGenerateDepreciation();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Generate last 12 months for selection
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  const handleGenerate = async () => {
    await generateDepreciation.mutateAsync(selectedMonth);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ativos Depreciáveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalAssets || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Contábil Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalBookValue || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Depreciação Acumulada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(summary?.totalAccumulated || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Depreciação Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.monthlyDepreciation || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* By Department */}
      {byDepartment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Depreciação por Centro de Custo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {byDepartment.slice(0, 4).map((dept) => (
                <div key={dept.departmentId} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium truncate">
                    {dept.departmentId === 'sem-departamento' ? 'Sem Departamento' : dept.departmentId.slice(0, 8)}
                  </p>
                  <p className="text-lg font-bold">{formatCurrency(dept.total)}</p>
                  <p className="text-xs text-muted-foreground">{dept.items.length} itens</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Schedule de Depreciação
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleGenerate}
              disabled={generateDepreciation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              Gerar Depreciação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma depreciação gerada para este mês
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Depreciação Mensal</TableHead>
                  <TableHead className="text-right">Acumulada</TableHead>
                  <TableHead className="text-right">Valor Contábil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {schedule.item?.name || 'Item removido'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      -{formatCurrency(schedule.depreciation_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(schedule.accumulated_depreciation)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatCurrency(schedule.book_value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
