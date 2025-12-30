import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface TemplateStep {
  id: string;
  title: string;
  description: string;
  status: string;
  estimatedHours?: number;
}

interface TemplateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { value: 'juridico', label: 'Jurídico' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'contencioso', label: 'Contencioso' },
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'outro', label: 'Outro' },
];

const CARD_STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'review', label: 'Revisão' },
  { value: 'done', label: 'Concluído' },
];

export function TemplateWizard({ open, onOpenChange, onSuccess }: TemplateWizardProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [steps, setSteps] = useState<TemplateStep[]>([
    { id: crypto.randomUUID(), title: '', description: '', status: 'todo' },
  ]);

  const resetForm = () => {
    setStep(1);
    setName('');
    setDescription('');
    setCategory('');
    setEstimatedDuration('');
    setSteps([{ id: crypto.randomUUID(), title: '', description: '', status: 'todo' }]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Missing context');

      const { error } = await supabase.from('process_templates').insert([{
        workspace_id: currentWorkspace.id,
        name,
        description: description || null,
        category: category || null,
        estimated_duration_hours: estimatedDuration ? parseFloat(estimatedDuration) : null,
        steps: JSON.parse(JSON.stringify(steps.filter(s => s.title.trim()))),
        created_by: user.id,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-templates'] });
      toast.success('Template criado com sucesso!');
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: () => toast.error('Erro ao criar template'),
  });

  const addStep = () => {
    setSteps([...steps, { 
      id: crypto.randomUUID(), 
      title: '', 
      description: '', 
      status: 'todo' 
    }]);
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(s => s.id !== id));
    }
  };

  const updateStep = (id: string, field: keyof TemplateStep, value: string | number) => {
    setSteps(steps.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const canProceedStep1 = name.trim() && category;
  const canProceedStep2 = steps.some(s => s.title.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Criar Template de Processo'}
            {step === 2 && 'Definir Etapas do Processo'}
            {step === 3 && 'Revisar e Confirmar'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Defina as informações básicas do template.'}
            {step === 2 && 'Adicione as etapas que compõem o processo.'}
            {step === 3 && 'Revise as informações antes de criar.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                s === step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : s < step
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-muted bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                placeholder="Ex: Processo Trabalhista Padrão"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva o propósito e uso deste template..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="duration">Duração Estimada (horas)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="Ex: 40"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Process Steps */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            {steps.map((processStep, index) => (
              <div 
                key={processStep.id}
                className="flex gap-2 p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 grid gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">
                      Etapa {index + 1}
                    </Badge>
                    <Input
                      placeholder="Título da etapa"
                      value={processStep.title}
                      onChange={(e) => updateStep(processStep.id, 'title', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Descrição (opcional)"
                      value={processStep.description}
                      onChange={(e) => updateStep(processStep.id, 'description', e.target.value)}
                    />
                    <Select 
                      value={processStep.status} 
                      onValueChange={(v) => updateStep(processStep.id, 'status', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARD_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeStep(processStep.id)}
                  disabled={steps.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            
            <Button variant="outline" onClick={addStep} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Etapa
            </Button>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Nome:</span>
                <p className="font-medium">{name}</p>
              </div>
              {description && (
                <div>
                  <span className="text-sm text-muted-foreground">Descrição:</span>
                  <p>{description}</p>
                </div>
              )}
              <div className="flex gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Categoria:</span>
                  <p>
                    <Badge variant="secondary">
                      {CATEGORIES.find(c => c.value === category)?.label}
                    </Badge>
                  </p>
                </div>
                {estimatedDuration && (
                  <div>
                    <span className="text-sm text-muted-foreground">Duração:</span>
                    <p>{estimatedDuration}h</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">
                Etapas ({steps.filter(s => s.title.trim()).length}):
              </span>
              <div className="mt-2 space-y-2">
                {steps.filter(s => s.title.trim()).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
                    <span>{s.title}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {CARD_STATUSES.find(st => st.value === s.status)?.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {step < 3 ? (
              <Button 
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Criando...' : 'Criar Template'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
