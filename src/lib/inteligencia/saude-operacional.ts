// Saúde operacional do cliente (Onda 6). NÃO muda a nota de saúde financeira de useClientsHealth: soma sinais
// de operação ao lado dela, cada um com a regra e os números. Funções puras.
import { DIAS_APROVACAO_PARADA, mediana } from '@/lib/inteligencia/risco';

const DIA_MS = 86_400_000;

export const DIAS_APROVACAO_GRAVE = 7;
// Cliente que leva, em mediana, mais que isso para responder uma aprovação (mínimo de amostras abaixo).
export const DIAS_RESPOSTA_LENTA = 5;
export const MIN_RESPOSTAS = 3;
// Cliente com cards abertos e sem nenhuma entrega há mais que isso.
export const DIAS_SEM_ENTREGA = 30;

export interface CardDoCliente {
  id: string;
  client_id: string;
  status: string;
  completed_at: string | null;
}

export interface AprovacaoDoCliente {
  client_id: string | null;
  card_id: string;
  status: string; // pending | approved | changes_requested | expired | canceled
  created_at: string;
  decided_at: string | null;
}

export type SinalCliente =
  | { tipo: 'aprovacao-parada'; quantidade: number; maisAntigaDias: number }
  | { tipo: 'resposta-lenta'; medianaDias: number; amostras: number }
  | { tipo: 'rodadas-acima'; cards: number; limite: number }
  | { tipo: 'sem-entrega'; dias: number };

export interface EntradaSaude {
  agora: Date;
  cards: CardDoCliente[];
  aprovacoes: AprovacaoDoCliente[];
  /** rodadas de ajuste usadas por card (contarRodadas) */
  rodadas: Map<string, number>;
  /** limite contratado por cliente; sem limite definido não gera sinal de rodadas */
  limitePorCliente: Map<string, number>;
  encerrados: readonly string[];
}

export function sinaisPorCliente(e: EntradaSaude): Map<string, SinalCliente[]> {
  const saida = new Map<string, SinalCliente[]>();
  const add = (id: string, s: SinalCliente) => saida.set(id, [...(saida.get(id) ?? []), s]);
  const clientes = new Set<string>(e.cards.map(c => c.client_id));
  e.aprovacoes.forEach(a => a.client_id && clientes.add(a.client_id));

  clientes.forEach(id => {
    const doCliente = e.cards.filter(c => c.client_id === id);
    const abertos = doCliente.filter(c => !e.encerrados.includes(c.status));

    // Aprovações paradas: pedidos pendentes há DIAS_APROVACAO_PARADA dias ou mais.
    const pendentes = e.aprovacoes
      .filter(a => a.client_id === id && a.status === 'pending')
      .map(a => Math.floor((e.agora.getTime() - new Date(a.created_at).getTime()) / DIA_MS))
      .filter(d => d >= DIAS_APROVACAO_PARADA);
    if (pendentes.length) add(id, { tipo: 'aprovacao-parada', quantidade: pendentes.length, maisAntigaDias: Math.max(...pendentes) });

    // Tempo de resposta: mediana entre o envio e a decisão (aprovou ou pediu ajuste).
    const respostas = e.aprovacoes
      .filter(a => a.client_id === id && a.decided_at && (a.status === 'approved' || a.status === 'changes_requested'))
      .map(a => (new Date(a.decided_at!).getTime() - new Date(a.created_at).getTime()) / DIA_MS);
    const med = mediana(respostas);
    if (med != null && respostas.length >= MIN_RESPOSTAS && med > DIAS_RESPOSTA_LENTA) {
      add(id, { tipo: 'resposta-lenta', medianaDias: Math.round(med * 10) / 10, amostras: respostas.length });
    }

    // Rodadas acima do contratado, só em cards abertos e só com limite definido.
    const limite = e.limitePorCliente.get(id);
    if (limite != null) {
      const acima = abertos.filter(c => (e.rodadas.get(c.id) ?? 0) > limite).length;
      if (acima > 0) add(id, { tipo: 'rodadas-acima', cards: acima, limite });
    }

    // Sem entrega: tem trabalho aberto e a última entrega registrada é antiga. Cliente sem nenhuma entrega
    // registrada não entra: não há data para afirmar "há N dias".
    const ultima = doCliente.map(c => c.completed_at).filter((d): d is string => !!d).sort().pop();
    if (abertos.length > 0 && ultima) {
      const dias = Math.floor((e.agora.getTime() - new Date(ultima).getTime()) / DIA_MS);
      if (dias > DIAS_SEM_ENTREGA) add(id, { tipo: 'sem-entrega', dias });
    }
  });
  return saida;
}

export function rotuloSinal(s: SinalCliente): { texto: string; grave: boolean } {
  switch (s.tipo) {
    case 'aprovacao-parada':
      return {
        texto: `${s.quantidade} ${s.quantidade === 1 ? 'aprovação parada' : 'aprovações paradas'} (${s.maisAntigaDias} d)`,
        grave: s.maisAntigaDias >= DIAS_APROVACAO_GRAVE,
      };
    case 'resposta-lenta':
      return { texto: `demora ${s.medianaDias} d para responder (${s.amostras} pedidos)`, grave: false };
    case 'rodadas-acima':
      return {
        texto: `${s.cards} ${s.cards === 1 ? 'peça' : 'peças'} acima de ${s.limite} rodadas`,
        grave: true,
      };
    case 'sem-entrega':
      return { texto: `sem entrega há ${s.dias} d`, grave: false };
  }
}
