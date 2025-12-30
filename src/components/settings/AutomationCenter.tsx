import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  useAutomationLogs,
} from '@/hooks/useAutomations';
import {
  Zap,
  Plus,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  Bell,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  Info,
  Copy,
  CheckSquare,
  Calendar,
  User,
  Tag,
  Clock,
  Filter,
  Wand2,
  FileText,
  MoreVertical,
  ChevronDown,
  History,
  TestTube,
  Settings,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Status options
const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'todo', label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Progresso' },
  { value: 'review', label: 'Revisão' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'delivered', label: 'Entregue' },
];

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

// Trigger types
const TRIGGER_TYPES = [
  { 
    value: 'status_changed', 
    label: 'Status Alterado',
    icon: RefreshCw,
    description: 'Quando um card muda para um status específico',
  },
  { 
    value: 'card_created', 
    label: 'Card Criado',
    icon: Plus,
    description: 'Quando um novo card é criado',
  },
  { 
    value: 'due_date_approaching', 
    label: 'Prazo Próximo',
    icon: Clock,
    description: 'Quando faltam X dias para o prazo',
  },
  { 
    value: 'briefing_completed', 
    label: 'Briefing Completo',
    icon: FileText,
    description: 'Quando o briefing é marcado como completo',
  },
  { 
    value: 'checklist_completed', 
    label: 'Checklist Completo',
    icon: CheckSquare,
    description: 'Quando todos os itens do checklist são concluídos',
  },
];

// Action types
const ACTION_TYPES = [
  {
    value: 'change_status',
    label: 'Mudar Status',
    icon: RefreshCw,
    description: 'Altera automaticamente o status do card',
  },
  {
    value: 'set_urgency',
    label: 'Definir Urgência',
    icon: AlertTriangle,
    description: 'Define o nível de urgência do card',
  },
  {
    value: 'add_comment',
    label: 'Adicionar Comentário',
    icon: MessageSquare,
    description: 'Adiciona um comentário automático ao card',
  },
  {
    value: 'send_notification',
    label: 'Enviar Notificação',
    icon: Bell,
    description: 'Notifica os membros do card',
  },
  {
    value: 'apply_checklist_template',
    label: 'Aplicar Template de Checklist',
    icon: CheckSquare,
    description: 'Adiciona itens de checklist de um template',
  },
  {
    value: 'create_linked_task',
    label: 'Criar Tarefa Vinculada',
    icon: Plus,
    description: 'Cria uma nova tarefa como dependência',
  },
  {
    value: 'create_calendar_event',
    label: 'Criar Evento na Agenda',
    icon: Calendar,
    description: 'Cria um evento no calendário',
  },
  {
    value: 'assign_member',
    label: 'Atribuir Membro',
    icon: User,
    description: 'Atribui automaticamente um responsável',
  },
];

// Condition types
const CONDITION_TYPES = [
  { value: 'urgency_is', label: 'Urgência é', icon: AlertTriangle },
  { value: 'has_tag', label: 'Tem a tag', icon: Tag },
  { value: 'space_is', label: 'Espaço é', icon: Layers },
  { value: 'briefing_complete', label: 'Briefing completo', icon: FileText },
  { value: 'has_deadline', label: 'Tem prazo definido', icon: Clock },
];

// Pre-built templates
const AUTOMATION_TEMPLATES = [
  {
    id: 'designer-flow',
    name: 'Fluxo Designer',
    description: 'Automação padrão para espaço de Design',
    trigger: 'status_changed',
    trigger_config: { status: 'approved' },
    action: 'send_notification',
    action_config: { 
      notification_title: 'Design Aprovado!',
      notification_message: 'O card foi aprovado e está pronto para produção.'
    },
  },
  {
    id: 'traffic-flow',
    name: 'Fluxo Tráfego',
    description: 'Notifica quando briefing de tráfego é completado',
    trigger: 'briefing_completed',
    trigger_config: {},
    action: 'change_status',
    action_config: { target_status: 'todo' },
  },
  {
    id: 'deadline-alert',
    name: 'Alerta de Prazo',
    description: 'Notifica 2 dias antes do prazo',
    trigger: 'due_date_approaching',
    trigger_config: { days_before: 2 },
    action: 'send_notification',
    action_config: {
      notification_title: 'Prazo Próximo',
      notification_message: 'Faltam 2 dias para o prazo deste card.'
    },
  },
  {
    id: 'auto-review',
    name: 'Auto Revisão',
    description: 'Move para revisão quando checklist completo',
    trigger: 'checklist_completed',
    trigger_config: {},
    action: 'change_status',
    action_config: { target_status: 'review' },
  },
];

interface AutomationFormData {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, string | number>;
  conditions: { type: string; value: string }[];
  action_type: string;
  action_config: Record<string, string>;
}

const defaultFormData: AutomationFormData = {
  name: '',
  description: '',
  trigger_type: '',
  trigger_config: {},
  conditions: [],
  action_type: '',
  action_config: {},
};

export function AutomationCenter() {
  const { data: automations, isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();

  const [activeTab, setActiveTab] = useState('automations');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [formData, setFormData] = useState<AutomationFormData>(defaultFormData);
  const [selectedLogAutomation, setSelectedLogAutomation] = useState<string | null>(null);

  const { data: logs } = useAutomationLogs(selectedLogAutomation || undefined);

  const resetForm = () => {
    setFormData(defaultFormData);
    setIsTestMode(false);
  };

  const applyTemplate = (template: typeof AUTOMATION_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      trigger_type: template.trigger,
      trigger_config: template.trigger_config,
      conditions: [],
      action_type: template.action,
      action_config: template.action_config,
    });
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { type: '', value: '' }],
    });
  };

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index: number, field: 'type' | 'value', value: string) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setFormData({ ...formData, conditions: newConditions });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.trigger_type || !formData.action_type) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (isTestMode) {
      // Simulate execution
      toast.success('Teste executado com sucesso! (Simulação)');
      return;
    }

    try {
      // Map to existing API format
      const triggerStatus = formData.trigger_type === 'status_changed' 
        ? (formData.trigger_config.status as string) || 'todo'
        : 'todo';

      await createAutomation.mutateAsync({
        name: formData.name,
        description: formData.description,
        trigger_status: triggerStatus,
        action_type: formData.action_type,
        action_config: formData.action_config,
      });
      
      toast.success('Automação criada com sucesso');
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao criar automação');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await updateAutomation.mutateAsync({ id, is_active: !isActive });
      toast.success(isActive ? 'Automação desativada' : 'Automação ativada');
    } catch (error) {
      toast.error('Erro ao atualizar automação');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAutomation.mutateAsync(id);
      toast.success('Automação excluída');
    } catch (error) {
      toast.error('Erro ao excluir automação');
    }
  };

  const handleDuplicate = (automation: any) => {
    setFormData({
      name: `${automation.name} (cópia)`,
      description: automation.description || '',
      trigger_type: 'status_changed',
      trigger_config: { status: automation.trigger_status },
      conditions: [],
      action_type: automation.action_type,
      action_config: automation.action_config || {},
    });
    setIsDialogOpen(true);
  };

  const getActionLabel = (actionType: string) => {
    return ACTION_TYPES.find((a) => a.value === actionType)?.label || actionType;
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Automation Center
            </CardTitle>
            <CardDescription>
              Configure automações event-driven para seus workflows
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Automação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>
                  {isTestMode ? 'Testar Automação' : 'Criar Automação'}
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6 py-4">
                  {/* Templates */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Templates Prontos</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AUTOMATION_TEMPLATES.map(template => (
                        <Button
                          key={template.id}
                          variant="outline"
                          className="h-auto p-3 justify-start"
                          onClick={() => applyTemplate(template)}
                        >
                          <div className="text-left">
                            <p className="font-medium text-sm">{template.name}</p>
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Name and description */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        placeholder="Ex: Notificar quando aprovado"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        placeholder="Descrição opcional"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Trigger */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <Label className="font-medium">Gatilho (Quando)</Label>
                    </div>
                    <Select
                      value={formData.trigger_type}
                      onValueChange={(v) => setFormData({ ...formData, trigger_type: v, trigger_config: {} })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o gatilho" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPES.map((trigger) => (
                          <SelectItem key={trigger.value} value={trigger.value}>
                            <div className="flex items-center gap-2">
                              <trigger.icon className="h-4 w-4" />
                              <div>
                                <p>{trigger.label}</p>
                                <p className="text-xs text-muted-foreground">{trigger.description}</p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Trigger config */}
                    {formData.trigger_type === 'status_changed' && (
                      <Select
                        value={formData.trigger_config.status as string}
                        onValueChange={(v) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, status: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Quando chegar ao status..." />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {formData.trigger_type === 'due_date_approaching' && (
                      <Input
                        type="number"
                        placeholder="Dias antes do prazo"
                        value={formData.trigger_config.days_before as number || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, days_before: parseInt(e.target.value) }
                        })}
                      />
                    )}
                  </div>

                  {/* Conditions */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-blue-500" />
                        <Label className="font-medium">Condições (Se)</Label>
                      </div>
                      <Button variant="outline" size="sm" onClick={addCondition}>
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>

                    {formData.conditions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma condição (executa sempre)
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {formData.conditions.map((condition, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Select
                              value={condition.type}
                              onValueChange={(v) => updateCondition(idx, 'type', v)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Condição" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_TYPES.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>
                                    <div className="flex items-center gap-2">
                                      <c.icon className="h-3 w-3" />
                                      {c.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Valor"
                              value={condition.value}
                              onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCondition(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-500" />
                      <Label className="font-medium">Ação (Então)</Label>
                    </div>
                    <Select
                      value={formData.action_type}
                      onValueChange={(v) => setFormData({ ...formData, action_type: v, action_config: {} })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a ação" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((action) => (
                          <SelectItem key={action.value} value={action.value}>
                            <div className="flex items-center gap-2">
                              <action.icon className="h-4 w-4" />
                              <div>
                                <p>{action.label}</p>
                                <p className="text-xs text-muted-foreground">{action.description}</p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Action config */}
                    {formData.action_type === 'change_status' && (
                      <Select
                        value={formData.action_config.target_status}
                        onValueChange={(v) => setFormData({
                          ...formData,
                          action_config: { ...formData.action_config, target_status: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mudar para..." />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {formData.action_type === 'set_urgency' && (
                      <Select
                        value={formData.action_config.target_urgency}
                        onValueChange={(v) => setFormData({
                          ...formData,
                          action_config: { ...formData.action_config, target_urgency: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Definir como..." />
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {formData.action_type === 'add_comment' && (
                      <Textarea
                        placeholder="Texto do comentário"
                        value={formData.action_config.comment_text || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          action_config: { ...formData.action_config, comment_text: e.target.value }
                        })}
                      />
                    )}

                    {formData.action_type === 'send_notification' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Título da notificação"
                          value={formData.action_config.notification_title || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            action_config: { ...formData.action_config, notification_title: e.target.value }
                          })}
                        />
                        <Textarea
                          placeholder="Mensagem"
                          value={formData.action_config.notification_message || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            action_config: { ...formData.action_config, notification_message: e.target.value }
                          })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="flex justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="test-mode"
                    checked={isTestMode}
                    onCheckedChange={setIsTestMode}
                  />
                  <Label htmlFor="test-mode" className="text-sm">
                    <TestTube className="h-3 w-3 inline mr-1" />
                    Modo Teste
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={createAutomation.isPending}>
                    {isTestMode ? 'Testar' : createAutomation.isPending ? 'Criando...' : 'Criar'}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="automations">
              <Zap className="h-4 w-4 mr-2" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="logs">
              <History className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="templates">
              <Layers className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="mt-4">
            {automations?.length === 0 ? (
              <EmptyState
                icon={<Zap className="h-12 w-12" />}
                title="Nenhuma automação configurada"
                description="Crie automações para executar ações automaticamente."
                action={
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeira automação
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {automations?.map((automation) => (
                  <div
                    key={automation.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border transition-colors',
                      automation.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'p-2 rounded-lg',
                        automation.is_active ? 'bg-yellow-500/10' : 'bg-muted'
                      )}>
                        <Zap className={cn(
                          'h-5 w-5',
                          automation.is_active ? 'text-yellow-500' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{automation.name}</p>
                          {!automation.is_active && (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{getStatusLabel(automation.trigger_status)}</Badge>
                          <ArrowRight className="h-3 w-3" />
                          <Badge variant="outline">{getActionLabel(automation.action_type)}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={automation.is_active}
                                onCheckedChange={() => handleToggle(automation.id, automation.is_active)}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {automation.is_active ? 'Desativar' : 'Ativar'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(automation)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSelectedLogAutomation(automation.id)}>
                            <History className="h-4 w-4 mr-2" />
                            Ver Logs
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(automation.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Select
                  value={selectedLogAutomation || ''}
                  onValueChange={setSelectedLogAutomation}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Selecionar automação" />
                  </SelectTrigger>
                  <SelectContent>
                    {automations?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedLogAutomation ? (
                <EmptyState
                  icon={<History className="h-8 w-8" />}
                  title="Selecione uma automação"
                  description="Escolha uma automação para ver seu histórico de execuções."
                />
              ) : logs?.length === 0 ? (
                <EmptyState
                  icon={<History className="h-8 w-8" />}
                  title="Nenhum log encontrado"
                  description="Esta automação ainda não foi executada."
                />
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {logs?.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          log.success ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/5 border-destructive/20'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {log.success ? (
                              <CheckSquare className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="text-sm font-medium">
                              {getStatusLabel(log.trigger_status)} → {getActionLabel(log.action_type)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.executed_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AUTOMATION_TEMPLATES.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">
                        {TRIGGER_TYPES.find(t => t.value === template.trigger)?.label}
                      </Badge>
                      <ArrowRight className="h-3 w-3" />
                      <Badge variant="outline">
                        {ACTION_TYPES.find(a => a.value === template.action)?.label}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => {
                        applyTemplate(template);
                        setIsDialogOpen(true);
                      }}
                    >
                      Usar Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
