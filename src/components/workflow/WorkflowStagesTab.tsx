import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  GripVertical,
  Settings,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Link2,
  Users,
  Pencil,
  Trash2,
  Flag,
  Target,
} from 'lucide-react';
import { WorkflowStage } from '@/hooks/useWorkflow';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface WorkflowStagesTabProps {
  workflowId: string;
  stages: WorkflowStage[];
}

export function WorkflowStagesTab({ workflowId, stages }: WorkflowStagesTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#6366f1',
    icon: 'circle',
    is_initial: false,
    is_final: false,
    requires_briefing: false,
    requires_checklist: false,
    requires_no_dependencies: false,
    min_checklist_progress: 0,
    wip_limit: null as number | null,
    sla_warning_hours: null as number | null,
    sla_critical_hours: null as number | null,
    allow_auto_transition: false,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      color: '#6366f1',
      icon: 'circle',
      is_initial: false,
      is_final: false,
      requires_briefing: false,
      requires_checklist: false,
      requires_no_dependencies: false,
      min_checklist_progress: 0,
      wip_limit: null,
      sla_warning_hours: null,
      sla_critical_hours: null,
      allow_auto_transition: false,
    });
    setEditingStage(null);
  };

  const handleEdit = (stage: WorkflowStage) => {
    setEditingStage(stage);
    setFormData({
      name: stage.name,
      slug: stage.slug,
      description: stage.description || '',
      color: stage.color,
      icon: stage.icon,
      is_initial: stage.is_initial,
      is_final: stage.is_final,
      requires_briefing: stage.requires_briefing,
      requires_checklist: stage.requires_checklist,
      requires_no_dependencies: stage.requires_no_dependencies,
      min_checklist_progress: stage.min_checklist_progress,
      wip_limit: stage.wip_limit,
      sla_warning_hours: stage.sla_warning_hours,
      sla_critical_hours: stage.sla_critical_hours,
      allow_auto_transition: stage.allow_auto_transition,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }

    const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    try {
      if (editingStage) {
        const { error } = await supabase
          .from('workflow_stages')
          .update({
            name: formData.name,
            slug,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon,
            is_initial: formData.is_initial,
            is_final: formData.is_final,
            requires_briefing: formData.requires_briefing,
            requires_checklist: formData.requires_checklist,
            requires_no_dependencies: formData.requires_no_dependencies,
            min_checklist_progress: formData.min_checklist_progress,
            wip_limit: formData.wip_limit,
            sla_warning_hours: formData.sla_warning_hours,
            sla_critical_hours: formData.sla_critical_hours,
            allow_auto_transition: formData.allow_auto_transition,
          })
          .eq('id', editingStage.id);

        if (error) throw error;
        toast.success('Etapa atualizada');
      } else {
        const maxOrder = Math.max(0, ...stages.map(s => s.sort_order));
        const { error } = await supabase
          .from('workflow_stages')
          .insert({
            workflow_id: workflowId,
            name: formData.name,
            slug,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon,
            sort_order: maxOrder + 1,
            is_initial: formData.is_initial,
            is_final: formData.is_final,
            requires_briefing: formData.requires_briefing,
            requires_checklist: formData.requires_checklist,
            requires_no_dependencies: formData.requires_no_dependencies,
            min_checklist_progress: formData.min_checklist_progress,
            wip_limit: formData.wip_limit,
            sla_warning_hours: formData.sla_warning_hours,
            sla_critical_hours: formData.sla_critical_hours,
            allow_auto_transition: formData.allow_auto_transition,
          });

        if (error) throw error;
        toast.success('Etapa criada');
      }

      queryClient.invalidateQueries({ queryKey: ['workflow-stages', workflowId] });
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving stage:', error);
      toast.error('Erro ao salvar etapa');
    }
  };

  const handleDelete = async (stageId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta etapa?')) return;

    try {
      const { error } = await supabase
        .from('workflow_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
      toast.success('Etapa excluída');
      queryClient.invalidateQueries({ queryKey: ['workflow-stages', workflowId] });
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast.error('Erro ao excluir etapa');
    }
  };

  const getStageTypeLabel = (stage: WorkflowStage) => {
    if (stage.is_initial) return { label: 'Inicial', color: 'bg-blue-500/10 text-blue-500' };
    if (stage.is_final) return { label: 'Final', color: 'bg-green-500/10 text-green-500' };
    return null;
  };

  const getGatesBadges = (stage: WorkflowStage) => {
    const gates = [];
    if (stage.requires_briefing) gates.push({ icon: FileText, label: 'Briefing' });
    if (stage.requires_checklist) gates.push({ icon: CheckCircle2, label: 'Checklist' });
    if (stage.requires_no_dependencies) gates.push({ icon: Link2, label: 'Dependências' });
    return gates;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Etapas do Workflow</h3>
          <p className="text-sm text-muted-foreground">
            Configure as etapas e suas regras de entrada (gates)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Etapa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStage ? 'Editar Etapa' : 'Nova Etapa'}
              </DialogTitle>
              <DialogDescription>
                Configure as propriedades e gates desta etapa do workflow
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Em Produção"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="em_producao"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="color">Cor</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Etapa</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={formData.is_initial}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          is_initial: checked, 
                          is_final: checked ? false : formData.is_final 
                        })}
                      />
                      <span className="text-sm">Inicial</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={formData.is_final}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          is_final: checked, 
                          is_initial: checked ? false : formData.is_initial 
                        })}
                      />
                      <span className="text-sm">Final</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Gates Section */}
              <Accordion type="single" collapsible defaultValue="gates">
                <AccordionItem value="gates">
                  <AccordionTrigger className="text-base font-medium">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Gates (Condições de Entrada)
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">Briefing Completo</p>
                            <p className="text-xs text-muted-foreground">Card precisa ter briefing preenchido</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.requires_briefing}
                          onCheckedChange={(checked) => setFormData({ ...formData, requires_briefing: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">Checklist Mínimo</p>
                            <p className="text-xs text-muted-foreground">Checklist precisa estar completo</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.requires_checklist}
                          onCheckedChange={(checked) => setFormData({ ...formData, requires_checklist: checked })}
                        />
                      </div>

                      {formData.requires_checklist && (
                        <div className="ml-7 space-y-2">
                          <Label>Progresso mínimo: {formData.min_checklist_progress}%</Label>
                          <Slider
                            value={[formData.min_checklist_progress]}
                            onValueChange={([value]) => setFormData({ ...formData, min_checklist_progress: value })}
                            max={100}
                            step={10}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">Sem Dependências Ativas</p>
                            <p className="text-xs text-muted-foreground">Card não pode ter dependências bloqueando</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.requires_no_dependencies}
                          onCheckedChange={(checked) => setFormData({ ...formData, requires_no_dependencies: checked })}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="limits">
                  <AccordionTrigger className="text-base font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Limites e SLA
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>WIP Limit (máx. cards)</Label>
                        <Input
                          type="number"
                          placeholder="Sem limite"
                          value={formData.wip_limit || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            wip_limit: e.target.value ? parseInt(e.target.value) : null 
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SLA Warning (horas)</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 24"
                          value={formData.sla_warning_hours || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            sla_warning_hours: e.target.value ? parseInt(e.target.value) : null 
                          })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>SLA Crítico (horas)</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 48"
                          value={formData.sla_critical_hours || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            sla_critical_hours: e.target.value ? parseInt(e.target.value) : null 
                          })}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <Switch
                          checked={formData.allow_auto_transition}
                          onCheckedChange={(checked) => setFormData({ ...formData, allow_auto_transition: checked })}
                        />
                        <Label>Permitir auto-transição</Label>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingStage ? 'Salvar' : 'Criar Etapa'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stages List */}
      <div className="space-y-2">
        {stages.map((stage, index) => {
          const stageType = getStageTypeLabel(stage);
          const gates = getGatesBadges(stage);

          return (
            <div
              key={stage.id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <GripVertical className="h-4 w-4 cursor-grab" />
                <span className="text-sm font-mono w-6">{index + 1}</span>
              </div>

              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{stage.name}</span>
                  {stageType && (
                    <Badge className={stageType.color}>
                      {stageType.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground font-mono">{stage.slug}</span>
                  {gates.length > 0 && (
                    <div className="flex items-center gap-1">
                      {gates.map((gate, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger>
                            <gate.icon className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>{gate.label} obrigatório</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SLA/WIP indicators */}
              <div className="flex items-center gap-2">
                {stage.wip_limit && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        {stage.wip_limit}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>WIP Limit: {stage.wip_limit} cards</TooltipContent>
                  </Tooltip>
                )}
                {stage.sla_warning_hours && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="gap-1 text-yellow-600">
                        <Clock className="h-3 w-3" />
                        {stage.sla_warning_hours}h
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>SLA Warning: {stage.sla_warning_hours}h</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(stage)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(stage.id)}
                  disabled={stage.is_initial || stage.is_final}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}

        {stages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma etapa configurada
          </div>
        )}
      </div>
    </div>
  );
}
