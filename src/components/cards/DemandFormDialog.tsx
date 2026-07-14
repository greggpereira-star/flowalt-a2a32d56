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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateCard, useShareCardAcrossSpaces } from '@/hooks/useCards';
import { useClientCards } from '@/hooks/useClientCards';
import { useSpaces } from '@/hooks/useSpaces';
import { useDefaultWorkflow, useWorkflowStages } from '@/hooks/useWorkflow';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  Copy,
} from 'lucide-react';
import type { BriefingData } from './BriefingForm';

interface DemandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId?: string;
  folderId?: string;
  onSuccess?: (cardId: string) => void;
  isSocialMedia?: boolean;
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
  folderId,
  onSuccess,
  isSocialMedia = false,
}) => {
  const { toast: toastHook } = useToast();
  const createCard = useCreateCard(defaultSpaceId);
  const shareCard = useShareCardAcrossSpaces();
  const { data: clientCards } = useClientCards();
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
  
  // Cross-sector duplication
  const [isDuplicateEnabled, setIsDuplicateEnabled] = useState(false);
  const [duplicateToSpace, setDuplicateToSpace] = useState<string>('');

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
    if (currentStep === 'info') {
      if (!title.trim()) {
        toastHook({
          title: 'Título obrigatório',
          description: 'Informe o título da demanda para continuar.',
          variant: 'destructive',
        });
        document.getElementById('title')?.focus();
        return;
      }
      if (!spaceId) {
        toastHook({
          title: 'Espaço obrigatório',
          description: 'Selecione o espaço onde a demanda será criada.',
          variant: 'destructive',
        });
        return;
      }
      if (isDuplicateEnabled && !duplicateToSpace) {
        toastHook({
          title: 'Selecione o quadro de destino',
          description: 'Você ativou "Duplicar para outro setor" mas não escolheu o quadro.',
          variant: 'destructive',
        });
        return;
      }
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
        folder_id: folderId, // Link to folder if present
        status: 'backlog', // Start in backlog, briefing is a gate to advance
        urgency: 'medium',
        due_date: dueDate || undefined,
        client_id: clientId || undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        briefing_data: isBriefingValid ? briefingData : undefined,
        briefing_completed: isBriefingValid,
        card_type: 'full', // DemandFormDialog always creates full cards with briefing process
        workflow_id: defaultWorkflow?.id,
        current_stage: firstStage?.id,
        duplicate_to_space_id: isDuplicateEnabled && duplicateToSpace ? duplicateToSpace : undefined,
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
    setIsDuplicateEnabled(false);
    setDuplicateToSpace('');
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

  // Use only active clients from client_cards (new system)
  const activeClients = useMemo(() => {
    if (!clientCards) return [];
    return clientCards
      .filter(c => c.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientCards]);

  const selectedClient = activeClients.find(c => c.id === clientId);
  const selectedSpace = spaces?.find(s => s.id === spaceId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[700px] h-[85vh] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Demanda
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Crie uma nova demanda com briefing estruturado
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="px-6 pb-4 flex-shrink-0 space-y-3">
          <Progress value={overallProgress} className="h-1.5" />
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
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                  currentStepIndex > index && "bg-primary text-primary-foreground",
                  currentStepIndex === index && "bg-primary/20 text-primary border-2 border-primary",
                  currentStepIndex < index && "bg-muted text-muted-foreground"
                )}>
                  {currentStepIndex > index ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className="hidden sm:inline font-medium">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-minimal">
          <div className="px-6 pb-6 space-y-5">

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
                        {activeClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div className="flex items-center gap-2">
                              {client.color && (
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: client.color }}
                                />
                              )}
                              {client.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Prazo (data e hora)</Label>
                    <Input
                      id="dueDate"
                      type="datetime-local"
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

                {/* Duplication to other sectors */}
                {true && (
                  <div className="p-4 rounded-xl border-2 border-primary/10 bg-primary/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Copy className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">Duplicar para outro setor</h4>
                          <p className="text-xs text-muted-foreground">Crie uma cópia desta demanda em outro quadro</p>
                        </div>
                      </div>
                      <Switch 
                        checked={isDuplicateEnabled} 
                        onCheckedChange={setIsDuplicateEnabled}
                      />
                    </div>

                    {isDuplicateEnabled && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label className="text-xs font-medium mb-1.5 block">Selecione o Quadro de Destino</Label>
                        <Select value={duplicateToSpace} onValueChange={setDuplicateToSpace}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Escolher setor responsável..." />
                          </SelectTrigger>
                          <SelectContent>
                            {spaces?.filter(s => s.id !== spaceId).map(space => (
                              <SelectItem key={space.id} value={space.id}>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{space.name}</span>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0 uppercase bg-primary/5">
                                      {space.type || 'SETOR'}
                                    </Badge>
                                    <span className="text-[9px] text-muted-foreground">ID: {space.id.substring(0, 8)}</span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
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

        <div className="flex-shrink-0 border-t border-border bg-muted/30">
          <DialogFooter className="px-6 py-4 flex-row justify-between sm:justify-between gap-3">
            <div className="flex-shrink-0">
              {currentStep !== 'info' && (
                <Button type="button" variant="outline" size="default" onClick={goPrev}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button type="button" variant="ghost" size="default" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              
              {currentStep !== 'review' ? (
                <Button 
                  type="button" 
                  size="default"
                  onClick={goNext}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  type="button" 
                  size="default"
                  onClick={handleSubmit}
                  disabled={createCard.isPending || (isDuplicateEnabled && !duplicateToSpace)}
                >
                  {createCard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Demanda
                </Button>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
