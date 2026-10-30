import React from 'react';
import { FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isBriefingSatisfied } from './briefingDataUtils';

// O card pode andar no quadro sem briefing (pedido da equipe), entao a falta precisa ficar visivel em vez de bloquear.
// Mesma regra do fluxo (isBriefingSatisfied: olha o CONTEUDO do briefing, nao a flag briefing_completed).

/** Etapas em que o trabalho ja esta rolando: sem briefing aqui e mais grave do que no backlog, entao a marca fica mais forte. */
const ETAPAS_EM_ANDAMENTO = new Set(['in_progress', 'review']);
/** Card concluido ou arquivado nao precisa mais de briefing para ninguem agir; a marca so atrapalharia. */
const ETAPAS_FINAIS = new Set(['delivered', 'archived']);

export interface CardParaBriefing {
  status?: string | null;
  card_type?: string | null;
  briefing_data?: unknown;
  traffic_briefing_data?: unknown;
}

export function cardSemBriefing(card: CardParaBriefing): boolean {
  if (card.status && ETAPAS_FINAIS.has(card.status)) return false;
  return !isBriefingSatisfied(card);
}

interface SemBriefingTagProps {
  card: CardParaBriefing;
  /** Versao menor, para cartao do Kanban e linhas de tabela. */
  compact?: boolean;
  className?: string;
}

/** Etiqueta "Sem briefing": ambar suave no backlog e na fila, ambar cheio quando o card ja esta em producao ou revisao. */
export function SemBriefingTag({ card, compact = false, className }: SemBriefingTagProps) {
  if (!cardSemBriefing(card)) return null;
  const forte = !!card.status && ETAPAS_EM_ANDAMENTO.has(card.status);
  return (
    <span
      title="Este card ainda não tem briefing preenchido"
      aria-label="Card sem briefing"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold leading-none',
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-xs',
        forte
          ? 'bg-amber-500 text-amber-950'
          : 'bg-amber-500/15 text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300',
        className,
      )}
    >
      <FileWarning className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      Sem briefing
    </span>
  );
}

/** Aviso dentro da ficha do card, acima da secao de briefing (que ja tem o botao de preencher logo abaixo). */
export function AvisoSemBriefing({ card }: { card: CardParaBriefing }) {
  if (!cardSemBriefing(card)) return null;
  return (
    <div
      role="status"
      className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Este card ainda não tem briefing</p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
            Ele pode andar no quadro, mas fica marcado como "Sem briefing" até o briefing ser preenchido.
          </p>
        </div>
      </div>
    </div>
  );
}
