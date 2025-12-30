import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BriefingData {
  context: string;
  target_audience: string;
  deliverables: string;
  references: string;
  deadline_notes: string;
  special_instructions: string;
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
  const updateField = (field: keyof BriefingData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const isValid = data.context?.trim() && data.deliverables?.trim();

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-lg border',
          isCompleted
            ? 'bg-status-approved/10 border-status-approved/30'
            : 'bg-warning/10 border-warning/30'
        )}
      >
        {isCompleted ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-status-approved" />
            <div>
              <p className="font-medium text-status-approved">Briefing Completo</p>
              <p className="text-sm text-muted-foreground">
                O card pode avançar para as próximas etapas.
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-warning">Briefing Pendente</p>
              <p className="text-sm text-muted-foreground">
                Preencha os campos obrigatórios para avançar.
              </p>
            </div>
            <Button
              onClick={onMarkComplete}
              disabled={!isValid || disabled}
              size="sm"
            >
              Marcar como Completo
            </Button>
          </>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contexto *</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Descreva o contexto do projeto, objetivo principal e informações relevantes..."
              value={data.context || ''}
              onChange={(e) => updateField('context', e.target.value)}
              disabled={disabled}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Público-Alvo</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Quem é o público-alvo? Idade, interesses, comportamento..."
              value={data.target_audience || ''}
              onChange={(e) => updateField('target_audience', e.target.value)}
              disabled={disabled}
              className="min-h-[80px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Entregáveis *</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Liste o que precisa ser entregue: formatos, dimensões, quantidade..."
              value={data.deliverables || ''}
              onChange={(e) => updateField('deliverables', e.target.value)}
              disabled={disabled}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Referências</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Links, imagens de inspiração, exemplos de estilo..."
              value={data.references || ''}
              onChange={(e) => updateField('references', e.target.value)}
              disabled={disabled}
              className="min-h-[80px]"
            />
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Observações de Prazo</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Urgências, feriados, eventos importantes..."
                value={data.deadline_notes || ''}
                onChange={(e) => updateField('deadline_notes', e.target.value)}
                disabled={disabled}
                className="min-h-[60px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Instruções Especiais</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Restrições, cores proibidas, tom de voz..."
                value={data.special_instructions || ''}
                onChange={(e) => updateField('special_instructions', e.target.value)}
                disabled={disabled}
                className="min-h-[60px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
