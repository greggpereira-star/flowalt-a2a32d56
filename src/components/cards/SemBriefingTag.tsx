import React from 'react';
import { FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isBriefingSatisfied } from './briefingDataUtils';

// O card pode andar no quadro sem briefing (pedido da equipe), entao a falta precisa ficar visivel em vez de bloquear.
// Existe UMA regra e UM aviso por tela: esta etiqueta (Kanban, tabela e monitor) e o bloco de briefing da ficha.
// A regra e a do fluxo, isBriefingSatisfied: olha o CONTEUDO do briefing, nao a flag briefing_completed.

/** Etapas em que o trabalho ja esta rolando: sem briefing aqui e mais grave do que no backlog, entao a etiqueta fica cheia. */
const ETAPAS_EM_ANDAMENTO = new Set(['in_progress', 'review']);
/** Card concluido ou arquivado nao precisa mais de briefing para ninguem agir; a marca so atrapalharia. */
const ETAPAS_FINAIS = new Set(['delivered', 'archived']);

export const emAndamento = (status?: string | null) => !!status && ETAPAS_EM_ANDAMENTO.has(status);
export const encerrado = (status?: string | null) => !!status && ETAPAS_FINAIS.has(status);

export interface CardParaBriefing {
  status?: string | null;
  card_type?: string | null;
  briefing_data?: unknown;
  traffic_briefing_data?: unknown;
}

export function cardSemBriefing(card: CardParaBriefing): boolean {
  if (encerrado(card.status)) return false;
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
  const forte = emAndamento(card.status);
  return (
    <span
      title={forte ? 'Em execução sem briefing. Pode gerar retrabalho.' : 'Sem briefing. Preencha antes de começar.'}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold leading-none',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs',
        forte
          ? 'bg-amber-500 text-amber-950 shadow-sm'
          : 'bg-amber-500/15 text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300',
        className,
      )}
    >
      <FileWarning className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      Sem briefing
    </span>
  );
}
