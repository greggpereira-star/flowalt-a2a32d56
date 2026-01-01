import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  ArrowRight,
  Percent,
  Target
} from 'lucide-react';
import { useClientFinancialReport } from '@/hooks/useClientFinancialReport';
import { useClientFinancials } from '@/hooks/useClientCards';
import { cn } from '@/lib/utils';

interface ContractSimulatorTabProps {
  clientId: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function ContractSimulatorTab({ clientId }: ContractSimulatorTabProps) {
  const { data: report } = useClientFinancialReport(clientId);
  const { data: financials } = useClientFinancials(clientId);
  
  const currentContractValue = financials?.contract_value || 0;
  const currentExpectedMargin = financials?.expected_margin || 30;

  // Simulation state
  const [newContractValue, setNewContractValue] = useState(currentContractValue);
  const [newHoursLimit, setNewHoursLimit] = useState(report?.estimatedHours || 0);
  const [newMarginTarget, setNewMarginTarget] = useState(currentExpectedMargin);
  const [hourlyRate, setHourlyRate] = useState(150); // Default R$150/hour

  // Calculations
  const currentTotalCost = (report?.totalExpenses || 0) + (report?.laborCost || 0);
  const currentProfit = (report?.totalRevenue || 0) - currentTotalCost;
  const currentMargin = report?.profitMargin || 0;

  // Projected values based on new contract
  const projectedHoursCost = newHoursLimit * hourlyRate;
  const projectedTotalCost = projectedHoursCost + (report?.totalExpenses || 0);
  const projectedProfit = newContractValue - projectedTotalCost;
  const projectedMargin = newContractValue > 0 ? (projectedProfit / newContractValue) * 100 : 0;

  // Difference calculations
  const contractDiff = newContractValue - currentContractValue;
  const profitDiff = projectedProfit - currentProfit;
  const marginDiff = projectedMargin - currentMargin;

  // Breakeven calculations
  const breakEvenValue = projectedTotalCost / (1 - newMarginTarget / 100);
  const suggestedContractValue = Math.ceil(breakEvenValue / 100) * 100; // Round up to nearest 100

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Header */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/0 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Simulador de Contrato</CardTitle>
            </div>
            <CardDescription>
              Analise cenários de reajuste e veja o impacto na rentabilidade
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Current State */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Situação Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold">{formatCurrency(currentContractValue)}</p>
                <p className="text-xs text-muted-foreground">Contrato</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className={cn(
                  'text-lg font-bold',
                  currentProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                )}>
                  {formatCurrency(currentProfit)}
                </p>
                <p className="text-xs text-muted-foreground">Lucro</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className={cn(
                  'text-lg font-bold',
                  currentMargin >= 30 ? 'text-emerald-600' : 
                  currentMargin >= 10 ? 'text-amber-600' : 'text-rose-600'
                )}>
                  {currentMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Margem</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Simulation Inputs */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Target className="w-4 h-4" />
            Parâmetros da Simulação
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Novo Valor do Contrato</Label>
                <span className="text-sm font-medium">{formatCurrency(newContractValue)}</span>
              </div>
              <Input
                type="number"
                value={newContractValue}
                onChange={(e) => setNewContractValue(parseFloat(e.target.value) || 0)}
              />
              <Slider
                value={[newContractValue]}
                onValueChange={([v]) => setNewContractValue(v)}
                max={currentContractValue * 2 || 50000}
                step={500}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Horas Estimadas/Mês</Label>
                <span className="text-sm font-medium">{newHoursLimit}h</span>
              </div>
              <Input
                type="number"
                value={newHoursLimit}
                onChange={(e) => setNewHoursLimit(parseFloat(e.target.value) || 0)}
              />
              <Slider
                value={[newHoursLimit]}
                onValueChange={([v]) => setNewHoursLimit(v)}
                max={200}
                step={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo/Hora (M.O.)</Label>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Margem Alvo (%)</Label>
                <Input
                  type="number"
                  value={newMarginTarget}
                  onChange={(e) => setNewMarginTarget(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Projection Results */}
        <Card className={cn(
          'border-2',
          projectedMargin >= newMarginTarget ? 'border-emerald-500/50 bg-emerald-500/5' :
          projectedMargin >= 0 ? 'border-amber-500/50 bg-amber-500/5' :
          'border-rose-500/50 bg-rose-500/5'
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Projeção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Custo Projetado</p>
                  <p className="text-lg font-bold text-rose-600">
                    {formatCurrency(projectedTotalCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    M.O: {formatCurrency(projectedHoursCost)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Lucro Projetado</p>
                  <p className={cn(
                    'text-lg font-bold',
                    projectedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  )}>
                    {formatCurrency(projectedProfit)}
                  </p>
                  <div className="flex items-center gap-1 text-xs">
                    {profitDiff >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-rose-500" />
                    )}
                    <span className={profitDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {profitDiff >= 0 ? '+' : ''}{formatCurrency(profitDiff)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Margin Comparison */}
              <div className="p-4 bg-background rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">
                      {currentMargin.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Atual</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  <div className="text-center">
                    <p className={cn(
                      'text-2xl font-bold',
                      projectedMargin >= newMarginTarget ? 'text-emerald-600' :
                      projectedMargin >= 0 ? 'text-amber-600' : 'text-rose-600'
                    )}>
                      {projectedMargin.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Projetada</p>
                  </div>
                  <div className="text-center px-3 py-1 rounded bg-muted">
                    <p className="text-sm font-medium">{newMarginTarget}%</p>
                    <p className="text-xs text-muted-foreground">Alvo</p>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex justify-center">
                <Badge 
                  className={cn(
                    'text-sm px-4 py-1',
                    projectedMargin >= newMarginTarget 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : projectedMargin >= 0 
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                  )}
                >
                  {projectedMargin >= newMarginTarget 
                    ? '✓ Atinge a margem alvo' 
                    : projectedMargin >= 0
                      ? '⚠ Abaixo da margem alvo'
                      : '✕ Operação com prejuízo'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggestion */}
        {projectedMargin < newMarginTarget && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calculator className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Valor sugerido para atingir {newMarginTarget}% de margem:</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {formatCurrency(suggestedContractValue)}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setNewContractValue(suggestedContractValue)}
                  >
                    Aplicar valor sugerido
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detalhamento de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo de M.O. ({newHoursLimit}h × {formatCurrency(hourlyRate)})</span>
                <span>{formatCurrency(projectedHoursCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Despesas operacionais</span>
                <span>{formatCurrency(report?.totalExpenses || 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-medium">
                <span>Custo total</span>
                <span>{formatCurrency(projectedTotalCost)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Receita (Contrato)</span>
                <span className="text-emerald-600">{formatCurrency(newContractValue)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Resultado</span>
                <span className={projectedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatCurrency(projectedProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
