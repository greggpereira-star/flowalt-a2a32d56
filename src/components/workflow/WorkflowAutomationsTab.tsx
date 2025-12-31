import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  Zap,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  Bell,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  UserPlus,
  CheckSquare,
} from 'lucide-react';
import { WorkflowStage } from '@/hooks/useWorkflow';
import { useAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation } from '@/hooks/useAutomations';
import { toast } from 'sonner';

interface WorkflowAutomationsTabProps {
  workflowId: string;
  stages: WorkflowStage[];
}

const ACTION_TYPES = [
  {
    value: 'change_status',
    label: 'Mudar Etapa',
    icon: RefreshCw,
    description: 'Move o card para outra etapa',
  },
  {
    value: 'set_urgency',
    label: 'Definir Urgência',
    icon: AlertTriangle,
    description: 'Altera o nível de urgência',
  },
  {
    value: 'add_comment',
    label: 'Adicionar Comentário',
    icon: MessageSquare,
    description: 'Adiciona comentário automático',
  },
  {
    value: 'send_notification',
    label: 'Enviar Notificação',
    icon: Bell,
    description: 'Notifica membros do card',
  },
  {
    value: 'assign_owner',
    label: 'Atribuir Responsável',
    icon: UserPlus,
    description: 'Define responsável automaticamente',
  },
  {
    value: 'create_checklist',
    label: 'Criar Checklist',
    icon: CheckSquare,
    description: 'Adiciona itens de checklist',
  },
];

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

export function WorkflowAutomationsTab({ workflowId, stages }: WorkflowAutomationsTabProps) {
  const { data: automations, isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_stage: '',
    action_type: '',
    target_stage: '',
    target_urgency: '',
    comment_text: '',
    notification_title: '',
    notification_message: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_stage: '',
      action_type: '',
      target_stage: '',
      target_urgency: '',
      comment_text: '',
      notification_title: '',
      notification_message: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.trigger_stage || !formData.action_type) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    let action_config: Record<string, string> = {};

    switch (formData.action_type) {
      case 'change_status':
        if (!formData.target_stage) {
          toast.error('Selecione a etapa de destino');
          return;
        }
        action_config = { target_status: formData.target_stage };
        break;
      case 'set_urgency':
        if (!formData.target_urgency) {
          toast.error('Selecione a urgência de destino');
          return;
        }
        action_config = { target_urgency: formData.target_urgency };
        break;
      case 'add_comment':
        if (!formData.comment_text) {
          toast.error('Digite o texto do comentário');
          return;
        }
        action_config = { comment_text: formData.comment_text };
        break;
      case 'send_notification':
        if (!formData.notification_title || !formData.notification_message) {
          toast.error('Preencha título e mensagem da notificação');
          return;
        }
        action_config = {
          notification_title: formData.notification_title,
          notification_message: formData.notification_message,
        };
        break;
    }

    try {
      await createAutomation.mutateAsync({
        name: formData.name,
        description: formData.description,
        trigger_status: formData.trigger_stage,
        action_type: formData.action_type,
        action_config,
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
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;
    try {
      await deleteAutomation.mutateAsync(id);
      toast.success('Automação excluída');
    } catch (error) {
      toast.error('Erro ao excluir automação');
    }
  };

  const getActionLabel = (actionType: string) => {
    return ACTION_TYPES.find((a) => a.value === actionType)?.label || actionType;
  };

  const getActionIcon = (actionType: string) => {
    return ACTION_TYPES.find((a) => a.value === actionType)?.icon || Zap;
  };

  const getStageName = (stageSlug: string) => {
    return stages.find(s => s.slug === stageSlug)?.name || stageSlug;
  };

  const getStageColor = (stageSlug: string) => {
    return stages.find(s => s.slug === stageSlug)?.color || '#6366f1';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Automações do Workflow</h3>
          <p className="text-sm text-muted-foreground">
            Configure ações automáticas quando cards mudam de etapa
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Automação</DialogTitle>
              <DialogDescription>
                Configure uma ação para executar quando um card entrar em determinada etapa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da automação *</Label>
                <Input
                  placeholder="Ex: Notificar quando aprovado"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o que esta automação faz..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Quando o card entrar na etapa *</Label>
                <Select
                  value={formData.trigger_stage}
                  onValueChange={(value) => setFormData({ ...formData, trigger_stage: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a etapa gatilho" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.slug}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Executar ação *</Label>
                <Select
                  value={formData.action_type}
                  onValueChange={(value) => setFormData({ ...formData, action_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a ação" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        <div className="flex items-center gap-2">
                          <action.icon className="h-4 w-4" />
                          {action.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic fields based on action type */}
              {formData.action_type === 'change_status' && (
                <div className="space-y-2">
                  <Label>Mover para etapa</Label>
                  <Select
                    value={formData.target_stage}
                    onValueChange={(value) => setFormData({ ...formData, target_stage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.slug}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.action_type === 'set_urgency' && (
                <div className="space-y-2">
                  <Label>Definir urgência para</Label>
                  <Select
                    value={formData.target_urgency}
                    onValueChange={(value) => setFormData({ ...formData, target_urgency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a urgência" />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_OPTIONS.map((urgency) => (
                        <SelectItem key={urgency.value} value={urgency.value}>
                          {urgency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.action_type === 'add_comment' && (
                <div className="space-y-2">
                  <Label>Texto do comentário</Label>
                  <Textarea
                    placeholder="Ex: Card movido automaticamente"
                    value={formData.comment_text}
                    onChange={(e) => setFormData({ ...formData, comment_text: e.target.value })}
                  />
                </div>
              )}

              {formData.action_type === 'send_notification' && (
                <>
                  <div className="space-y-2">
                    <Label>Título da notificação</Label>
                    <Input
                      placeholder="Ex: Card aprovado!"
                      value={formData.notification_title}
                      onChange={(e) => setFormData({ ...formData, notification_title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem da notificação</Label>
                    <Textarea
                      placeholder="Ex: O card foi aprovado e está pronto."
                      value={formData.notification_message}
                      onChange={(e) => setFormData({ ...formData, notification_message: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createAutomation.isPending}>
                {createAutomation.isPending ? 'Criando...' : 'Criar Automação'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Automations List */}
      {automations?.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-12 w-12" />}
          title="Nenhuma automação configurada"
          description="Crie automações para executar ações automaticamente quando cards mudam de etapa."
          action={
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira automação
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {automations?.map((automation) => {
            const ActionIcon = getActionIcon(automation.action_type);
            return (
              <div
                key={automation.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  automation.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      automation.is_active ? 'bg-yellow-500/10' : 'bg-muted'
                    }`}
                  >
                    <Zap
                      className={`h-5 w-5 ${
                        automation.is_active ? 'text-yellow-500' : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{automation.name}</p>
                      {!automation.is_active && (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getStageColor(automation.trigger_status) }}
                        />
                        <span>{getStageName(automation.trigger_status)}</span>
                      </div>
                      <ArrowRight className="h-3 w-3" />
                      <div className="flex items-center gap-1">
                        <ActionIcon className="h-3 w-3" />
                        <span>{getActionLabel(automation.action_type)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={automation.is_active}
                      onCheckedChange={() => handleToggle(automation.id, automation.is_active)}
                    />
                    {automation.is_active ? (
                      <Play className="h-4 w-4 text-green-500" />
                    ) : (
                      <Pause className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(automation.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
