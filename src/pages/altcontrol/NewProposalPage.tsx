import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAltControlServices,
  useAltControlLevels,
  useProposalCalculations,
  useCreateProposal,
  useUpsertProposalItems,
  useUpdateProposal,
  type AltControlService,
  type AltControlLevel,
} from '@/hooks/useAltControl';
import { useClientCards } from '@/hooks/useClientCards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Save,
  Send,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Gauge,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectedService {
  serviceId: string;
  hours: number;
}

export const NewProposalPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: services, isLoading: servicesLoading } = useAltControlServices();
  const { data: levels } = useAltControlLevels();
  const { data: clients } = useClientCards();
  const { calculateEstimates } = useProposalCalculations();
  
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const upsertItems = useUpsertProposalItems();

  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);

  // Calculate totals and level
  const totalHours = useMemo(() => 
    selectedServices.reduce((sum, s) => sum + s.hours, 0),
    [selectedServices]
  );

  const calculations = useMemo(() => 
    calculateEstimates(totalHours),
    [totalHours, calculateEstimates]
  );

  // Validation
  const canSubmit = clientName.trim() !== '' && selectedServices.length > 0 && totalHours > 0;

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const existing = prev.find(s => s.serviceId === serviceId);
      if (existing) {
        return prev.filter(s => s.serviceId !== serviceId);
      }
      return [...prev, { serviceId, hours: 10 }];
    });
  };

  const updateServiceHours = (serviceId: string, hours: number) => {
    if (hours < 0) return;
    setSelectedServices(prev => 
      prev.map(s => s.serviceId === serviceId ? { ...s, hours } : s)
    );
  };

  const getServiceRestrictionWarning = (service: AltControlService): string | null => {
    if (!service.requires_minimum_level || !service.minimum_level_id) return null;
    if (!calculations.level) return null;

    const minLevel = levels?.find(l => l.id === service.minimum_level_id);
    if (!minLevel) return null;

    if (calculations.level.display_order < minLevel.display_order) {
      return `Disponível a partir do ${minLevel.name} (mín. ${minLevel.min_hours}h)`;
    }
    return null;
  };

  const handleSave = async () => {
    if (!canSubmit) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const proposal = await createProposal.mutateAsync({
        client_name: clientName,
        client_id: clientId || undefined,
        notes,
      });

      // Update with calculated values
      await updateProposal.mutateAsync({
        id: proposal.id,
        total_hours: totalHours,
        calculated_level_id: calculations.level?.id,
        suggested_min_price: calculations.suggestedMinPrice,
        suggested_max_price: calculations.suggestedMaxPrice,
        estimated_cost: calculations.estimatedCost,
        estimated_margin_percent: calculations.estimatedMargin,
      });

      // Save items
      await upsertItems.mutateAsync({
        proposalId: proposal.id,
        items: selectedServices.map(s => ({
          service_id: s.serviceId,
          hours_per_month: s.hours,
        })),
      });

      toast.success('Proposta salva como rascunho');
      navigate(`/altcontrol/proposals/${proposal.id}`);
    } catch (error) {
      // Error handled by hook
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const progressPercent = calculations.level 
    ? Math.min(100, (totalHours / calculations.level.max_hours) * 100)
    : 0;

  const marginStatus = calculations.estimatedMargin >= 30 
    ? 'success' 
    : calculations.estimatedMargin >= 20 
      ? 'warning' 
      : 'danger';

  if (servicesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol/proposals')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Nova Proposta</h2>
            <p className="text-sm text-muted-foreground">Orçamentador Inteligente</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={!canSubmit || createProposal.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Rascunho
            </Button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Scope Selection */}
          <div className="space-y-6">
            {/* Client Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Dados do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-select">Cliente Cadastrado (opcional)</Label>
                  <Select value={clientId} onValueChange={(v) => {
                    setClientId(v);
                    const client = clients?.find(c => c.id === v);
                    if (client) setClientName(client.name);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar cliente existente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-name">Nome do Cliente *</Label>
                  <Input
                    id="client-name"
                    placeholder="Nome do cliente ou empresa"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Service Selection */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Seleção de Escopo</CardTitle>
                <CardDescription>
                  Marque os serviços e defina as horas mensais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {services?.filter(s => s.is_active).map((service) => {
                      const isSelected = selectedServices.some(s => s.serviceId === service.id);
                      const selectedService = selectedServices.find(s => s.serviceId === service.id);
                      const warning = getServiceRestrictionWarning(service);
                      const hasWarning = isSelected && warning;

                      return (
                        <div
                          key={service.id}
                          className={cn(
                            "p-4 rounded-lg border transition-all",
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50",
                            hasWarning && "border-yellow-500 bg-yellow-500/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id={service.id}
                              checked={isSelected}
                              onCheckedChange={() => toggleService(service.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Label
                                  htmlFor={service.id}
                                  className="font-medium cursor-pointer"
                                >
                                  {service.name}
                                </Label>
                                {service.requires_minimum_level && service.minimum_level && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="secondary" className="text-xs">
                                        Mín: {service.minimum_level.name}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Requer mínimo de {service.minimum_level.min_hours}h para liberar
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              {service.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {service.description}
                                </p>
                              )}
                              {hasWarning && (
                                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {warning}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateServiceHours(service.id, (selectedService?.hours || 0) - 5)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={selectedService?.hours || 0}
                                  onChange={(e) => updateServiceHours(service.id, parseInt(e.target.value) || 0)}
                                  className="w-16 h-8 text-center"
                                  min={0}
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateServiceHours(service.id, (selectedService?.hours || 0) + 5)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm text-muted-foreground w-8">h/mês</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Real-time Simulation */}
          <div className="lg:sticky lg:top-6 space-y-6">
            {/* Level Card */}
            <Card className={cn(
              "border-2 transition-all",
              calculations.level ? "border-primary" : "border-dashed"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-primary" />
                    Simulação em Tempo Real
                  </CardTitle>
                  {calculations.level && (
                    <Badge variant="default" className="text-sm px-3 py-1">
                      {calculations.level.name}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Hours Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total de Horas</span>
                    <span className="font-medium">
                      {totalHours}h
                      {calculations.level && ` / ${calculations.level.max_hours}h`}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                  {calculations.level && progressPercent > 85 && (
                    <p className="text-xs text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Próximo do teto do nível
                    </p>
                  )}
                </div>

                <Separator />

                {/* Price Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Preço Mínimo</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(calculations.suggestedMinPrice)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Preço Máximo</p>
                    <p className="text-lg font-semibold text-primary">
                      {formatCurrency(calculations.suggestedMaxPrice)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Cost & Margin */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Custo Estimado</p>
                    <p className="text-lg font-medium">
                      {formatCurrency(calculations.estimatedCost)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Margem Estimada</p>
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-lg font-semibold",
                        marginStatus === 'success' && "text-green-600",
                        marginStatus === 'warning' && "text-yellow-600",
                        marginStatus === 'danger' && "text-red-600"
                      )}>
                        {calculations.estimatedMargin.toFixed(1)}%
                      </p>
                      {marginStatus === 'success' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Alerts */}
                {calculations.level && (
                  <div className="space-y-2 pt-2">
                    {calculations.estimatedMargin < (calculations.level.target_margin_percent || 30) && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <p>
                            <strong>RISCO:</strong> Margem abaixo da meta do nível ({calculations.level.target_margin_percent}%)
                          </p>
                        </div>
                      </div>
                    )}

                    {totalHours > calculations.level.max_hours && (
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-700">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <p>
                            <strong>ALERTA:</strong> Horas acima do teto do nível
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Suggestion to unlock next level */}
                    {levels && calculations.level && (() => {
                      const nextLevel = levels.find(l => l.display_order === calculations.level!.display_order + 1);
                      if (nextLevel && totalHours < nextLevel.min_hours) {
                        const hoursNeeded = nextLevel.min_hours - totalHours;
                        return (
                          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <p>
                                Adicione +{hoursNeeded}h para desbloquear o {nextLevel.name}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Services Summary */}
            {selectedServices.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumo do Escopo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedServices.map(selected => {
                      const service = services?.find(s => s.id === selected.serviceId);
                      if (!service) return null;
                      return (
                        <div key={selected.serviceId} className="flex justify-between text-sm">
                          <span className="truncate">{service.name}</span>
                          <span className="font-medium">{selected.hours}h</span>
                        </div>
                      );
                    })}
                    <Separator className="my-2" />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{totalHours}h/mês</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {selectedServices.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Info className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Selecione os serviços ao lado para<br />ver a simulação em tempo real
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
