import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

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
  Eye,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { BriefingData } from './BriefingForm';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { extractPlainText } from '@/components/ui/rich-text-viewer';
import { BriefingSummarySheet } from './BriefingSummarySheet';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useForm } from 'react-hook-form';

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
  onChange: (data: BriefingData, cardId?: string) => void;
  isCompleted: boolean;
  onMarkComplete: (cardId?: string, briefingDataOverride?: BriefingData) => void;
  disabled?: boolean;
  cardTitle?: string;
  cardId?: string;
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
  cardId,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      // Cmd/Ctrl + Shift + V to open summary
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
        e.preventDefault();
        setShowSummary(true);
      }
      // Cmd/Ctrl + Enter to go next or complete
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !showSummary) {
        e.preventDefault();
        if (currentStep < STEPS.length - 1) {
          setCurrentStep(prev => prev + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentStep, showSummary]);

  // Function to handle edit from summary
  const handleEditFromSummary = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
    setShowSummary(false);
  }, []);
  
  // Use local state for editing to prevent re-renders from parent
  const [localData, setLocalData] = useState<BriefingData>(data);
  const hasUnsavedChanges = useRef(false);

  // Persistence setup
  const formForPersistence = useForm<BriefingData>({
    values: localData
  });

  const { clearPersistence } = useFormPersistence(
    formForPersistence,
    cardId ? `briefing-draft-${cardId}` : 'briefing-draft-disabled',
    open && !!cardId,
    (loadedData) => {
      setLocalData(prev => ({ ...prev, ...loadedData }));
      hasUnsavedChanges.current = true;
    }
  );

  // Keep persistence form in sync with local data
  useEffect(() => {
    if (hasUnsavedChanges.current) {
      formForPersistence.reset(localData);
    }
  }, [localData, formForPersistence]);

  // Sync local data when dialog opens or external data changes significantly
  useEffect(() => {
    if (open && !hasUnsavedChanges.current) {
      setLocalData(data);
      hasUnsavedChanges.current = false;
    }
  }, [open, data, cardId]);

  // Save changes when dialog closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges.current && cardId) {
      onChange(localData, cardId);
    }
    onOpenChange(newOpen);
  }, [cardId, localData, onChange, onOpenChange]);

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
    const plainText = extractPlainText(value);
    if (step.required) {
      return plainText.length >= (step.minLength || 1);
    }
    return plainText.length > 0;
  }, [getFieldValue]);

  const requiredStepsComplete = STEPS.filter(s => s.required).every((step) => {
    const value = getFieldValue(step.field);
    const plainText = extractPlainText(value);
    return plainText.length >= (step.minLength || 1);
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
    if (!cardId) {
      toast.error('Card ainda não carregado. Abra o briefing novamente.');
      return;
    }

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
    onChange(localData, cardId);
    onMarkComplete(cardId);
    clearPersistence();
    toast.success('Briefing completo!');
    onOpenChange(false);
  }, [requiredStepsComplete, localData, onChange, onMarkComplete, onOpenChange, cardId, clearPersistence]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl h-[90vh] max-h-[800px] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b bg-background">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-xl font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span>Briefing</span>
              </DialogTitle>

              {cardTitle && (
                <DialogDescription className="mt-1 text-xs sm:text-sm text-muted-foreground leading-snug break-words">
                  {cardTitle}
                </DialogDescription>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Passo atual:</span>
                <span className="text-foreground">{currentStepData.title}</span>
                <span className="hidden sm:inline">— {currentStepData.subtitle}</span>
              </div>
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

        {/* Step Navigation - wrap (no truncation) */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b bg-background">
          <div className="flex flex-wrap gap-2">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isComplete = isStepComplete(idx);

              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors max-w-full',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isComplete
                        ? 'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {isComplete && !isActive ? (
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <span className="break-words">{step.title}</span>
                  {step.required && !isComplete && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </button>
              );
            })}
          </div>
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

            {/* Input Area - Increased height */}
            <div className="space-y-2">
              <RichTextEditor
                key={`${cardId || 'no-card'}-${currentStepData.field}`}
                value={getFieldValue(currentStepData.field)}
                onChange={(v) => updateField(currentStepData.field, v)}
                placeholder={currentStepData.placeholder}
                disabled={disabled}
                minHeight="180px"
                maxHeight="400px"
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
                    extractPlainText(getFieldValue(currentStepData.field)).length >= currentStepData.minLength
                      ? 'text-success'
                      : 'text-muted-foreground'
                  )}>
                    {extractPlainText(getFieldValue(currentStepData.field)).length} caracteres
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
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
            
            {/* View Summary Button - Enhanced */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => setShowSummary(true)}
                    size="sm"
                    className="gap-1.5 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Ver Resumo</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium ml-1">
                      {filledSteps}/{STEPS.length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Ver briefing completo (Ctrl+Shift+V)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

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

        {/* Briefing Summary Sheet */}
        <BriefingSummarySheet
          open={showSummary}
          onOpenChange={setShowSummary}
          data={localData}
          isCompleted={isCompleted}
          cardTitle={cardTitle}
          onEditStep={handleEditFromSummary}
        />
      </DialogContent>
    </Dialog>
  );
};
