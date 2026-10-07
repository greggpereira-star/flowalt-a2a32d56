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
  | { tipo: 'aprovacao-parada'; dias: number };

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
}

export interface CardComRisco extends Omit<CardEmAtencao, 'problemas'> {
  problemas: ProblemaRisco[];
}

const PONTOS = { lento: 2, sobrecarga: 1, aprovacao: 2 } as const;

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

    return { ...a, problemas, pontos };
  });
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
    default:
      return null;
  }
}
