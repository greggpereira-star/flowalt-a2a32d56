import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateCard } from '@/hooks/useCards';
import { useClients } from '@/hooks/useClients';
import { useSpaces } from '@/hooks/useSpaces';
import { useDefaultWorkflow, useWorkflowStages } from '@/hooks/useWorkflow';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  FileText, 
  Target,
  Users,
  Package,
  Link,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { BriefingData } from './BriefingForm';

interface DemandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId?: string;
  onSuccess?: (cardId: string) => void;
}

type Step = 'info' | 'briefing' | 'review';

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'info', label: 'Informações', icon: <FileText className="h-4 w-4" /> },
  { key: 'briefing', label: 'Briefing', icon: <Target className="h-4 w-4" /> },
  { key: 'review', label: 'Revisão', icon: <CheckCircle2 className="h-4 w-4" /> },
];

export const DemandFormDialog: React.FC<DemandFormDialogProps> = ({
  open,
  onOpenChange,
  spaceId: defaultSpaceId,
  onSuccess,
}) => {
  const { toast: toastHook } = useToast();
  const createCard = useCreateCard();
  const { data: clients } = useClients();
  const { data: spaces } = useSpaces();
  const { data: defaultWorkflow } = useDefaultWorkflow();
  const { data: stages } = useWorkflowStages(defaultWorkflow?.id);

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('info');
  
  // Form state - Basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState(defaultSpaceId || '');
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  
  // Form state - Briefing
  const [briefingData, setBriefingData] = useState<BriefingData>({
    context: '',
    target_audience: '',
    deliverables: '',
    references: '',
    deadline_notes: '',
    special_instructions: '',
  });

  // Validation
  const isInfoValid = useMemo(() => {
    return title.trim().length > 0 && spaceId.length > 0;
  }, [title, spaceId]);

  const isBriefingValid = useMemo(() => {
    return briefingData.context.trim().length > 0 && 
           briefingData.deliverables.trim().length > 0;
  }, [briefingData]);

  const briefingProgress = useMemo(() => {
    const fields = Object.values(briefingData);
    const filled = fields.filter(f => f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [briefingData]);

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const overallProgress = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Navigation
  const canGoNext = () => {
    if (currentStep === 'info') return isInfoValid;
    if (currentStep === 'briefing') return true; // Briefing is optional
    return true;
  };

  const goNext = () => {
    if (currentStep === 'info' && isInfoValid) {
      setCurrentStep('briefing');
    } else if (currentStep === 'briefing') {
      setCurrentStep('review');
    }
  };

  const goPrev = () => {
    if (currentStep === 'briefing') {
      setCurrentStep('info');
    } else if (currentStep === 'review') {
      setCurrentStep('briefing');
    }
  };

  // Get first stage from workflow for initial placement
  const firstStage = useMemo(() => {
    if (!stages) return null;
    return stages.find(s => s.sort_order === 0) || stages[0];
  }, [stages]);

  // Submit
  const handleSubmit = async () => {
    if (!isInfoValid) {
      toastHook({
        title: 'Erro',
        description: 'Preencha os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createCard.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        space_id: spaceId,
        status: 'backlog', // Start in backlog, briefing is a gate to advance
        urgency: 'medium',
        due_date: dueDate || undefined,
        client_id: clientId || undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        briefing_data: isBriefingValid ? briefingData : undefined,
        briefing_completed: isBriefingValid,
        workflow_id: defaultWorkflow?.id,
        current_stage: firstStage?.id,
      });

      toast.success('Demanda criada com sucesso!', {
        description: isBriefingValid 
          ? 'Card criado com briefing completo.' 
          : 'Card criado. Complete o briefing para avançar.',
      });

      // Reset form
      resetForm();
      onOpenChange(false);
      onSuccess?.(result.id);
    } catch (error) {
      console.error('DemandFormDialog: create failed', error);
      toastHook({
        title: 'Erro',
        description: 'Não foi possível criar a demanda.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setCurrentStep('info');
    setTitle('');
    setDescription('');
    setSpaceId(defaultSpaceId || '');
    setClientId('');
    setDueDate('');
    setEstimatedHours('');
    setBriefingData({
      context: '',
      target_audience: '',
      deliverables: '',
      references: '',
      deadline_notes: '',
      special_instructions: '',
    });
  };

  const updateBriefingField = (field: keyof BriefingData, value: string) => {
    setBriefingData(prev => ({ ...prev, [field]: value }));
  };

  const selectedClient = clients?.find(c => c.id === clientId);
  const selectedSpace = spaces?.find(s => s.id === spaceId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Demanda
          </DialogTitle>
          <DialogDescription>
            Crie uma nova demanda com briefing estruturado
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="space-y-3">
          <Progress value={overallProgress} className="h-1" />
          <div className="flex justify-between">
            {STEPS.map((step, index) => (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  currentStepIndex >= index ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  currentStepIndex > index && "bg-primary text-primary-foreground",
                  currentStepIndex === index && "bg-primary/20 text-primary border border-primary",
                  currentStepIndex < index && "bg-muted text-muted-foreground"
                )}>
                  {currentStepIndex > index ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2">
            {/* Step 1: Basic Info */}
            {currentStep === 'info' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título da Demanda *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Campanha de lançamento produto X"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição Breve</Label>
                  <Textarea
                    id="description"
                    placeholder="Resumo rápido do que precisa ser feito..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Espaço *</Label>
                    <Select value={spaceId} onValueChange={setSpaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar espaço..." />
                      </SelectTrigger>
                      <SelectContent>
                        {spaces?.map((space) => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={clientId} onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Prazo</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hours">Horas Estimadas</Label>
                    <Input
                      id="hours"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Ex: 8"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Briefing */}
            {currentStep === 'briefing' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Progresso do Briefing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={briefingProgress} className="w-20 h-2" />
                    <span className="text-sm text-muted-foreground">{briefingProgress}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Contexto *
                  </Label>
                  <Textarea
                    placeholder="Descreva o contexto do projeto, objetivo principal e informações relevantes..."
                    value={briefingData.context}
                    onChange={(e) => updateBriefingField('context', e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Público-Alvo
                  </Label>
                  <Textarea
                    placeholder="Quem é o público-alvo? Idade, interesses, comportamento..."
                    value={briefingData.target_audience}
                    onChange={(e) => updateBriefingField('target_audience', e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Entregáveis *
                  </Label>
                  <Textarea
                    placeholder="Liste o que precisa ser entregue: formatos, dimensões, quantidade..."
                    value={briefingData.deliverables}
                    onChange={(e) => updateBriefingField('deliverables', e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    Referências
                  </Label>
                  <Textarea
                    placeholder="Links, imagens de inspiração, exemplos de estilo..."
                    value={briefingData.references}
                    onChange={(e) => updateBriefingField('references', e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Observações de Prazo
                    </Label>
                    <Textarea
                      placeholder="Urgências, feriados, eventos..."
                      value={briefingData.deadline_notes}
                      onChange={(e) => updateBriefingField('deadline_notes', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Instruções Especiais
                    </Label>
                    <Textarea
                      placeholder="Restrições, cores proibidas, tom de voz..."
                      value={briefingData.special_instructions}
                      onChange={(e) => updateBriefingField('special_instructions', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 'review' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="font-medium mb-3">Resumo da Demanda</h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Título</span>
                      <span className="font-medium">{title}</span>
                    </div>
                    
                    {description && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Descrição</span>
                        <span className="text-sm max-w-[300px] truncate">{description}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Espaço</span>
                      <span>{selectedSpace?.name || '-'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente</span>
                      <span>{selectedClient?.name || 'Nenhum'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prazo</span>
                      <span>{dueDate || 'Não definido'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horas Estimadas</span>
                      <span>{estimatedHours || 'Não definido'}h</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Status do Briefing</h4>
                    {isBriefingValid ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {Object.entries({
                      'Contexto': briefingData.context,
                      'Público-Alvo': briefingData.target_audience,
                      'Entregáveis': briefingData.deliverables,
                      'Referências': briefingData.references,
                      'Obs. Prazo': briefingData.deadline_notes,
                      'Instruções': briefingData.special_instructions,
                    }).map(([label, value]) => (
                      <div key={label} className="flex items-center gap-2">
                        {value.trim() ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted" />
                        )}
                        <span className={value.trim() ? '' : 'text-muted-foreground'}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {!isBriefingValid && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-600 inline mr-2" />
                    <span className="text-yellow-700 dark:text-yellow-400">
                      O briefing está incompleto. O card será criado mas precisará do briefing para avançar no workflow.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {currentStep !== 'info' && (
              <Button type="button" variant="outline" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {currentStep !== 'review' ? (
              <Button 
                type="button" 
                onClick={goNext}
                disabled={!canGoNext()}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                type="button" 
                onClick={handleSubmit}
                disabled={createCard.isPending}
              >
                {createCard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Demanda
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
