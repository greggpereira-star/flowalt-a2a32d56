import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAltControlContract, useUpsertMonthlyHours, AltControlContractService, AltControlMonthlyHours } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  Calendar,
  Clock,
  DollarSign,
  Gauge,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Edit,
  Save,
  BarChart3,
  Layers,
  FileText,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const ContractDetailPage: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useAltControlContract(contractId || '');
  const updateMonthlyHours = useUpsertMonthlyHours();

  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [hoursInput, setHoursInput] = useState<string>('');

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Contrato não encontrado</h2>
        <p className="text-muted-foreground mb-4">O contrato solicitado não existe ou foi removido.</p>
        <Button onClick={() => navigate('/altcontrol?tab=contracts')}>Voltar para Contratos</Button>
      </div>
    );
  }

  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthData = contract.monthly_hours?.find(m => m.year_month === currentMonth);
  const realizedHours = currentMonthData?.realized_hours || 0;
  const progress = (realizedHours / contract.contracted_hours) * 100;
  const isOverLimit = progress > 100;
  const isNearLimit = progress > 85 && progress <= 100;

  // Generate last 6 months for history
  const monthsHistory = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    const yearMonth = format(date, 'yyyy-MM');
    const monthData = contract.monthly_hours?.find(m => m.year_month === yearMonth);
    return {
      yearMonth,
      label: format(date, 'MMM/yy', { locale: ptBR }),
      realized: monthData?.realized_hours || 0,
      notes: monthData?.notes,
    };
  }).reverse();

  const handleSaveHours = async (yearMonth: string) => {
    if (!contractId) return;
    const hours = parseFloat(hoursInput);
    if (isNaN(hours) || hours < 0) {
      toast.error('Insira um valor válido de horas');
      return;
    }

    try {
      await updateMonthlyHours.mutateAsync({
        contractId,
        yearMonth,
        realizedHours: hours,
      });
      toast.success('Horas atualizadas');
      setEditingMonth(null);
      setHoursInput('');
    } catch (error) {
      toast.error('Erro ao atualizar horas');
    }
  };

  const getServiceTypeLabel = (type: string) => {
    switch (type) {
      case 'strategy': return 'Estratégia';
      case 'recurring': return 'Recorrência';
      case 'project': return 'Projeto';
      default: return type;
    }
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'strategy': return <TrendingUp className="h-4 w-4" />;
      case 'recurring': return <Calendar className="h-4 w-4" />;
      case 'project': return <Layers className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol?tab=contracts')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{contract.client_name}</h2>
            <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
              {contract.status === 'active' ? 'Ativo' : contract.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {contract.level?.name || 'Sem nível'} • Desde {format(new Date(contract.start_date), "MMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(contract.monthly_value)}</p>
                <p className="text-xs text-muted-foreground">Valor Mensal</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">{contract.contracted_hours}h</p>
                <p className="text-xs text-muted-foreground">Horas Contratadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          isOverLimit ? "border-destructive/30 bg-destructive/5" :
          isNearLimit ? "border-amber-500/30 bg-amber-500/5" :
          "border-green-500/30 bg-green-500/5"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                isOverLimit ? "bg-destructive/20" :
                isNearLimit ? "bg-amber-500/20" :
                "bg-green-500/20"
              )}>
                <Gauge className={cn(
                  "h-5 w-5",
                  isOverLimit ? "text-destructive" :
                  isNearLimit ? "text-amber-500" :
                  "text-green-500"
                )} />
              </div>
              <div>
                <p className={cn(
                  "text-xl font-bold",
                  isOverLimit ? "text-destructive" :
                  isNearLimit ? "text-amber-600" :
                  "text-green-600"
                )}>{realizedHours}h</p>
                <p className="text-xs text-muted-foreground">Horas Realizadas (Mês)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {contract.contracted_hours > 0 
                    ? formatCurrency(contract.monthly_value / contract.contracted_hours) 
                    : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Valor/Hora</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Speedometer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Velocímetro - {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center gap-4 mb-4">
              <span className={cn(
                "text-4xl font-bold",
                isOverLimit ? "text-destructive" :
                isNearLimit ? "text-amber-600" :
                "text-green-600"
              )}>
                {realizedHours}h
              </span>
              <span className="text-2xl text-muted-foreground">/ {contract.contracted_hours}h</span>
            </div>

            <div className="relative h-4 rounded-full bg-muted overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  isOverLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-amber-600"
                style={{ left: '85%' }}
              />
            </div>

            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>0h</span>
              <span className="text-amber-500">85%</span>
              <span>100%</span>
            </div>

            {isOverLimit && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Estouro de {(realizedHours - contract.contracted_hours).toFixed(1)}h</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="hours" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hours">Histórico de Horas</TabsTrigger>
          <TabsTrigger value="services">Serviços Contratados</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Horas Realizadas</CardTitle>
              <CardDescription>Últimos 6 meses de acompanhamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthsHistory.map((month) => {
                  const monthProgress = (month.realized / contract.contracted_hours) * 100;
                  const isMonthOver = monthProgress > 100;
                  const isMonthNear = monthProgress > 85 && monthProgress <= 100;
                  const isEditing = editingMonth === month.yearMonth;

                  return (
                    <div 
                      key={month.yearMonth}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                    >
                      <div className="w-20 text-sm font-medium">{month.label}</div>
                      
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={hoursInput}
                              onChange={(e) => setHoursInput(e.target.value)}
                              placeholder="Horas"
                              className="w-24"
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleSaveHours(month.yearMonth)}
                              disabled={updateMonthlyHours.isPending}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setEditingMonth(null);
                                setHoursInput('');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Progress 
                              value={Math.min(monthProgress, 100)} 
                              className={cn(
                                "flex-1 h-2",
                                isMonthOver ? "[&>div]:bg-destructive" :
                                isMonthNear ? "[&>div]:bg-amber-500" :
                                "[&>div]:bg-green-500"
                              )}
                            />
                            <span className={cn(
                              "text-sm font-medium w-16 text-right",
                              isMonthOver ? "text-destructive" :
                              isMonthNear ? "text-amber-600" : ""
                            )}>
                              {month.realized}h
                            </span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setEditingMonth(month.yearMonth);
                                setHoursInput(month.realized.toString());
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Serviços Inclusos no Contrato</CardTitle>
              <CardDescription>Detalhamento dos serviços e horas alocadas</CardDescription>
            </CardHeader>
            <CardContent>
              {contract.services && contract.services.length > 0 ? (
                <div className="space-y-3">
                  {contract.services.map((cs: AltControlContractService) => (
                    <div 
                      key={cs.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          {getServiceTypeIcon(cs.service?.service_type || 'recurring')}
                        </div>
                        <div>
                          <p className="font-medium">{cs.service?.name || 'Serviço'}</p>
                          <p className="text-sm text-muted-foreground">
                            {getServiceTypeLabel(cs.service?.service_type || 'recurring')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {cs.hours_allocated}h
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum serviço detalhado cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
