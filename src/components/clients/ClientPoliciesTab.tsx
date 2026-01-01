import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Settings2, 
  Clock, 
  AlertTriangle, 
  Shield, 
  Mail, 
  Save,
  CheckCircle2,
  XCircle,
  Zap,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { useClientPolicy, useUpsertClientPolicy, useClientUpsellSuggestions, useUpdateUpsellSuggestion, useGenerateUpsellSuggestions, ClientPolicy, UpsellSuggestion } from '@/hooks/useClientPolicies';
import { cn } from '@/lib/utils';

interface ClientPoliciesTabProps {
  clientId: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const UpsellCard: React.FC<{ 
  suggestion: UpsellSuggestion; 
  onAccept: () => void; 
  onReject: () => void;
  isLoading: boolean;
}> = ({ suggestion, onAccept, onReject, isLoading }) => {
  const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
    hours_increase: { icon: Clock, color: 'text-blue-500' },
    scope_expansion: { icon: TrendingUp, color: 'text-green-500' },
    new_service: { icon: Zap, color: 'text-purple-500' },
    contract_upgrade: { icon: TrendingUp, color: 'text-amber-500' },
  };

  const config = typeConfig[suggestion.suggestion_type] || typeConfig.hours_increase;
  const Icon = config.icon;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg bg-primary/10', config.color)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm">{suggestion.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
            {suggestion.potential_revenue_increase && (
              <Badge variant="outline" className="mt-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                +{formatCurrency(suggestion.potential_revenue_increase)} potencial
              </Badge>
            )}
          </div>
        </div>
        {suggestion.status === 'pending' && (
          <div className="flex gap-2 mt-3">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 text-emerald-600 hover:bg-emerald-50"
              onClick={onAccept}
              disabled={isLoading}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Aceitar
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 text-destructive hover:bg-destructive/10"
              onClick={onReject}
              disabled={isLoading}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Rejeitar
            </Button>
          </div>
        )}
        {suggestion.status !== 'pending' && (
          <Badge 
            variant="outline" 
            className={cn(
              'mt-3',
              suggestion.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
            )}
          >
            {suggestion.status === 'accepted' ? 'Aceita' : 'Rejeitada'}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

export function ClientPoliciesTab({ clientId }: ClientPoliciesTabProps) {
  const { data: policy, isLoading: policyLoading } = useClientPolicy(clientId);
  const { data: suggestions = [], isLoading: suggestionsLoading } = useClientUpsellSuggestions(clientId);
  const upsertPolicy = useUpsertClientPolicy();
  const updateSuggestion = useUpdateUpsellSuggestion();
  const generateSuggestions = useGenerateUpsellSuggestions();

  const [formData, setFormData] = useState<Partial<ClientPolicy>>({
    max_monthly_hours: null,
    max_tasks_per_month: null,
    max_budget_per_month: null,
    requires_briefing_approval: false,
    requires_delivery_approval: false,
    hours_alert_threshold: 80,
    budget_alert_threshold: 80,
    margin_alert_threshold: 20,
    auto_pause_on_overdue_payment: false,
    overdue_days_to_pause: 30,
    auto_pause_on_negative_margin: false,
    weekly_report_enabled: true,
    monthly_report_enabled: true,
  });

  useEffect(() => {
    if (policy) {
      setFormData(policy);
    }
  }, [policy]);

  const handleSave = () => {
    upsertPolicy.mutate({ 
      ...formData, 
      client_card_id: clientId 
    });
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const pastSuggestions = suggestions.filter(s => s.status !== 'pending');

  if (policyLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Scope Limits */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Limites de Escopo</CardTitle>
            </div>
            <CardDescription>Define limites mensais para este cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_hours">Horas/mês</Label>
                <Input
                  id="max_hours"
                  type="number"
                  value={formData.max_monthly_hours || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    max_monthly_hours: e.target.value ? parseFloat(e.target.value) : null 
                  }))}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_tasks">Tarefas/mês</Label>
                <Input
                  id="max_tasks"
                  type="number"
                  value={formData.max_tasks_per_month || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    max_tasks_per_month: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_budget">Orçamento/mês</Label>
                <Input
                  id="max_budget"
                  type="number"
                  value={formData.max_budget_per_month || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    max_budget_per_month: e.target.value ? parseFloat(e.target.value) : null 
                  }))}
                  placeholder="Ilimitado"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alert Thresholds */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-base">Alertas</CardTitle>
            </div>
            <CardDescription>Configure quando receber alertas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Alerta de horas em {formData.hours_alert_threshold}%</Label>
                <span className="text-sm text-muted-foreground">{formData.hours_alert_threshold}%</span>
              </div>
              <Slider
                value={[formData.hours_alert_threshold || 80]}
                onValueChange={([v]) => setFormData(prev => ({ ...prev, hours_alert_threshold: v }))}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Alerta de orçamento em {formData.budget_alert_threshold}%</Label>
                <span className="text-sm text-muted-foreground">{formData.budget_alert_threshold}%</span>
              </div>
              <Slider
                value={[formData.budget_alert_threshold || 80]}
                onValueChange={([v]) => setFormData(prev => ({ ...prev, budget_alert_threshold: v }))}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Alerta de margem abaixo de {formData.margin_alert_threshold}%</Label>
                <span className="text-sm text-muted-foreground">{formData.margin_alert_threshold}%</span>
              </div>
              <Slider
                value={[formData.margin_alert_threshold || 20]}
                onValueChange={([v]) => setFormData(prev => ({ ...prev, margin_alert_threshold: v }))}
                max={50}
                step={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-pause Rules */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Regras Automáticas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Pausar com inadimplência</Label>
                <p className="text-xs text-muted-foreground">Pausar cliente automaticamente após dias de atraso</p>
              </div>
              <Switch
                checked={formData.auto_pause_on_overdue_payment}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_pause_on_overdue_payment: checked }))}
              />
            </div>
            {formData.auto_pause_on_overdue_payment && (
              <div className="ml-4 space-y-2">
                <Label>Dias para pausar</Label>
                <Input
                  type="number"
                  value={formData.overdue_days_to_pause || 30}
                  onChange={(e) => setFormData(prev => ({ ...prev, overdue_days_to_pause: parseInt(e.target.value) || 30 }))}
                  className="w-24"
                />
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Pausar com margem negativa</Label>
                <p className="text-xs text-muted-foreground">Pausar automaticamente se lucro for negativo</p>
              </div>
              <Switch
                checked={formData.auto_pause_on_negative_margin}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_pause_on_negative_margin: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Reports */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Relatórios</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Relatório semanal</Label>
              <Switch
                checked={formData.weekly_report_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, weekly_report_enabled: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Relatório mensal</Label>
              <Switch
                checked={formData.monthly_report_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, monthly_report_enabled: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={upsertPolicy.isPending} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {upsertPolicy.isPending ? 'Salvando...' : 'Salvar Políticas'}
        </Button>

        <Separator />

        {/* Upsell Suggestions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Sugestões de Upsell</h3>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateSuggestions.mutate(clientId)}
              disabled={generateSuggestions.isPending}
            >
              <RefreshCw className={cn('w-3 h-3 mr-1', generateSuggestions.isPending && 'animate-spin')} />
              Gerar
            </Button>
          </div>

          {suggestionsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : pendingSuggestions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma sugestão pendente</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clique em "Gerar" para analisar oportunidades
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingSuggestions.map((suggestion) => (
                <UpsellCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => updateSuggestion.mutate({ id: suggestion.id, status: 'accepted' })}
                  onReject={() => updateSuggestion.mutate({ id: suggestion.id, status: 'rejected' })}
                  isLoading={updateSuggestion.isPending}
                />
              ))}
            </div>
          )}

          {pastSuggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Histórico</p>
              {pastSuggestions.slice(0, 3).map((suggestion) => (
                <UpsellCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => {}}
                  onReject={() => {}}
                  isLoading={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
