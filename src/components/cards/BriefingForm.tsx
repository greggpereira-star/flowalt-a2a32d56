import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BriefingData {
  context: string;
  target_audience: string;
  deliverables: string;
  references: string;
  deadline_notes: string;
  special_instructions: string;
}

interface ValidationResult {
  isValid: boolean;
  message: string;
  issues: string[];
  suggestions?: string[];
}

interface BriefingFormProps {
  data: BriefingData;
  onChange: (data: BriefingData) => void;
  isCompleted: boolean;
  onMarkComplete: () => void;
  disabled?: boolean;
}

export const BriefingForm: React.FC<BriefingFormProps> = ({
  data,
  onChange,
  isCompleted,
  onMarkComplete,
  disabled,
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);

  const updateField = (field: keyof BriefingData, value: string) => {
    onChange({ ...data, [field]: value });
    // Clear validation error when user edits
    if (validationError) {
      setValidationError(null);
    }
  };

  const isBasicValid = data.context?.trim().length >= 10 && data.deliverables?.trim().length >= 10;

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
        toast.success('Briefing validado e marcado como completo!');
      } else {
        setValidationError(result);
        toast.error('O briefing precisa de ajustes');
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast.error('Erro ao validar briefing');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Validation Error Alert */}
      {validationError && !validationError.isValid && (
        <div className="flex gap-3 p-4 rounded-xl border-2 border-destructive/50 bg-destructive/10 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-destructive text-sm">
              Briefing precisa de mais detalhes
            </p>
            <p className="text-sm text-muted-foreground">
              {validationError.message}
            </p>
            {validationError.issues?.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                {validationError.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
            {validationError.suggestions?.length > 0 && (
              <div className="pt-2 border-t border-destructive/20">
                <p className="text-xs font-medium text-muted-foreground mb-1">Sugestões:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  {validationError.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-xl border-2',
          isCompleted
            ? 'bg-success/10 border-success/30'
            : 'bg-warning/10 border-warning/30'
        )}
      >
        {isCompleted ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="font-medium text-success">Briefing Completo</p>
              <p className="text-xs text-muted-foreground">
                O card pode avançar para as próximas etapas.
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-warning">Briefing Pendente</p>
              <p className="text-xs text-muted-foreground">
                Preencha os campos obrigatórios (*) com informações detalhadas.
              </p>
            </div>
            <Button
              onClick={handleValidateAndComplete}
              disabled={!isBasicValid || disabled || isValidating}
              size="sm"
              className="gap-1.5"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Validar e Concluir
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1">
            Contexto do Projeto
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            placeholder="Descreva o contexto do projeto, objetivo principal e informações relevantes..."
            value={data.context || ''}
            onChange={(e) => updateField('context', e.target.value)}
            disabled={disabled}
            className={cn(
              "min-h-[100px] text-sm",
              validationError && !data.context?.trim() && "border-destructive"
            )}
          />
          <p className="text-[10px] text-muted-foreground">
            Mínimo 10 caracteres • {data.context?.length || 0} caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Público-Alvo</Label>
          <Textarea
            placeholder="Quem é o público-alvo? Idade, interesses, comportamento..."
            value={data.target_audience || ''}
            onChange={(e) => updateField('target_audience', e.target.value)}
            disabled={disabled}
            className="min-h-[80px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1">
            Entregáveis
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            placeholder="Liste o que precisa ser entregue: formatos, dimensões, quantidade..."
            value={data.deliverables || ''}
            onChange={(e) => updateField('deliverables', e.target.value)}
            disabled={disabled}
            className={cn(
              "min-h-[100px] text-sm",
              validationError && !data.deliverables?.trim() && "border-destructive"
            )}
          />
          <p className="text-[10px] text-muted-foreground">
            Mínimo 10 caracteres • {data.deliverables?.length || 0} caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Referências</Label>
          <Textarea
            placeholder="Links, imagens de inspiração, exemplos de estilo..."
            value={data.references || ''}
            onChange={(e) => updateField('references', e.target.value)}
            disabled={disabled}
            className="min-h-[80px] text-sm"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Observações de Prazo</Label>
            <Textarea
              placeholder="Urgências, feriados, eventos importantes..."
              value={data.deadline_notes || ''}
              onChange={(e) => updateField('deadline_notes', e.target.value)}
              disabled={disabled}
              className="min-h-[60px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Instruções Especiais</Label>
            <Textarea
              placeholder="Restrições, cores proibidas, tom de voz..."
              value={data.special_instructions || ''}
              onChange={(e) => updateField('special_instructions', e.target.value)}
              disabled={disabled}
              className="min-h-[60px] text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
