import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAltControlContracts, useAltControlCostParams, AltControlContract } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowRight,
  Gauge,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface ContractCardProps {
  contract: AltControlContract;
  costPerHour: number;
  onClick: () => void;
}

const ContractCard: React.FC<ContractCardProps> = ({ contract, costPerHour, onClick }) => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthlyData = contract.monthly_hours?.find(m => m.year_month === currentMonth);
  const realizedHours = monthlyData?.realized_hours || 0;
  const contractedHours = contract.contracted_hours || 1;
  
  const progress = (realizedHours / contractedHours) * 100;
  const isOverLimit = progress > 100;
  const isNearLimit = progress > 85 && progress <= 100;
  const isHealthy = progress <= 85;

  // Calculate overflow cost
  const overflowHours = Math.max(0, realizedHours - contractedHours);
  const overflowCost = overflowHours * costPerHour;

  // Determine status
  const getStatusConfig = () => {
    if (isOverLimit) return { color: 'destructive', icon: TrendingDown, label: 'Estourou', bgClass: 'bg-destructive/10 border-destructive/30' };
    if (isNearLimit) return { color: 'amber', icon: AlertTriangle, label: 'Atenção', bgClass: 'bg-amber-500/10 border-amber-500/30' };
    return { color: 'green', icon: CheckCircle, label: 'Saudável', bgClass: 'bg-green-500/10 border-green-500/30' };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <Card 
      className={cn("cursor-pointer transition-all hover:shadow-md border-2", status.bgClass)}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{contract.client_name}</h3>
            <p className="text-sm text-muted-foreground">{contract.level?.name || 'Sem nível'}</p>
          </div>
          <Badge 
            variant={isOverLimit ? 'destructive' : isNearLimit ? 'secondary' : 'default'}
            className="shrink-0 gap-1"
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        {/* Speedometer */}
        <div className="relative mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Gauge className={cn(
              "h-5 w-5",
              isOverLimit ? "text-destructive" : isNearLimit ? "text-amber-500" : "text-green-500"
            )} />
            <span className={cn(
              "text-2xl font-bold",
              isOverLimit ? "text-destructive" : isNearLimit ? "text-amber-600" : "text-green-600"
            )}>
              {realizedHours}h
            </span>
            <span className="text-muted-foreground">/ {contractedHours}h</span>
          </div>
          
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                isOverLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-green-500"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
            {/* Warning zone indicator */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500/50"
              style={{ left: '85%' }}
            />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0h</span>
            <span className={cn(progress > 85 && 'text-amber-500')}>85%</span>
            <span>{contractedHours}h</span>
          </div>
        </div>

        {/* Overflow Alert */}
        {isOverLimit && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 mb-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium text-sm">Estouro de {overflowHours.toFixed(1)}h</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Prejuízo estimado: <span className="font-semibold text-destructive">{formatCurrency(overflowCost)}</span>
            </p>
          </div>
        )}

        <Separator className="my-3" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Valor mensal</p>
            <p className="font-semibold text-primary">{formatCurrency(contract.monthly_value)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Início</p>
            <p className="text-sm">{format(new Date(contract.start_date), 'MMM/yy', { locale: ptBR })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ContractsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: contracts, isLoading } = useAltControlContracts({ status: 'active' });
  const { data: costParams } = useAltControlCostParams();

  const costPerHour = costParams?.base_hourly_cost || 150;

  // Calculate summary stats
  const totalContracts = contracts?.length || 0;
  const healthyCount = contracts?.filter(c => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const realized = c.monthly_hours?.find(m => m.year_month === currentMonth)?.realized_hours || 0;
    return (realized / c.contracted_hours) <= 0.85;
  }).length || 0;
  const warningCount = contracts?.filter(c => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const realized = c.monthly_hours?.find(m => m.year_month === currentMonth)?.realized_hours || 0;
    const progress = realized / c.contracted_hours;
    return progress > 0.85 && progress <= 1;
  }).length || 0;
  const overflowCount = contracts?.filter(c => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const realized = c.monthly_hours?.find(m => m.year_month === currentMonth)?.realized_hours || 0;
    return realized > c.contracted_hours;
  }).length || 0;

  const totalOverflowCost = contracts?.reduce((acc, c) => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const realized = c.monthly_hours?.find(m => m.year_month === currentMonth)?.realized_hours || 0;
    const overflow = Math.max(0, realized - c.contracted_hours);
    return acc + (overflow * costPerHour);
  }, 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-muted-foreground">Carregando contratos...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalContracts}</p>
                <p className="text-xs text-muted-foreground">Clientes Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
                <p className="text-xs text-muted-foreground">Saudáveis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
                <p className="text-xs text-muted-foreground">Em Atenção</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{overflowCount}</p>
                <p className="text-xs text-muted-foreground">Estouraram</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overflow Alert */}
      {totalOverflowCost > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Prejuízo Estimado no Mês</p>
                <p className="text-sm text-muted-foreground">
                  {overflowCount} cliente(s) excederam o teto de horas
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalOverflowCost)}</p>
          </CardContent>
        </Card>
      )}

      {/* Contracts Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Velocímetro de Horas
          </CardTitle>
          <CardDescription>
            Acompanhamento de horas realizadas vs contratadas por cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contracts && contracts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  costPerHour={costPerHour}
                  onClick={() => navigate(`/altcontrol/contracts/${contract.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum cliente ativo</h3>
              <p className="text-muted-foreground mb-4">
                Contratos aprovados aparecerão aqui automaticamente
              </p>
              <Button variant="outline" onClick={() => navigate('/altcontrol')}>
                Ver Propostas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
