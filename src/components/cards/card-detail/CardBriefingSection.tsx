import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  FileWarning,
  CheckCircle2,
  ChevronRight,
  User,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BriefingData {
  context?: string;
  target_audience?: string;
  deliverables?: string;
  references?: string;
  deadline_notes?: string;
  special_instructions?: string;
}

interface CardBriefingSectionProps {
  /** Briefing com conteudo suficiente (a mesma regra do fluxo e da etiqueta do Kanban). */
  isCompleted: boolean;
  briefingData: BriefingData;
  onOpenBriefing: () => void;
  /** Card em producao ou revisao: o aviso sobe de tom (quem executa esta sem escopo). */
  emAndamento?: boolean;
  /** Card entregue ou arquivado: sem alarme, so o convite para ver ou preencher. */
  encerrado?: boolean;
  /** Rotulos dos campos obrigatorios que ainda faltam (ex.: "Contexto"). */
  faltando?: string[];
}

/**
 * Bloco de briefing da ficha. E tambem O aviso de "sem briefing" desta tela: um so bloco, com a acao dentro dele
 * (antes havia um alerta explicativo acima e este bloco logo abaixo, dizendo a mesma coisa).
 */
export const CardBriefingSection: React.FC<CardBriefingSectionProps> = ({
  isCompleted,
  briefingData,
  onOpenBriefing,
  emAndamento = false,
  encerrado = false,
  faltando = [],
}) => {
  const filledFields = Object.values(briefingData).filter(v => v && v.trim()).length;
  const totalFields = 6;
  const alerta = !isCompleted && !encerrado;
  const parcial = filledFields > 0;

  const titulo = isCompleted
    ? 'Briefing Completo'
    : encerrado
      ? 'Sem briefing registrado'
      : emAndamento
        ? 'Em produção sem briefing'
        : parcial
          ? 'Briefing incompleto'
          : 'Briefing pendente';

  const apoio = isCompleted
    ? 'Clique para visualizar ou editar'
    : encerrado
      ? 'Clique para visualizar ou preencher'
      : emAndamento
        ? 'Quem executa está sem escopo definido. Preencha agora para evitar retrabalho.'
        : parcial && faltando.length > 0
          ? `Faltam: ${faltando.join(' e ')}.`
          : 'Preencha antes de começar para evitar retrabalho.';

  const acao = emAndamento ? 'Preencher agora' : parcial ? 'Continuar' : 'Preencher';

  return (
    <button
      type="button"
      onClick={onOpenBriefing}
      className={cn(
        'group w-full rounded-lg border p-4 text-left transition-colors',
        isCompleted && 'border-success/30 bg-success/5 hover:border-success/50',
        encerrado && !isCompleted && 'border-border bg-muted/30 hover:border-border/80',
        alerta && !emAndamento && 'border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50',
        alerta && emAndamento && 'border-amber-500/60 bg-amber-500/15 hover:border-amber-500',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 rounded-lg p-2',
            isCompleted && 'bg-success/10',
            encerrado && !isCompleted && 'bg-muted',
            alerta && !emAndamento && 'bg-amber-500/15',
            alerta && emAndamento && 'bg-amber-500',
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          ) : (
            <FileWarning
              className={cn('h-4 w-4', encerrado ? 'text-muted-foreground' : emAndamento ? 'text-amber-950' : 'text-amber-700 dark:text-amber-300')}
              aria-hidden
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4
              className={cn(
                'text-sm font-semibold',
                isCompleted && 'text-success',
                encerrado && !isCompleted && 'text-muted-foreground',
                alerta && 'text-amber-900 dark:text-amber-200',
              )}
            >
              {titulo}
            </h4>
            {isCompleted && (
              <Badge variant="secondary" className="h-5 border-0 bg-success/10 text-[10px] text-success">
                Validado
              </Badge>
            )}
          </div>

          <p className={cn('mt-0.5 text-xs', alerta ? 'text-amber-900/85 dark:text-amber-200/85' : 'text-muted-foreground')}>{apoio}</p>

          {alerta && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1">
                {Array.from({ length: totalFields }).map((_, i) => (
                  <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < filledFields ? 'bg-amber-500' : 'bg-amber-500/20')} />
                ))}
              </div>
              <span className="text-[11px] tabular-nums text-amber-900/75 dark:text-amber-200/75">
                {filledFields}/{totalFields}
              </span>
            </div>
          )}

          {isCompleted && (briefingData.context || briefingData.target_audience || briefingData.deliverables) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {briefingData.context && (
                <Badge variant="outline" className="h-5 gap-1 border-border/50 text-[10px]">
                  <FileText className="h-2.5 w-2.5" />
                  Contexto
                </Badge>
              )}
              {briefingData.target_audience && (
                <Badge variant="outline" className="h-5 gap-1 border-border/50 text-[10px]">
                  <User className="h-2.5 w-2.5" />
                  Público
                </Badge>
              )}
              {briefingData.deliverables && (
                <Badge variant="outline" className="h-5 gap-1 border-border/50 text-[10px]">
                  <Target className="h-2.5 w-2.5" />
                  Entregáveis
                </Badge>
              )}
            </div>
          )}
        </div>

        {alerta ? (
          // O bloco todo e o botao (nao ha <button> aninhado): isto e o rotulo da acao.
          <span
            className={cn(
              'inline-flex flex-shrink-0 items-center gap-1 self-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              emAndamento
                ? 'bg-amber-500 text-amber-950 group-hover:bg-amber-400'
                : 'border border-amber-500/40 text-amber-900 group-hover:bg-amber-500/10 dark:text-amber-200',
            )}
          >
            {acao}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        )}
      </div>
    </button>
  );
};
