import React, { useMemo } from 'react';
import { useAltControlContracts, useAltControlLevels, useAltControlCostParams, AltControlContract, AltControlLevel } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine, Legend } from 'recharts';
import { BarChart3, AlertTriangle, TrendingUp, Target, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface ScatterDataPoint {
  x: number; // level order
  y: number; // cost per hour
  contract: AltControlContract;
  level: AltControlLevel | undefined;
  isOutlier: boolean;
}

export const ProfitabilityMatrixPage: React.FC = () => {
  const { data: contracts, isLoading: contractsLoading } = useAltControlContracts({ status: 'active' });
  const { data: levels, isLoading: levelsLoading } = useAltControlLevels();
  const { data: costParams } = useAltControlCostParams();

  const isLoading = contractsLoading || levelsLoading;

  // Transform data for scatter plot
  const scatterData = useMemo(() => {
    if (!contracts || !levels) return [];

    const currentMonth = format(new Date(), 'yyyy-MM');

    return contracts.map((contract): ScatterDataPoint => {
      const level = levels.find(l => l.id === contract.level_id);
      const monthlyData = contract.monthly_hours?.find(m => m.year_month === currentMonth);
      const realizedHours = monthlyData?.realized_hours || 0;

      // Calculate actual cost per hour (simplified: monthly value / realized hours)
      const actualCostPerHour = realizedHours > 0 
        ? contract.monthly_value / realizedHours 
        : costParams?.base_hourly_cost || 150;

      // Determine if outlier (cost above level's max target)
      const isOutlier = level ? actualCostPerHour < level.min_cost_per_hour : false;

      return {
        x: level?.display_order || 0,
        y: actualCostPerHour,
        contract,
        level,
        isOutlier,
      };
    });
  }, [contracts, levels, costParams]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    if (!scatterData.length) return { avgCost: 0, outliers: 0, healthyMargin: 0 };

    const avgCost = scatterData.reduce((acc, d) => acc + d.y, 0) / scatterData.length;
    const outliers = scatterData.filter(d => d.isOutlier).length;
    const healthyMargin = ((scatterData.length - outliers) / scatterData.length) * 100;

    return { avgCost, outliers, healthyMargin };
  }, [scatterData]);

  // Get level labels for X axis
  const levelLabels = useMemo(() => {
    if (!levels) return [];
    return levels
      .sort((a, b) => a.display_order - b.display_order)
      .map(l => ({ order: l.display_order, name: l.name }));
  }, [levels]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload as ScatterDataPoint;
    
    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-semibold">{data.contract.client_name}</p>
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-muted-foreground">
            Nível: <span className="font-medium text-foreground">{data.level?.name || 'N/A'}</span>
          </p>
          <p className="text-muted-foreground">
            Custo/hora: <span className="font-medium text-foreground">{formatCurrency(data.y)}</span>
          </p>
          <p className="text-muted-foreground">
            Valor mensal: <span className="font-medium text-foreground">{formatCurrency(data.contract.monthly_value)}</span>
          </p>
          {data.isOutlier && (
            <p className="text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Abaixo do custo alvo
            </p>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-8 w-8 animate-pulse text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(metrics.avgCost)}</p>
                <p className="text-xs text-muted-foreground">Custo médio/hora</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(metrics.outliers > 0 && "border-destructive/30 bg-destructive/5")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                metrics.outliers > 0 ? "bg-destructive/20" : "bg-muted"
              )}>
                <AlertTriangle className={cn("h-5 w-5", metrics.outliers > 0 ? "text-destructive" : "text-muted-foreground")} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", metrics.outliers > 0 && "text-destructive")}>
                  {metrics.outliers}
                </p>
                <p className="text-xs text-muted-foreground">Outliers (risco)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{metrics.healthyMargin.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Dentro da meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scatter Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Matriz de Dispersão
              </CardTitle>
              <CardDescription>
                Nível de contrato (X) vs Custo real por hora (Y)
              </CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Clientes posicionados abaixo da linha de custo alvo representam risco de margem. 
                    O objetivo é manter todos os pontos acima da meta.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          {scatterData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Nível"
                    domain={[0, (levels?.length || 4) + 1]}
                    ticks={levelLabels.map(l => l.order)}
                    tickFormatter={(value) => levelLabels.find(l => l.order === value)?.name || ''}
                    label={{ value: 'Nível', position: 'bottom', offset: 20 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Custo/hora"
                    tickFormatter={(value) => `R$ ${value}`}
                    label={{ value: 'Custo/hora (R$)', angle: -90, position: 'insideLeft', offset: -40 }}
                  />
                  
                  {/* Reference line for average cost */}
                  <ReferenceLine 
                    y={costParams?.base_hourly_cost || 150} 
                    stroke="hsl(var(--primary))" 
                    strokeDasharray="5 5"
                    label={{ value: 'Custo Base', position: 'right', fill: 'hsl(var(--primary))' }}
                  />

                  <Scatter 
                    name="Clientes" 
                    data={scatterData} 
                    fill="hsl(var(--primary))"
                  >
                    {scatterData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isOutlier ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} 
                        r={entry.isOutlier ? 8 : 6}
                      />
                    ))}
                  </Scatter>

                  <RechartsTooltip content={<CustomTooltip />} />
                  
                  <Legend 
                    payload={[
                      { value: 'Saudável', type: 'circle', color: 'hsl(var(--primary))' },
                      { value: 'Risco (outlier)', type: 'circle', color: 'hsl(var(--destructive))' },
                    ]}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Sem dados para exibir</h3>
              <p className="text-muted-foreground">
                Adicione contratos ativos para visualizar a matriz de rentabilidade
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Level Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Breakdown por Nível</CardTitle>
          <CardDescription>Distribuição de clientes e performance por nível</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {levels?.sort((a, b) => a.display_order - b.display_order).map((level) => {
              const levelContracts = scatterData.filter(d => d.level?.id === level.id);
              const levelOutliers = levelContracts.filter(d => d.isOutlier).length;
              const avgCost = levelContracts.length > 0
                ? levelContracts.reduce((acc, d) => acc + d.y, 0) / levelContracts.length
                : 0;
              const isHealthy = avgCost >= level.min_cost_per_hour;

              return (
                <div 
                  key={level.id} 
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    levelOutliers > 0 ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="px-3 py-1 text-sm font-semibold">
                      {level.name}
                    </Badge>
                    <div>
                      <p className="font-medium">{levelContracts.length} cliente(s)</p>
                      <p className="text-sm text-muted-foreground">
                        Custo alvo: {formatCurrency(level.min_cost_per_hour)} - {formatCurrency(level.max_cost_per_hour)}/h
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold",
                      !isHealthy && levelContracts.length > 0 ? "text-destructive" : "text-green-600"
                    )}>
                      {levelContracts.length > 0 ? formatCurrency(avgCost) : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {levelOutliers > 0 ? (
                        <span className="text-destructive">{levelOutliers} outlier(s)</span>
                      ) : (
                        <span className="text-green-600">✓ Dentro da meta</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}

            {(!levels || levels.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                Configure os níveis em Configurações para ver o breakdown
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
