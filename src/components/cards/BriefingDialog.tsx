import React, { useState } from 'react';
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
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  Package,
  Link2,
  Clock,
  Lightbulb,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);

  const currentStepData = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const updateField = (field: keyof BriefingData, value: string) => {
    onChange({ ...data, [field]: value });
    if (validationError) {
      setValidationError(null);
    }
  };

  const getFieldValue = (field: keyof BriefingData): string => {
    return data[field] || '';
  };

  const isStepComplete = (stepIndex: number): boolean => {
    const step = STEPS[stepIndex];
    const value = getFieldValue(step.field);
    if (step.required) {
      return value.trim().length >= (step.minLength || 1);
    }
    return value.trim().length > 0;
  };

  const requiredStepsComplete = STEPS.filter(s => s.required).every((step, idx) => {
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

  const handleValidateAndComplete = async () => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const { data: result, error } = await supabase.functions.invoke('validate-briefing', {
        body: { briefingData: data }
      });

      if (error) {
        console.error('Validation error:', error);
        toast.error('Erro ao validar briefing');
        setIsValidating(false);
        return;
      }

      if (result.isValid) {
        onMarkComplete();
        toast.success('Briefing validado e completo!');
        onOpenChange(false);
      } else {
        setValidationError(result);
        toast.error('Ajustes necessários');
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast.error('Erro ao validar briefing');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Briefing
              </DialogTitle>
              {cardTitle && (
                <DialogDescription className="text-sm">
                  {cardTitle}
                </DialogDescription>
              )}
            </div>
            {isCompleted && (
              <Badge className="bg-success/20 text-success border-success/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Completo
              </Badge>
            )}
          </div>

          {/* Progress */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium text-primary">{filledSteps} de {STEPS.length}</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        </DialogHeader>

        {/* Step Navigation Pills */}
        <div className="px-6 py-3 border-b bg-background">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isComplete = isStepComplete(idx);

              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isComplete
                        ? 'bg-success/10 text-success hover:bg-success/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {isComplete && !isActive ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                  {step.required && !isComplete && (
                    <span className="text-destructive">*</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Validation Error */}
        {validationError && !validationError.isValid && (
          <div className="mx-6 mt-4 flex gap-3 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
            <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-destructive">Ajustes necessários</p>
              <p className="text-xs text-muted-foreground">
                {validationError.issues?.slice(0, 2).join(" • ")}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1 max-h-[400px]">
          <div className="p-6 space-y-4">
            {/* Current Step Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {React.createElement(currentStepData.icon, { 
                  className: 'h-5 w-5 text-primary' 
                })}
                <h3 className="text-lg font-semibold">{currentStepData.title}</h3>
                {currentStepData.required && (
                  <span className="text-xs text-destructive font-medium">*obrigatório</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{currentStepData.subtitle}</p>
            </div>

            {/* Input Area */}
            <div className="space-y-2">
              <Textarea
                value={getFieldValue(currentStepData.field)}
                onChange={(e) => updateField(currentStepData.field, e.target.value)}
                placeholder={currentStepData.placeholder}
                disabled={disabled}
                className={cn(
                  'min-h-[180px] text-sm resize-none',
                  currentStepData.required && 
                  validationError && 
                  getFieldValue(currentStepData.field).trim().length < (currentStepData.minLength || 1) && 
                  'border-destructive'
                )}
              />
              
              {/* Tip & Counter */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  {currentStepData.tip}
                </p>
                {currentStepData.minLength && (
                  <p className={cn(
                    'text-xs',
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
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <div className="flex items-center gap-2">
            {!isLastStep ? (
              <Button onClick={handleNext} className="gap-1">
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleValidateAndComplete}
                disabled={!requiredStepsComplete || disabled || isValidating || isCompleted}
                className="gap-1.5"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Completo
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Validar e Concluir
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
