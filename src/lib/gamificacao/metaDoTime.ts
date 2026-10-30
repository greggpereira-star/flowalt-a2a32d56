// Meta do time (gamificacao, Onda 1): regras puras, sem rede nem React, para poderem ser testadas.
// O progresso em si e calculado no banco (get_meta_do_time), pela mesma regra do ranking.

export type TipoDeMeta = 'entregas' | 'entregas_no_prazo';

export interface MetaDoTime {
  id: string;
  tipo: TipoDeMeta;
  titulo: string;
  alvo: number;
  atual: number;
  recompensa: string | null;
  atingida: boolean;
  week_start: string;
  celebrada_em: string | null;
}

export interface SemanaDeEntregas {
  semana_inicio: string;
  entregas: number;
  no_prazo: number;
}

export const TIPOS_DE_META: Record<TipoDeMeta, { rotulo: string; descricao: string; titulo: (alvo: number) => string }> = {
  entregas: {
    rotulo: 'Entregas do time',
    descricao: 'Cards entregues na semana, por qualquer pessoa do time (cada card conta uma vez).',
    titulo: alvo => `O time entrega ${alvo} cards na semana`,
  },
  entregas_no_prazo: {
    rotulo: 'Entregas no prazo',
    descricao: 'Cards entregues até o prazo (ou sem prazo definido) na semana.',
    titulo: alvo => `${alvo} cards entregues no prazo na semana`,
  },
};

/** 0 a 100, arredondado; alvo invalido vira 0. */
export function percentualDaMeta(atual: number, alvo: number): number {
  if (!(alvo > 0) || !(atual > 0)) return 0;
  return Math.min(100, Math.round((atual / alvo) * 100));
}

export function faltamParaMeta(atual: number, alvo: number): number {
  return Math.max(0, alvo - atual);
}

/** Segunda-feira da semana de `agora`, no fuso de Sao Paulo, como 'YYYY-MM-DD' (a mesma conta do banco: date_trunc('week')). */
export function inicioDaSemanaSP(agora: Date = new Date()): string {
  const [a, m, d] = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const dow = dia.getUTCDay(); // 0 = domingo
  dia.setUTCDate(dia.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return dia.toISOString().slice(0, 10);
}

/**
 * Sugere um alvo realista a partir das ULTIMAS semanas fechadas (a semana atual fica de fora, porque esta incompleta):
 * entregas = media das ultimas 4 semanas + 10%; no prazo = media das ultimas 4 + 2 (um passo acima do que o time faz hoje).
 * Minimo 3. Sem historico, devolve null (a tela pede para o admin digitar).
 */
export function sugerirAlvo(tipo: TipoDeMeta, historico: SemanaDeEntregas[], semanaAtual: string): number | null {
  const fechadas = historico.filter(s => s.semana_inicio < semanaAtual).slice(-4);
  if (fechadas.length === 0) return null;
  const media = fechadas.reduce((soma, s) => soma + (tipo === 'entregas' ? s.entregas : s.no_prazo), 0) / fechadas.length;
  return Math.max(3, tipo === 'entregas' ? Math.round(media * 1.1) : Math.ceil(media) + 2);
}
