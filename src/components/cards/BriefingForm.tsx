import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { extractPlainText, isRichTextEmpty } from '@/components/ui/rich-text-viewer';
import { BriefingImageUploader } from './BriefingImageUploader';


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
  const contextText = extractPlainText(data.context);
  const deliverablesText = extractPlainText(data.deliverables);
  const isBasicValid = contextText.length >= 10 && deliverablesText.length >= 10;

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
      {/* Validation Error Alert - Compact */}
      {validationError && !validationError.isValid && (
        <div className="flex gap-3 p-3 rounded-xl border-2 border-destructive/50 bg-destructive/10 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-semibold text-destructive text-xs">
              Preencha o briefing corretamente
            </p>
            {/* Only show issues if they exist and are different from the message */}
            {validationError.issues?.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {validationError.issues.slice(0, 2).join(" • ")}
              </p>
            )}
            {/* Show suggestions inline */}
            {validationError.suggestions?.length > 0 && (
              <p className="text-xs text-muted-foreground/80">
                <span className="font-medium">Dica:</span> {validationError.suggestions.slice(0, 2).join(" • ")}
              </p>
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
          <RichTextEditor
            placeholder="Descreva o contexto do projeto, objetivo principal e informações relevantes..."
            value={data.context || ''}
            onChange={(v) => updateField('context', v)}
            disabled={disabled}
            minHeight="80px"
            maxHeight="200px"
          />
          <p className="text-[10px] text-muted-foreground">
            Mínimo 10 caracteres • {contextText.length} caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Público-Alvo</Label>
          <RichTextEditor
            placeholder="Quem é o público-alvo? Idade, interesses, comportamento..."
            value={data.target_audience || ''}
            onChange={(v) => updateField('target_audience', v)}
            disabled={disabled}
            minHeight="60px"
            maxHeight="150px"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1">
            Entregáveis
            <span className="text-destructive">*</span>
          </Label>
          <RichTextEditor
            placeholder="Liste o que precisa ser entregue: formatos, dimensões, quantidade..."
            value={data.deliverables || ''}
            onChange={(v) => updateField('deliverables', v)}
            disabled={disabled}
            minHeight="80px"
            maxHeight="200px"
          />
          <p className="text-[10px] text-muted-foreground">
            Mínimo 10 caracteres • {deliverablesText.length} caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Referências</Label>
          <RichTextEditor
            placeholder="Links, imagens de inspiração, exemplos de estilo..."
            value={data.references || ''}
            onChange={(v) => updateField('references', v)}
            disabled={disabled}
            minHeight="60px"
            maxHeight="150px"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Observações de Prazo</Label>
            <RichTextEditor
              placeholder="Urgências, feriados, eventos importantes..."
              value={data.deadline_notes || ''}
              onChange={(v) => updateField('deadline_notes', v)}
              disabled={disabled}
              minHeight="60px"
              maxHeight="120px"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Instruções Especiais</Label>
            <RichTextEditor
              placeholder="Restrições, cores proibidas, tom de voz..."
              value={data.special_instructions || ''}
              onChange={(v) => updateField('special_instructions', v)}
              disabled={disabled}
              minHeight="60px"
              maxHeight="120px"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
