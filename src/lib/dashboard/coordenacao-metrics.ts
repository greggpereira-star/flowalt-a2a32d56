// Cálculos do Dashboard da coordenação ("Desempenho do time"). Funções puras.
//
// A pergunta desta tela é "como o time está entregando e para onde vai a capacidade?". O que é
// operação do dia (fila crítica, SLA, carga atual) continua na Coordenação; aqui entram tendência,
// comparação entre pessoas e espaços, tempo em cada etapa, retrabalho e capacidade das próximas semanas.
// Aberto/atrasado vêm de lib/metrics/definicoes (as mesmas de todas as telas).

import {
  diaKey,
  janelaDoPeriodo,
  recortarPor,
  resumoDaJanela,
  serieSemanal,
  type CardRow,
  type Janela,
  type OpcaoPeriodo,
  type Recorte,
  type Resumo,
} from '@/lib/analytics/metrics';
import { ehAberto, ehAtrasado } from '@/lib/metrics/definicoes';

const DIA_MS = 86_400_000;
const TZ = 'America/Sao_Paulo';

export interface EtapaMin {
  slug: string;
  name: string;
  sort_order: number;
  is_final: boolean;
}

export interface TransicaoEtapa {
  card_id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
}

export interface SemanaDoTime {
  semana: string;
  rotulo: string;
  criados: number;
  concluidos: number;
  noPrazoPct: number | null;
}

export interface TempoNaEtapa {
  slug: string;
  nome: string;
  /** Mediana de dias que os cards ficaram na etapa antes de sair dela, dentro do período. */
  mediana: number | null;
  n: number;
}

export interface Volta {
  de: string;
  para: string;
  n: number;
}

export type NivelCapacidade = 'ok' | 'atencao' | 'estouro';

export interface SemanaFutura {
  rotulo: string;
  prazos: number;
  nivel: NivelCapacidade;
}

export interface ResultadoCoordenacao {
  rotuloPeriodo: string;
  time: Resumo;
  anterior: Resumo;
  /** criados − concluídos no período: positivo = a fila está crescendo. */
  saldo: number;
  abertos: number;
  atrasados: number;
  semanal: SemanaDoTime[];
  /** chave = id da pessoa. */
  pessoas: Recorte[];
  tempoPorEtapa: TempoNaEtapa[];
  voltas: { cardsComVolta: number; cardsComMovimento: number; pct: number | null; principais: Volta[] };
  capacidade: { porSemana: number; proximas: SemanaFutura[]; atrasadosNaFila: number };
  /** chave = id do espaço ('__sem__' para card sem espaço). */
  espacos: Recorte[];
}

export interface EntradaCoordenacao {
  todos: CardRow[];
  historico: TransicaoEtapa[];
  etapas: EtapaMin[];
  agora: Date;
  periodo?: OpcaoPeriodo;
  espacoId?: string;
}

const mediana = (valores: number[]): number | null => {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  const m = ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
  return Math.round(m * 10) / 10;
};

const dentro = (iso: string, j: Janela) => new Date(iso) >= j.start && new Date(iso) <= j.end;

/** Segunda-feira (00:00 de São Paulo) da semana de `d`. */
export function segundaDaSemana(d: Date): Date {
  const dia = diaKey(d);
  const base = new Date(`${dia}T12:00:00Z`);
  const dow = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - dow);
  return new Date(`${base.toISOString().slice(0, 10)}T00:00:00-03:00`);
}

const rotuloDia = (d: Date) =>
  d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });

export function calcularCoordenacao({
  todos,
  historico,
  etapas,
  agora,
  periodo = '30d',
  espacoId,
}: EntradaCoordenacao): ResultadoCoordenacao {
  const { atual, anterior, rotulo } = janelaDoPeriodo(periodo, agora);
  const cards = espacoId ? todos.filter(c => c.space_id === espacoId) : todos;
  const idsDosCards = new Set(cards.map(c => c.id));
  const abertos = cards.filter(ehAberto);

  const time = resumoDaJanela(cards, atual);

  // ---- tendência semanal (criados, entregues e % no prazo de cada semana)
  const semanal: SemanaDoTime[] = serieSemanal(cards, agora, 8).map(s => {
    const inicio = new Date(`${s.semana}T00:00:00-03:00`);
    const semana: Janela = { start: inicio, end: new Date(inicio.getTime() + 7 * DIA_MS - 1) };
    return {
      semana: s.semana,
      rotulo: s.rotulo,
      criados: s.criados,
      concluidos: s.concluidos,
      noPrazoPct: resumoDaJanela(cards, semana).noPrazoPct,
    };
  });

  // ---- tempo em cada etapa e voltas no fluxo, pelo histórico de transições
  const porCard = new Map<string, TransicaoEtapa[]>();
  historico
    .filter(h => idsDosCards.has(h.card_id))
    .forEach(h => porCard.set(h.card_id, [...(porCard.get(h.card_id) ?? []), h]));
  porCard.forEach(lista => lista.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

  const duracoes = new Map<string, number[]>();
  porCard.forEach(lista => {
    lista.forEach((entrada, i) => {
      const proxima = lista[i + 1];
      if (!proxima || !dentro(proxima.created_at, atual)) return;
      const dias = (new Date(proxima.created_at).getTime() - new Date(entrada.created_at).getTime()) / DIA_MS;
      if (dias <= 0) return;
      duracoes.set(entrada.to_stage, [...(duracoes.get(entrada.to_stage) ?? []), dias]);
    });
  });
  const ordenadas = [...etapas].sort((a, b) => a.sort_order - b.sort_order);
  const tempoPorEtapa: TempoNaEtapa[] = ordenadas
    .filter(e => !e.is_final)
    .map(e => ({ slug: e.slug, nome: e.name, mediana: mediana(duracoes.get(e.slug) ?? []), n: (duracoes.get(e.slug) ?? []).length }));

  const ordem = new Map(ordenadas.map(e => [e.slug, e.sort_order]));
  const nomeDe = new Map(ordenadas.map(e => [e.slug, e.name]));
  const noPeriodo = historico.filter(h => idsDosCards.has(h.card_id) && dentro(h.created_at, atual));
  const comMovimento = new Set(noPeriodo.map(h => h.card_id));
  const contagemVoltas = new Map<string, number>();
  const comVolta = new Set<string>();
  noPeriodo.forEach(h => {
    if (!h.from_stage) return;
    const de = ordem.get(h.from_stage);
    const para = ordem.get(h.to_stage);
    if (de === undefined || para === undefined || para >= de) return;
    comVolta.add(h.card_id);
    const chave = `${h.from_stage}>${h.to_stage}`;
    contagemVoltas.set(chave, (contagemVoltas.get(chave) ?? 0) + 1);
  });
  const principais: Volta[] = [...contagemVoltas.entries()]
    .map(([chave, n]) => {
      const [de, para] = chave.split('>');
      return { de: nomeDe.get(de) ?? de, para: nomeDe.get(para) ?? para, n };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  // ---- capacidade: entregas por semana (média das 8 últimas semanas fechadas) contra os prazos que vêm
  const fechadas = serieSemanal(cards, agora, 9).slice(0, 8);
  const porSemana = Math.round((fechadas.reduce((s, x) => s + x.concluidos, 0) / Math.max(1, fechadas.length)) * 10) / 10;
  const segunda = segundaDaSemana(agora);
  const proximas: SemanaFutura[] = [0, 1, 2, 3].map(i => {
    const inicio = i === 0 ? agora : new Date(segunda.getTime() + 7 * i * DIA_MS);
    const fim = new Date(segunda.getTime() + 7 * (i + 1) * DIA_MS);
    const prazos = abertos.filter(c => {
      if (!c.due_date) return false;
      const t = new Date(c.due_date).getTime();
      return t >= inicio.getTime() && t < fim.getTime();
    }).length;
    let nivel: NivelCapacidade = 'ok';
    if (prazos > 0 && porSemana === 0) nivel = 'atencao';
    else if (prazos > porSemana * 1.5) nivel = 'estouro';
    else if (prazos > porSemana) nivel = 'atencao';
    return { rotulo: i === 0 ? 'Esta semana' : `Semana de ${rotuloDia(new Date(segunda.getTime() + 7 * i * DIA_MS))}`, prazos, nivel };
  });

  return {
    rotuloPeriodo: rotulo,
    time,
    anterior: resumoDaJanela(cards, anterior),
    saldo: time.criados - time.concluidos,
    abertos: abertos.length,
    atrasados: abertos.filter(c => ehAtrasado(c, agora)).length,
    semanal,
    pessoas: recortarPor(cards, atual, agora, c => c.members),
    tempoPorEtapa,
    voltas: {
      cardsComVolta: comVolta.size,
      cardsComMovimento: comMovimento.size,
      pct: comMovimento.size > 0 ? Math.round((comVolta.size / comMovimento.size) * 100) : null,
      principais,
    },
    capacidade: { porSemana, proximas, atrasadosNaFila: abertos.filter(c => ehAtrasado(c, agora)).length },
    espacos: recortarPor(cards, atual, agora, c => [c.space_id ?? '__sem__']),
  };
}
