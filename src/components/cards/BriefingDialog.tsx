import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  Package,
  Link2,
  Clock,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { BriefingData } from './BriefingForm';

interface ValidationResult {
  isValid: boolean;
  message: string;
  issues: string[];
  suggestions?: string[];
}

interface BriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BriefingData;
  onChange: (data: BriefingData) => void;
  isCompleted: boolean;
  onMarkComplete: () => void;
  disabled?: boolean;
  cardTitle?: string;
}

// Define steps for the wizard
const STEPS = [
  {
    id: 'context',
    title: 'Contexto',
    subtitle: 'O que é o projeto?',
    icon: FileText,
    field: 'context' as keyof BriefingData,
    placeholder: 'Descreva o contexto do projeto, objetivo principal e informações relevantes para quem vai executar...',
    required: true,
    minLength: 10,
    tip: 'Inclua: objetivo, problema a resolver, histórico relevante.',
  },
  {
    id: 'audience',
    title: 'Público-Alvo',
    subtitle: 'Para quem é?',
    icon: Users,
    field: 'target_audience' as keyof BriefingData,
    placeholder: 'Quem é o público-alvo? Descreva idade, interesses, comportamento, dores...',
    required: false,
    tip: 'Quanto mais detalhado, melhor a execução.',
  },
  {
    id: 'deliverables',
    title: 'Entregáveis',
    subtitle: 'O que entregar?',
    icon: Package,
    field: 'deliverables' as keyof BriefingData,
    placeholder: 'Liste o que precisa ser entregue: formatos, dimensões, quantidade, especificações técnicas...',
    required: true,
    minLength: 10,
    tip: 'Ex: "3 posts carrossel 1080x1350, 1 story animado".',
  },
  {
    id: 'references',
    title: 'Referências',
    subtitle: 'Inspirações',
    icon: Link2,
    field: 'references' as keyof BriefingData,
    placeholder: 'Links, imagens de inspiração, exemplos de estilo, tom de comunicação...',
    required: false,
    tip: 'Cole links ou descreva referências visuais.',
  },
  {
    id: 'deadline',
    title: 'Prazos',
    subtitle: 'Observações de tempo',
    icon: Clock,
    field: 'deadline_notes' as keyof BriefingData,
    placeholder: 'Urgências, feriados, eventos importantes, dependências de timing...',
    required: false,
    tip: 'Informe se há data crítica ou evento.',
  },
  {
    id: 'instructions',
    title: 'Instruções',
    subtitle: 'Regras especiais',
    icon: Lightbulb,
    field: 'special_instructions' as keyof BriefingData,
    placeholder: 'Restrições, cores proibidas, tom de voz, do & donts...',
    required: false,
    tip: 'O que NÃO pode acontecer neste projeto.',
  },
];

export const BriefingDialog: React.FC<BriefingDialogProps> = ({
  open,
  onOpenChange,
  data,
  onChange,
  isCompleted,
  onMarkComplete,
  disabled,
  cardTitle,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);
  
  // Use local state for editing to prevent re-renders from parent
  const [localData, setLocalData] = useState<BriefingData>(data);
  const hasUnsavedChanges = useRef(false);

  // Sync local data when dialog opens or external data changes significantly
  useEffect(() => {
    if (open) {
      setLocalData(data);
      hasUnsavedChanges.current = false;
    }
  }, [open, data]);

  // Save changes when dialog closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges.current) {
      onChange(localData);
    }
    onOpenChange(newOpen);
  }, [localData, onChange, onOpenChange]);

  const currentStepData = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const updateField = useCallback((field: keyof BriefingData, value: string) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    hasUnsavedChanges.current = true;
    if (validationError) {
      setValidationError(null);
    }
  }, [validationError]);

  const getFieldValue = useCallback((field: keyof BriefingData): string => {
    return localData[field] || '';
  }, [localData]);

  const isStepComplete = useCallback((stepIndex: number): boolean => {
    const step = STEPS[stepIndex];
    const value = getFieldValue(step.field);
    if (step.required) {
      return value.trim().length >= (step.minLength || 1);
    }
    return value.trim().length > 0;
  }, [getFieldValue]);

  const requiredStepsComplete = STEPS.filter(s => s.required).every((step) => {
    const value = getFieldValue(step.field);
    return value.trim().length >= (step.minLength || 1);
  });

  const filledSteps = STEPS.filter((_, idx) => isStepComplete(idx)).length;
  const progressPercent = (filledSteps / STEPS.length) * 100;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = useCallback(() => {
    if (!requiredStepsComplete) {
      setValidationError({
        isValid: false,
        message: 'Preencha os campos obrigatórios',
        issues: ['Contexto e Entregáveis são obrigatórios']
      });
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    
    // Save all changes before completing
    onChange(localData);
    onMarkComplete();
    toast.success('Briefing completo!');
    onOpenChange(false);
  }, [requiredStepsComplete, localData, onChange, onMarkComplete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl h-[90vh] max-h-[700px] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-xl font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span className="truncate">Briefing</span>
              </DialogTitle>
              {cardTitle && (
                <DialogDescription className="text-xs sm:text-sm truncate">
                  {cardTitle}
                </DialogDescription>
              )}
            </div>
            {isCompleted && (
              <Badge className="bg-success/20 text-success border-success/30 gap-1 flex-shrink-0 text-[10px] sm:text-xs">
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden sm:inline">Completo</span>
              </Badge>
            )}
          </div>

          {/* Progress */}
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[10px] sm:text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium text-primary">{filledSteps} de {STEPS.length}</span>
            </div>
            <Progress value={progressPercent} className="h-1 sm:h-1.5" />
          </div>
        </DialogHeader>

        {/* Step Navigation Pills - Fixed */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 border-b bg-background">
          <ScrollArea className="w-full">
            <div className="flex gap-1 pb-1">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx === currentStep;
                const isComplete = isStepComplete(idx);

                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(idx)}
                    className={cn(
                      'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {isComplete && !isActive ? (
                      <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    ) : (
                      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    )}
                    <span className="hidden xs:inline sm:inline">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Validation Error - Fixed when visible */}
        {validationError && !validationError.isValid && (
          <div className="flex-shrink-0 mx-4 sm:mx-6 mt-3 flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border border-destructive/50 bg-destructive/5">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs sm:text-sm min-w-0">
              <p className="font-medium text-destructive">Campos obrigatórios</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {validationError.issues?.slice(0, 2).join(" • ")}
              </p>
            </div>
          </div>
        )}

        {/* Content - Scrollable, takes remaining space */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            {/* Current Step Header */}
            <div className="space-y-0.5 sm:space-y-1">
              <div className="flex items-center gap-2">
                {React.createElement(currentStepData.icon, { 
                  className: 'h-4 w-4 sm:h-5 sm:w-5 text-primary' 
                })}
                <h3 className="text-base sm:text-lg font-semibold">{currentStepData.title}</h3>
                {currentStepData.required && (
                  <span className="text-[10px] sm:text-xs text-destructive font-medium">*obrigatório</span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">{currentStepData.subtitle}</p>
            </div>

            {/* Input Area */}
            <div className="space-y-2">
              <Textarea
                value={getFieldValue(currentStepData.field)}
                onChange={(e) => updateField(currentStepData.field, e.target.value)}
                placeholder={currentStepData.placeholder}
                disabled={disabled}
                className={cn(
                  'min-h-[140px] sm:min-h-[180px] text-sm resize-none',
                  currentStepData.required && 
                  validationError && 
                  getFieldValue(currentStepData.field).trim().length < (currentStepData.minLength || 1) && 
                  'border-destructive'
                )}
              />
              
              {/* Tip & Counter */}
              <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 flex-shrink-0" />
                  <span>{currentStepData.tip}</span>
                </p>
                {currentStepData.minLength && (
                  <p className={cn(
                    'text-[10px] sm:text-xs flex-shrink-0',
                    getFieldValue(currentStepData.field).length >= currentStepData.minLength
                      ? 'text-success'
                      : 'text-muted-foreground'
                  )}>
                    {getFieldValue(currentStepData.field).length} caracteres
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 flex items-center justify-between gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={isFirstStep}
            size="sm"
            className="gap-1 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          {/* Step indicator for mobile */}
          <div className="flex items-center gap-1 sm:hidden">
            {STEPS.map((_, idx) => (
              <div 
                key={idx}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  idx === currentStep 
                    ? 'bg-primary' 
                    : isStepComplete(idx)
                      ? 'bg-success'
                      : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLastStep ? (
              <Button 
                onClick={handleNext} 
                size="sm"
                className="gap-1 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
              >
                <span>Próximo</span>
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!requiredStepsComplete || disabled || isCompleted}
                size="sm"
                className="gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
              >
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Completo</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Concluir Briefing</span>
                    <span className="sm:hidden">Concluir</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
