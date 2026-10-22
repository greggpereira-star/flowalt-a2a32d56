// Regras do modo monitor: quais demandas aparecem no painel do dia e em que ordem. Funcoes puras, testadas.

export type ColunaDoMonitor = 'a_fazer' | 'em_producao' | 'revisao' | 'aprovacao';

export interface CardDoMonitor {
  id: string;
  status: string;
  urgency: string | null;
  due_date: string | null;
  completed_at: string | null;
  owner_id: string | null;
  title: string;
}

export const COLUNAS_DO_MONITOR: { chave: ColunaDoMonitor; rotulo: string; status: string[] }[] = [
  { chave: 'a_fazer', rotulo: 'A fazer', status: ['backlog', 'briefing', 'todo'] },
  { chave: 'em_producao', rotulo: 'Em produção', status: ['in_progress'] },
  { chave: 'revisao', rotulo: 'Revisão', status: ['review'] },
  { chave: 'aprovacao', rotulo: 'Em aprovação', status: ['approved'] },
];

const STATUS_ABERTOS = new Set(COLUNAS_DO_MONITOR.flatMap(c => c.status));

/** Dia (YYYY-MM-DD) no fuso de Sao Paulo, que e o dia de trabalho da equipe. */
export const diaDeSaoPaulo = (data: Date | string): string =>
  new Date(data).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export type Prazo = 'atrasada' | 'hoje' | 'futuro' | 'sem_prazo';

/** Atrasada = prazo (com hora) ja passou; mesma definicao usada nos demais paineis do app. */
export function prazoDe(card: Pick<CardDoMonitor, 'due_date'>, agora: Date): Prazo {
  if (!card.due_date) return 'sem_prazo';
  if (new Date(card.due_date).getTime() < agora.getTime()) return 'atrasada';
  return diaDeSaoPaulo(card.due_date) === diaDeSaoPaulo(agora) ? 'hoje' : 'futuro';
}

const PESO_DO_PRAZO: Record<Prazo, number> = { atrasada: 0, hoje: 1, sem_prazo: 2, futuro: 3 };
const PESO_DA_URGENCIA: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Aparece no painel do dia: aberta e (com prazo hoje ou atrasada, ou ja em andamento). */
export function entraNoPainel(card: CardDoMonitor, agora: Date): boolean {
  if (!STATUS_ABERTOS.has(card.status)) return false;
  if (card.status === 'in_progress') return true;
  const prazo = prazoDe(card, agora);
  return prazo === 'atrasada' || prazo === 'hoje';
}

/** Atrasadas primeiro, depois as de hoje (pela hora), depois as sem prazo; empate pela urgencia e pelo titulo. */
export function compararDemandas(a: CardDoMonitor, b: CardDoMonitor, agora: Date): number {
  const pa = prazoDe(a, agora);
  const pb = prazoDe(b, agora);
  if (pa !== pb) return PESO_DO_PRAZO[pa] - PESO_DO_PRAZO[pb];
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  const ua = PESO_DA_URGENCIA[a.urgency ?? ''] ?? 4;
  const ub = PESO_DA_URGENCIA[b.urgency ?? ''] ?? 4;
  if (ua !== ub) return ua - ub;
  return a.title.localeCompare(b.title, 'pt-BR');
}

export interface AcaoDaDemanda {
  /** Status de destino: o fluxo de trabalho so permite avancar uma etapa por vez. */
  para: string;
  rotulo: string;
}

/**
 * O proximo passo de uma demanda, na mesma ordem do fluxo da agencia (Backlog, A fazer, Em producao, Revisao, Aprovacao,
 * Concluido). Pular etapas e bloqueado pelo fluxo, entao o botao do monitor nunca propoe isso. Entregar e o "finalizar".
 */
export function proximaAcao(status: string): AcaoDaDemanda | null {
  switch (status) {
    case 'backlog':
    case 'briefing':
      return { para: 'todo', rotulo: 'Mover p/ A fazer' };
    case 'todo':
      return { para: 'in_progress', rotulo: 'Iniciar' };
    case 'in_progress':
      return { para: 'review', rotulo: 'Enviar p/ revisão' };
    case 'review':
      return { para: 'approved', rotulo: 'Enviar p/ aprovação' };
    case 'approved':
      return { para: 'delivered', rotulo: 'Entregar' };
    default:
      return null;
  }
}

/** Responsaveis de um card: os vinculados em card_members; sem vinculo, o owner_id (a mesma regra do quadro Kanban). */
export function responsaveisDoCard(card: Pick<CardDoMonitor, 'id' | 'owner_id'>, vinculos: Map<string, string[]>): string[] {
  const vinculados = vinculos.get(card.id);
  if (vinculados && vinculados.length > 0) return vinculados;
  return card.owner_id ? [card.owner_id] : [];
}

export interface EscopoDoResponsavel {
  usuario: string;
  vinculos: Map<string, string[]>;
}

export interface PainelDoDia<T extends CardDoMonitor> {
  colunas: { chave: ColunaDoMonitor; rotulo: string; itens: T[] }[];
  contagem: { pendentes: number; atrasadas: number; feitasHoje: number };
}

export function montarPainelDoDia<T extends CardDoMonitor>(
  cards: T[],
  agora: Date,
  escopo?: EscopoDoResponsavel | null,
): PainelDoDia<T> {
  const doEscopo = escopo ? cards.filter(c => responsaveisDoCard(c, escopo.vinculos).includes(escopo.usuario)) : cards;
  const hoje = diaDeSaoPaulo(agora);

  const colunas = COLUNAS_DO_MONITOR.map(col => ({
    chave: col.chave,
    rotulo: col.rotulo,
    itens: doEscopo
      .filter(c => col.status.includes(c.status) && entraNoPainel(c, agora))
      .sort((a, b) => compararDemandas(a, b, agora)),
  }));

  const visiveis = colunas.flatMap(c => c.itens);
  return {
    colunas,
    contagem: {
      pendentes: visiveis.length,
      atrasadas: visiveis.filter(c => prazoDe(c, agora) === 'atrasada').length,
      feitasHoje: doEscopo.filter(c => c.status === 'delivered' && !!c.completed_at && diaDeSaoPaulo(c.completed_at) === hoje).length,
    },
  };
}
