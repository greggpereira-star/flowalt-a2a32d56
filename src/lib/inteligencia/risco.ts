// Radar de risco (Onda 6). Funções puras que ENRIQUECEM o avaliador de atenção da Coordenação
// (lib/coordination/coordMetrics) com sinais que ele não tem: tempo na etapa vs. mediana histórica,
// carga do responsável e aprovação do cliente parada. Nenhum modelo de linguagem: toda sugestão
// traz a regra e os números que a geraram.
import {
  type CardEmAtencao,
  type Problema,
} from '@/lib/coordination/coordMetrics';

const DIA_MS = 86_400_000;

export interface Transicao {
  card_id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
}

// Mínimo de passagens históricas para a mediana valer; abaixo disso o sinal fica calado.
export const MIN_AMOSTRAS = 5;
// "Lento" = passou do dobro da mediana e de pelo menos 2 dias (evita alarme em etapa que costuma durar horas).
export const FATOR_LENTO = 2;
export const PISO_LENTO_DIAS = 2;
// Responsável com mais de N cards abertos é considerado sobrecarregado.
export const LIMITE_CARGA = 8;
// Aprovação enviada e sem resposta do cliente há mais de N dias.
export const DIAS_APROVACAO_PARADA = 3;

export interface PedidoPendente {
  card_id: string;
  enviado_em: string;
}

export type ProblemaRisco =
  | Problema
  | { tipo: 'lento-historico'; etapa: string; dias: number; medianaDias: number; amostras: number }
  | { tipo: 'sobrecarga'; abertos: number; limite: number }
  | { tipo: 'aprovacao-parada'; dias: number }
  | { tipo: 'rodadas'; rodadas: number; limite: number };

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Dias que cada passagem concluída ficou em cada etapa, agrupados por slug da etapa. */
export function duracoesPorEtapa(transicoes: Transicao[]): Map<string, number[]> {
  const porCard = new Map<string, Transicao[]>();
  transicoes.forEach(t => porCard.set(t.card_id, [...(porCard.get(t.card_id) ?? []), t]));
  const saida = new Map<string, number[]>();
  porCard.forEach(lista => {
    lista.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 0; i + 1 < lista.length; i++) {
      const etapa = lista[i].to_stage;
      const dias = (new Date(lista[i + 1].created_at).getTime() - new Date(lista[i].created_at).getTime()) / DIA_MS;
      if (dias < 0) continue;
      saida.set(etapa, [...(saida.get(etapa) ?? []), dias]);
    }
  });
  return saida;
}

export interface ContextoRisco {
  agora: Date;
  duracoes: Map<string, number[]>;
  /** nome legível por slug da etapa, para a explicação */
  nomeEtapa: (slug: string) => string;
  /** cards abertos por pessoa */
  abertosPorPessoa: Map<string, number>;
  pendentes: PedidoPendente[];
  /** rodadas de ajuste já usadas por card (ver contarRodadas) */
  rodadas?: Map<string, number>;
  /** limite de rodadas contratado por cliente; cliente sem limite definido não gera alerta */
  limitePorCliente?: Map<string, number>;
}

export interface CardComRisco extends Omit<CardEmAtencao, 'problemas'> {
  problemas: ProblemaRisco[];
}

const PONTOS = { lento: 2, sobrecarga: 1, aprovacao: 2, rodadaNoLimite: 1, rodadaAcima: 3 } as const;

export function enriquecerRisco(avaliados: CardEmAtencao[], ctx: ContextoRisco): CardComRisco[] {
  const pendPorCard = new Map<string, PedidoPendente>();
  ctx.pendentes.forEach(p => {
    const atual = pendPorCard.get(p.card_id);
    if (!atual || p.enviado_em < atual.enviado_em) pendPorCard.set(p.card_id, p);
  });

  return avaliados.map(a => {
    const problemas: ProblemaRisco[] = [...a.problemas];
    let pontos = a.pontos;
    const { card } = a;

    if (card.current_stage && card.stage_entered_at) {
      const amostras = ctx.duracoes.get(card.current_stage) ?? [];
      const med = mediana(amostras);
      const dias = (ctx.agora.getTime() - new Date(card.stage_entered_at).getTime()) / DIA_MS;
      const jaTemSla = a.problemas.some(p => p.tipo === 'sla-critico' || p.tipo === 'sla-aviso');
      if (!jaTemSla && med != null && amostras.length >= MIN_AMOSTRAS && dias >= PISO_LENTO_DIAS && dias > FATOR_LENTO * med) {
        problemas.push({
          tipo: 'lento-historico',
          etapa: ctx.nomeEtapa(card.current_stage),
          dias: Math.floor(dias),
          medianaDias: Math.round(med * 10) / 10,
          amostras: amostras.length,
        });
        pontos += PONTOS.lento;
      }
    }

    const maior = Math.max(0, ...a.responsaveis.map(id => ctx.abertosPorPessoa.get(id) ?? 0));
    if (maior > LIMITE_CARGA) {
      problemas.push({ tipo: 'sobrecarga', abertos: maior, limite: LIMITE_CARGA });
      pontos += PONTOS.sobrecarga;
    }

    const pend = pendPorCard.get(card.id);
    if (pend) {
      const dias = Math.floor((ctx.agora.getTime() - new Date(pend.enviado_em).getTime()) / DIA_MS);
      if (dias >= DIAS_APROVACAO_PARADA) {
        problemas.push({ tipo: 'aprovacao-parada', dias });
        pontos += PONTOS.aprovacao;
      }
    }

    const limite = card.client_id ? ctx.limitePorCliente?.get(card.client_id) : undefined;
    const usadas = ctx.rodadas?.get(card.id) ?? 0;
    if (limite != null && usadas >= limite && usadas > 0) {
      problemas.push({ tipo: 'rodadas', rodadas: usadas, limite });
      pontos += usadas > limite ? PONTOS.rodadaAcima : PONTOS.rodadaNoLimite;
    }

    return { ...a, problemas, pontos };
  });
}

/**
 * Rodadas de ajuste de cada card = a maior contagem entre (a) pedidos de ajuste do cliente nas aprovações e
 * (b) voltas internas de Revisão/Aprovação para Produção/Planejamento. Usa o maior, e não a soma, porque um
 * pedido do cliente costuma gerar também uma volta de etapa: somar contaria a mesma rodada duas vezes.
 */
export function contarRodadas(
  voltasDeEtapa: { card_id: string }[],
  ajustesDoCliente: { card_id: string }[]
): Map<string, number> {
  const conta = (linhas: { card_id: string }[]) => {
    const m = new Map<string, number>();
    linhas.forEach(l => m.set(l.card_id, (m.get(l.card_id) ?? 0) + 1));
    return m;
  };
  const a = conta(voltasDeEtapa);
  const b = conta(ajustesDoCliente);
  const saida = new Map<string, number>();
  new Set([...a.keys(), ...b.keys()]).forEach(id => saida.set(id, Math.max(a.get(id) ?? 0, b.get(id) ?? 0)));
  return saida;
}

/** Texto da explicação; a UI só mostra, nunca recalcula. */
export function rotuloRisco(p: ProblemaRisco): { texto: string; grave: boolean } | null {
  switch (p.tipo) {
    case 'lento-historico':
      return {
        texto: `${p.dias} d em "${p.etapa}", mediana histórica ${p.medianaDias} d (${p.amostras} passagens)`,
        grave: false,
      };
    case 'sobrecarga':
      return { texto: `responsável com ${p.abertos} cards abertos (limite ${p.limite})`, grave: false };
    case 'aprovacao-parada':
      return { texto: `cliente sem responder há ${p.dias} d`, grave: p.dias >= 7 };
    case 'rodadas':
      return p.rodadas > p.limite
        ? { texto: `${p.rodadas} rodadas de ajuste, ${p.rodadas - p.limite} acima do contratado (${p.limite})`, grave: true }
        : { texto: `${p.rodadas} de ${p.limite} rodadas de ajuste usadas: no limite`, grave: false };
    default:
      return null;
  }
}
