// Missoes diarias (gamificacao, Onda 2): regras puras, sem rede nem React, para poderem ser testadas.
// O banco calcula o que foi feito (get_missoes_diarias); aqui ficam so os textos, os valores da legenda e as contas de progresso.

export type ChaveDaMissaoDiaria = 'moveu' | 'comentou' | 'entregou';

/** Espelha _pontos_diarias no banco: se mudar la, mude aqui (so o texto da tela). */
export const MISSOES_DIARIAS: { chave: ChaveDaMissaoDiaria; titulo: string; pontos: number }[] = [
  { chave: 'moveu', titulo: 'Mover um card de etapa', pontos: 2 },
  { chave: 'comentou', titulo: 'Comentar num card (15+ caracteres)', pontos: 2 },
  { chave: 'entregou', titulo: 'Entregar um card', pontos: 4 },
];
export const BONUS_DIA_COMPLETO = 4;

export interface MissoesDoDia {
  dia: string;
  fim_de_semana: boolean;
  moveu: boolean;
  comentou: boolean;
  entregou: boolean;
  pontos_hoje: number;
  pontos_max: number;
  dias_completos_mes: number;
  pontos_mes: number;
  equipe_completa: number;
  equipe_total: number;
}

export function feitasNoDia(m: Pick<MissoesDoDia, ChaveDaMissaoDiaria>): number {
  return MISSOES_DIARIAS.filter(x => m[x.chave]).length;
}

export function diaCompleto(m: Pick<MissoesDoDia, ChaveDaMissaoDiaria>): boolean {
  return feitasNoDia(m) === MISSOES_DIARIAS.length;
}

/** Frase curta sobre o que falta para fechar o dia. */
export function fraseDoProgresso(m: Pick<MissoesDoDia, ChaveDaMissaoDiaria>): string {
  const feitas = feitasNoDia(m);
  const total = MISSOES_DIARIAS.length;
  if (feitas === total) return `Dia completo! Bônus de +${BONUS_DIA_COMPLETO} garantido.`;
  const falta = total - feitas;
  if (falta === 1) return `Falta 1 para fechar o dia e levar o bônus de +${BONUS_DIA_COMPLETO}.`;
  return feitas === 0 ? 'Nenhuma feita ainda. Cada uma já rende pontos.' : `Faltam ${falta} para fechar o dia.`;
}

/** Percentual dos pontos do dia ja conquistados, de 0 a 100. */
export function percentualDoDia(m: Pick<MissoesDoDia, 'pontos_hoje' | 'pontos_max'>): number {
  return m.pontos_max <= 0 ? 0 : Math.min(100, Math.round((m.pontos_hoje / m.pontos_max) * 100));
}
