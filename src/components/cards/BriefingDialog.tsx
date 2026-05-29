import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { mergeBriefingDataPreservingFilled, normalizeBriefingData } from './briefingDataUtils';

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
  const [localData, setLocalData] = useState<BriefingData>(() => normalizeBriefingData(data));
  const hasUnsavedChanges = useRef(false);
  const localDataRef = useRef(localData);
  const cardIdRef = useRef(cardId);
  const onChangeRef = useRef(onChange);

  useEffect(() => { localDataRef.current = localData; }, [localData]);
  useEffect(() => { cardIdRef.current = cardId; }, [cardId]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Reset local state immediately when switching to a different card, to
  // avoid one card's draft leaking into another (root cause of "context
  // disappearing" after closing a card that had stale localData).
  const lastCardIdRef = useRef(cardId);
  useEffect(() => {
    if (cardId !== lastCardIdRef.current) {
      lastCardIdRef.current = cardId;
      hasUnsavedChanges.current = false;
      const nextData = normalizeBriefingData(data);
      localDataRef.current = nextData;
      setLocalData(nextData);
      return;
    }
    if (open && !hasUnsavedChanges.current) {
      // Merge instead of overwrite — preserves any in-flight edits that may
      // not have round-tripped through props yet.
      setLocalData(prev => {
        const nextData = mergeBriefingDataPreservingFilled(prev, data);
        localDataRef.current = nextData;
        return nextData;
      });
    }
  }, [open, data, cardId]);

  // Debounced auto-save on every change — guarantees content is persisted
  // even if the user closes the modal via outside click, escape, or by
  // closing the whole card sheet, without ever clicking "Próximo".
  useEffect(() => {
    if (!open || !cardId) return;
    if (!hasUnsavedChanges.current) return;
    const t = setTimeout(() => {
      if (hasUnsavedChanges.current && cardIdRef.current) {
        onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
        hasUnsavedChanges.current = false;
      }
    }, 600);
    return () => clearTimeout(t);
  }, [localData, open, cardId]);

  // Also flush when the dialog is closed by the parent card sheet (controlled
  // `open` prop changing to false), not only when Radix calls onOpenChange.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (wasOpenRef.current && !open && hasUnsavedChanges.current && cardIdRef.current) {
      onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
      hasUnsavedChanges.current = false;
    }
    wasOpenRef.current = open;
  }, [open]);

  // Flush any pending edits on unmount (e.g., card sheet closed abruptly).
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges.current && cardIdRef.current) {
        onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
        hasUnsavedChanges.current = false;
      }
    };
  }, []);

  // Save changes when dialog closes. Always flush latest localData via ref
  // to avoid stale-closure issues if the latest keystroke hasn't yet been
  // captured by this callback's closure.
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && cardIdRef.current && hasUnsavedChanges.current) {
      onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
      hasUnsavedChanges.current = false;
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);


  const currentStepData = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const persistLocalData = useCallback(() => {
    if (hasUnsavedChanges.current && cardIdRef.current) {
      onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
      hasUnsavedChanges.current = false;
    }
  }, []);

  const updateField = useCallback((field: keyof BriefingData, value: string) => {
    setLocalData(prev => {
      const nextData = { ...prev, [field]: value };
      // Keep the ref updated synchronously. Closing the modal or clicking
      // "Próximo" can happen before React commits the state update, and that
      // was causing the latest Contexto text to be saved as an empty value.
      localDataRef.current = nextData;
      return nextData;
    });
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
      persistLocalData();
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      persistLocalData();
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
    
    // Save briefing_data + briefing_completed atomically in a single
    // mutation to prevent a race where the second UPDATE arrives before
    // the first and the persisted briefing_data ends up empty.
    onMarkComplete(cardId, normalizeBriefingData(localDataRef.current));
    hasUnsavedChanges.current = false;
    toast.success('Briefing completo!');
    onOpenChange(false);
  }, [requiredStepsComplete, onMarkComplete, onOpenChange, cardId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-2xl h-[90vh] max-h-[800px] p-0 gap-0 flex flex-col overflow-hidden"
      >
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
                  onClick={() => {
                    persistLocalData();
                    setCurrentStep(idx);
                  }}
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
                    onClick={() => {
                      persistLocalData();
                      setShowSummary(true);
                    }}
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
