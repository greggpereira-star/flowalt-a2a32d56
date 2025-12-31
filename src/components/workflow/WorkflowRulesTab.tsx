import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  Shield,
  MessageSquare,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { WorkflowStage, WorkflowTransition } from '@/hooks/useWorkflow';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface WorkflowRulesTabProps {
  workflowId: string;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Administrador' },
  { value: 'member', label: 'Membro' },
  { value: 'viewer', label: 'Visualizador' },
];

export function WorkflowRulesTab({ workflowId, stages, transitions }: WorkflowRulesTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    from_stage_id: '',
    to_stage_id: '',
    is_allowed: true,
    requires_reason: false,
    requires_approval: false,
    allowed_roles: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      from_stage_id: '',
      to_stage_id: '',
      is_allowed: true,
      requires_reason: false,
      requires_approval: false,
      allowed_roles: [],
    });
  };

  const handleCreate = async () => {
    if (!formData.from_stage_id || !formData.to_stage_id) {
      toast.error('Selecione as etapas de origem e destino');
      return;
    }

    if (formData.from_stage_id === formData.to_stage_id) {
      toast.error('As etapas devem ser diferentes');
      return;
    }

    // Determine if forward or backward
    const fromStage = stages.find(s => s.id === formData.from_stage_id);
    const toStage = stages.find(s => s.id === formData.to_stage_id);
    const isForward = (fromStage?.sort_order || 0) < (toStage?.sort_order || 0);

    try {
      const { error } = await supabase
        .from('workflow_transitions')
        .insert({
          workflow_id: workflowId,
          from_stage_id: formData.from_stage_id,
          to_stage_id: formData.to_stage_id,
          is_forward: isForward,
          is_backward: !isForward,
          is_allowed: formData.is_allowed,
          requires_reason: formData.requires_reason || !isForward,
          requires_approval: formData.requires_approval,
          allowed_roles: formData.allowed_roles,
        });

      if (error) throw error;
      toast.success('Regra de transição criada');
      queryClient.invalidateQueries({ queryKey: ['workflow-transitions', workflowId] });
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating transition:', error);
      toast.error('Erro ao criar regra');
    }
  };

  const handleToggle = async (transitionId: string, field: 'is_allowed' | 'requires_reason' | 'requires_approval', currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('workflow_transitions')
        .update({ [field]: !currentValue })
        .eq('id', transitionId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['workflow-transitions', workflowId] });
    } catch (error) {
      toast.error('Erro ao atualizar regra');
    }
  };

  const handleDelete = async (transitionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;

    try {
      const { error } = await supabase
        .from('workflow_transitions')
        .delete()
        .eq('id', transitionId);

      if (error) throw error;
      toast.success('Regra excluída');
      queryClient.invalidateQueries({ queryKey: ['workflow-transitions', workflowId] });
    } catch (error) {
      toast.error('Erro ao excluir regra');
    }
  };

  const getStageName = (stageId: string) => {
    return stages.find(s => s.id === stageId)?.name || 'Desconhecido';
  };

  const getStageColor = (stageId: string) => {
    return stages.find(s => s.id === stageId)?.color || '#6366f1';
  };

  // Group transitions by from_stage
  const transitionsByStage = transitions.reduce((acc, t) => {
    const fromStageId = t.from_stage_id;
    if (!acc[fromStageId]) acc[fromStageId] = [];
    acc[fromStageId].push(t);
    return acc;
  }, {} as Record<string, WorkflowTransition[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Regras de Transição</h3>
          <p className="text-sm text-muted-foreground">
            Defina quais transições são permitidas e suas condições
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Regra de Transição</DialogTitle>
              <DialogDescription>
                Defina uma regra para transição entre etapas
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>De (origem)</Label>
                  <Select
                    value={formData.from_stage_id}
                    onValueChange={(value) => setFormData({ ...formData, from_stage_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
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
                  <Label>Para (destino)</Label>
                  <Select
                    value={formData.to_stage_id}
                    onValueChange={(value) => setFormData({ ...formData, to_stage_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
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
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="font-medium text-sm">Transição Permitida</p>
                      <p className="text-xs text-muted-foreground">Esta transição pode ser realizada</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.is_allowed}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_allowed: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Requer Motivo</p>
                      <p className="text-xs text-muted-foreground">Usuário precisa justificar</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.requires_reason}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_reason: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Requer Aprovação</p>
                      <p className="text-xs text-muted-foreground">Precisa aprovação de admin</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.requires_approval}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: checked })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>
                Criar Regra
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transitions Matrix */}
      <div className="space-y-4">
        {stages.map((fromStage) => {
          const stageTransitions = transitionsByStage[fromStage.id] || [];
          
          if (stageTransitions.length === 0) return null;

          return (
            <div key={fromStage.id} className="rounded-lg border">
              <div className="flex items-center gap-3 p-3 bg-muted/50 border-b">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: fromStage.color }}
                />
                <span className="font-medium">{fromStage.name}</span>
                <Badge variant="outline" className="ml-auto">
                  {stageTransitions.length} regras
                </Badge>
              </div>
              <div className="divide-y">
                {stageTransitions.map((transition) => (
                  <div
                    key={transition.id}
                    className="flex items-center gap-4 p-3 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {transition.is_forward ? (
                        <ArrowRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowLeft className="h-4 w-4 text-yellow-500" />
                      )}
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getStageColor(transition.to_stage_id) }}
                      />
                      <span>{getStageName(transition.to_stage_id)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`p-1 rounded cursor-pointer ${
                              transition.is_allowed ? 'text-green-500' : 'text-red-500'
                            }`}
                            onClick={() => handleToggle(transition.id, 'is_allowed', transition.is_allowed)}
                          >
                            {transition.is_allowed ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {transition.is_allowed ? 'Permitida' : 'Bloqueada'}
                        </TooltipContent>
                      </Tooltip>

                      {transition.requires_reason && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="gap-1">
                              <MessageSquare className="h-3 w-3" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Requer motivo</TooltipContent>
                        </Tooltip>
                      )}

                      {transition.requires_approval && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="gap-1">
                              <Shield className="h-3 w-3" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Requer aprovação</TooltipContent>
                        </Tooltip>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(transition.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {transitions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            Nenhuma regra de transição configurada
          </div>
        )}
      </div>
    </div>
  );
}
