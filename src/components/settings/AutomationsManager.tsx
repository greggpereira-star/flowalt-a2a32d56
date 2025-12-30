import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
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
} from 'lucide-react';
import { toast } from 'sonner';

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
];

export function AutomationsManager() {
  const { data: automations, isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_status: '',
    action_type: '',
    target_status: '',
    target_urgency: '',
    comment_text: '',
    notification_title: '',
    notification_message: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_status: '',
      action_type: '',
      target_status: '',
      target_urgency: '',
      comment_text: '',
      notification_title: '',
      notification_message: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.trigger_status || !formData.action_type) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    let action_config: Record<string, string> = {};

    switch (formData.action_type) {
      case 'change_status':
        if (!formData.target_status) {
          toast.error('Selecione o status de destino');
          return;
        }
        action_config = { target_status: formData.target_status };
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
        trigger_status: formData.trigger_status,
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
              <Zap className="h-5 w-5 text-yellow-500" />
              Automações
            </CardTitle>
            <CardDescription>
              Configure ações automáticas quando cards mudam de status
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Automação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Criar Automação</DialogTitle>
                <DialogDescription>
                  Defina uma regra para executar ações automaticamente quando um card atingir determinado status.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da automação *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Notificar quando aprovado"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o que esta automação faz..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quando o card chegar ao status *</Label>
                  <Select
                    value={formData.trigger_status}
                    onValueChange={(value) => setFormData({ ...formData, trigger_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status gatilho" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
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
                    <Label>Mudar para o status</Label>
                    <Select
                      value={formData.target_status}
                      onValueChange={(value) => setFormData({ ...formData, target_status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
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
                      placeholder="Ex: Card movido automaticamente para revisão"
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
                        placeholder="Ex: O card foi aprovado e está pronto para entrega."
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
      </CardHeader>
      <CardContent>
        {automations?.length === 0 ? (
          <EmptyState
            icon={<Zap className="h-12 w-12" />}
            title="Nenhuma automação configurada"
            description="Crie automações para executar ações automaticamente quando cards mudam de status."
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
                      <Badge variant="outline">{getStatusLabel(automation.trigger_status)}</Badge>
                      <ArrowRight className="h-3 w-3" />
                      <Badge variant="outline">{getActionLabel(automation.action_type)}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent>
                      {automation.is_active ? 'Desativar automação' : 'Ativar automação'}
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(automation.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Como funcionam as automações?</p>
              <p>
                As automações são executadas automaticamente quando um card atinge o status configurado. 
                Por exemplo, você pode configurar para enviar uma notificação quando um card for aprovado, 
                ou adicionar um comentário automático quando entrar em revisão.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
