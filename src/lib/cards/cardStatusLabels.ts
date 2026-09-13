import type { CardStatus } from '@/lib/supabase';

/**
 * Fonte única dos rótulos de status de card.
 *
 * O nome de uma etapa é vocabulário compartilhado do time, não preferência de
 * cada tela. Enquanto cada arquivo carregava o próprio mapa, o mesmo card era
 * "Em Produção" no Kanban, "Em Progresso" no PDF que ia para o cliente e
 * "Em Andamento" na aba desse mesmo cliente. Três nomes para uma coisa só —
 * e reuniões em que ninguém tinha certeza se estava falando do mesmo card.
 *
 * Os nomes vêm do Kanban porque é ali que o time move o trabalho e combina o
 * que cada etapa significa. Toda tela que mostra status lê daqui: quando o
 * time decidir renomear uma etapa, o cliente passa a ouvir a mesma palavra que
 * o time usa, sem depender de alguém lembrar de atualizar seis arquivos.
 */
export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  backlog: 'Backlog',
  briefing: 'Briefing',
  todo: 'A Fazer',
  in_progress: 'Em Produção',
  review: 'Revisão',
  approved: 'Aprovado',
  delivered: 'Entregue',
  archived: 'Arquivado',
};

/**
 * Rótulos que o time renomeou, publicados por `useStatusLabels` quando o
 * workspace carrega.
 *
 * Existe porque várias telas montam o mapa de status em constante de módulo —
 * avaliada uma vez, no import, antes de qualquer requisição. Trocar todas por
 * props de rótulo seria a solução mais explícita, mas espalharia a mesma prop
 * por dezenas de componentes só para carregar texto. Aqui o padrão continua
 * sendo a fonte, e o override é lido no momento em que a tela desenha.
 *
 * `getCardStatusLabel` é o caminho recomendado: lê o override e cai no padrão
 * quando o time não renomeou nada.
 */
let RUNTIME_STATUS_LABELS: Partial<Record<CardStatus, string>> = {};

export function setRuntimeStatusLabels(labels: Record<CardStatus, string>): void {
  RUNTIME_STATUS_LABELS = labels;
}

/** Mapa atual (padrão + o que o workspace renomeou). */
export function getCardStatusLabels(): Record<CardStatus, string> {
  return { ...CARD_STATUS_LABELS, ...RUNTIME_STATUS_LABELS };
}

/** Ordem do fluxo, do início à entrega. Arquivado fica fora do fluxo. */
export const CARD_STATUS_ORDER: CardStatus[] = [
  'backlog',
  'briefing',
  'todo',
  'in_progress',
  'review',
  'approved',
  'delivered',
];

/**
 * Opções prontas para selects e filtros.
 *
 * Uma tela pode oferecer um subconjunto (o QuickAdd só cria card no começo do
 * fluxo, por exemplo), mas o rótulo de cada opção nunca é reescrito no local.
 */
export const CARD_STATUS_OPTIONS: { value: CardStatus; label: string }[] =
  CARD_STATUS_ORDER.map(value => ({ value, label: CARD_STATUS_LABELS[value] }));

/**
 * Versão tolerante para quando o status chega como string solta (props `any`,
 * dados vindos do banco sem tipagem). Status desconhecido aparece cru em vez
 * de sumir, para que o problema fique visível em vez de virar campo vazio.
 */
export function getCardStatusLabel(status: string): string {
  return (
    RUNTIME_STATUS_LABELS[status as CardStatus] ??
    CARD_STATUS_LABELS[status as CardStatus] ??
    status
  );
}
